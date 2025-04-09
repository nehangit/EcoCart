from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS to allow cross-origin requests
import pandas as pd
import re

app = Flask(__name__)
CORS(app) # Enable CORS so frontend (the extension) can communicate with backend

columns = [
    'Cotton', 'Organic_cotton', 'Linen', 'Hemp', 'Jute', 'Other_plant', 'Silk', 'Wool', 'Leather', 'Camel', 'Cashmere',
    'Alpaca', 'Feathers', 'Other_animal', 'Polyester', 'Nylon', 'Acrylic', 'Spandex', 'Elastane', 'Polyamide',
    'Other_synthetic', 'Lyocell', 'Viscose', 'Acetate', 'Modal', 'Rayon', 'Other_regenerated', 'Other'
]
df = pd.DataFrame(columns=columns)

def parse_fabric_composition(fabric_string):
    compositions = []
    if not isinstance(fabric_string, str):
        return compositions

    for part in fabric_string.split(','):
        part = part.strip()
        match = re.match(r'(\d+)%\s+([\w\s-]+)', part)
        if match:
            percentage = float(match.group(1)) / 100
            fabric = match.group(2).strip()
            compositions.append((fabric, percentage))
    return compositions

def add_to_dataframe(data):
    global df
    if not data.get('facts') or not data['facts'].get('Fabric type'):
        return None
    
    fabric_composition = data['facts']['Fabric type']
    fabric_data = parse_fabric_composition(fabric_composition)
    
    new_row = {col: 0.0 for col in columns}
    new_row['name'] = data.get('name', '')
    new_row['brand'] = data.get('brand', '')
    
    for fabric, percentage in fabric_data:
        if fabric == 'Spandex' and 'Elastane' in new_row:
            fabric = 'Elastane'
        if fabric in new_row:
            new_row[fabric] = percentage
    
    df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
    return new_row

@app.route('/')
def hello_world():
    return 'Hello World!'

@app.route('/receive-data', methods=['POST'])
def receive_data():
    global df
    if request.method == "OPTIONS":
        # Respond to preflight request with correct CORS headers
        response = jsonify({"message": "CORS preflight successful"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        return response, 200 # Preflight successful
    
    try:
        data = request.get_json() # Extract JSON from request
        if not data:
            return jsonify({"success": False, "message": "No data received."}), 400

        # Create a new row with all zeros
        new_row = {col: 0.0 for col in columns}
        new_row['name'] = data.get('name', '')
        new_row['brand'] = data.get('brand', '')
            
       # Process fabric data if available
        if data.get('facts') and data['facts'].get('Fabric type'):
            fabric_data = parse_fabric_composition(data['facts']['Fabric type'])
            for fabric, percentage in fabric_data:
                if fabric == 'Spandex' and 'Elastane' in new_row:
                    fabric = 'Elastane'
                if fabric in new_row:
                    new_row[fabric] = percentage
            
        # Add to DataFrame
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

        # Just print the data for now, but do something with data
        print("Received data: ", data) 

        return jsonify({
            "success": True, 
            "message": "Data received", 
            "dataframe": df[columns].to_dict(orient="records"), 
            "new_entry": new_row
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500  

@app.route('/get-data', methods=['GET'])
def get_data():
    """Endpoint to view the accumulated DataFrame"""
    return jsonify({
        "dataframe": df[columns].to_dict(orient='records'),
        "columns": columns
    })

@app.route('/test-data', methods=['GET'])
def test_data():
    """Endpoint to test with sample data"""
    test_products = [
        {
            "name": "Test Jacket", 
            "brand": "North Face",
            "facts": {"Fabric type": "50% Nylon, 50% Polyester"}
        },
        {
            "name": "Test Jeans",
            "brand": "Levi's",
            "facts": {"Fabric type": "98% Cotton, 2% Elastane"}
        }
    ]
    
    results = []
    for product in test_products:
        new_row = add_to_dataframe(product)
        if new_row:
            results.append(new_row)
    
    return jsonify({
        "message": f"Added {len(results)} test products",
        "new_entries": results,
        "current_dataframe": df.to_dict(orient='records')
    })

if __name__ == '__main__':
    app.run(debug=True)  



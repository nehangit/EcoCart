from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS to allow cross-origin requests
import pandas as pd
import re
from collections import defaultdict

import sklearn as skl
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import LabelEncoder

# Gets the path to the directory containing this script (app.py)
current_dir = Path(__file__).resolve().parent
# Create a relative path to dataset file
dataset_path = current_dir.parent / "Full Dataset.xlsx"

df = pd.read_excel(dataset_path)

#df.dropna(inplace=True)

model_df['Type'] = LabelEncoder().fit_transform(model_df['Type'])
model_df['Manufacturing_location'] = LabelEncoder().fit_transform(model_df['Manufacturing_location'])
model_df['Use_location'] = LabelEncoder().fit_transform(model_df['Use_location'])
model_df['Drying_instruction'] = LabelEncoder().fit_transform(model_df['Drying_instruction'])
model_df['Washing_instruction'] = LabelEncoder().fit_transform(model_df['Washing_instruction'])

X = model_df.iloc[:,:-1]
y = model_df.iloc[:,-1]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, 
    test_size=0.2,    
    random_state=42,  
    stratify=y        
)

rfc = RandomForestClassifier(
    n_estimators=150,  
    max_leaf_nodes=None,
    min_samples_leaf=1,
    min_weight_fraction_leaf=0.0, 
    random_state=42,
)

rfc.fit(X_train, y_train)

best_model = rfc

app = Flask(__name__)
CORS(app, resources={
    r"/receive-data": {
        "origins": ["chrome-extension://hkbnlehidddkgaefmcooilbgegnmclof", 
                    "chrome-extension://monjecbfolndichmnjlcebkjbcdlhhkk"],
        "methods": ["POST", "OPTIONS", "GET"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True,
        "expose_headers": ["Content-Type"],
        "max_age": 86400
    }
})

# Additional headers to ensure compatibility
# @app.after_request
# def after_request(response):
#     response.headers.add('Access-Control-Allow-Origin', 'chrome-extension://hkbnlehidddkgaefmcooilbgegnmclof')
#     response.headers.add('Access-Control-Allow-Credentials', 'true')
#     return response

columns = [
    'Cotton', 'Organic_cotton', 'Linen', 'Hemp', 'Jute', 'Other_plant', 'Silk', 'Wool', 'Leather', 'Camel', 'Cashmere',
    'Alpaca', 'Feathers', 'Other_animal', 'Polyester', 'Nylon', 'Acrylic', 'Spandex', 'Elastane', 'Polyamide',
    'Other_synthetic', 'Lyocell', 'Viscose', 'Acetate', 'Modal', 'Rayon', 'Other_regenerated', 'Other'
]
df = pd.DataFrame(columns=columns)

def parse_fabric_string(fabric_string):
    """Parse a single fabric composition string"""
    part_compositions = []
    
    # Split by semicolon to handle different parts of the garment
    parts = fabric_string.split(';')
    
    for part in parts:
        compositions = []
        has_percentages = False
        
        # Remove any prefix like "Body: " or "Hood Lining: "
        part_name = "Main"
        if ':' in part:
            part_split = part.split(':', 1)
            part_name = part_split[0].strip()
            part = part_split[1]
        
        # Process each comma-separated composition
        items = [item.strip() for item in part.split(',') if item.strip()]
        
        # First pass: check if any percentages are present
        for item in items:
            if re.search(r'\d+%', item):
                has_percentages = True
                break
        
        # Second pass: parse compositions based on whether percentages exist
        if has_percentages:
            # If some items have percentages, process normally
            for composition in items:
                # Match patterns like "56% Cotton" or "100% nylon"
                match = re.match(r'(\d+)%\s+([\w\s-]+)', composition)
                if match:
                    percentage = float(match.group(1)) / 100
                    fabric = match.group(2).strip().capitalize()
                    compositions.append((fabric, percentage))
                else:
                    # Handle items without percentage in a mixed context
                    # Since some items have percentages but this one doesn't,
                    # we'll need to handle this as a special case or ignore
                    fabric_only = composition.strip().capitalize()
                    if fabric_only and not re.match(r'\d+%', fabric_only):
                        # In a mixed context, we might assign a default value
                        # or flag this for special handling
                        pass
        else:
            # If no percentages found, distribute evenly
            total_items = len(items)
            if total_items > 0:
                even_percentage = 1.0 / total_items
                for item in items:
                    fabric = item.strip().capitalize()
                    if fabric:
                        compositions.append((fabric, even_percentage))
        
        if compositions:
            part_compositions.append((part_name, compositions))
    
    return part_compositions

def parse_fabric_composition(fabric_data):
    """Handle different formats of fabric data (string or array)"""
    all_part_compositions = []
    
    if isinstance(fabric_data, str):
        return parse_fabric_string(fabric_data)
    elif isinstance(fabric_data, list):
        # For array input, first check if any part has percentages
        has_percentages = False
        all_items = []
        
        for item in fabric_data:
            if isinstance(item, str):
                if re.search(r'\d+%', item):
                    has_percentages = True
                all_items.append(item)
        
        # If no percentages in array, distribute evenly
        if not has_percentages and all_items:
            even_percentage = 1.0 / len(all_items)
            compositions = []
            for item in all_items:
                fabric = item.strip().capitalize()
                if fabric:
                    compositions.append((fabric, even_percentage))
            if compositions:
                all_part_compositions.append(("Main", compositions))
        else:
            # Process normally if percentages exist
            for item in fabric_data:
                if isinstance(item, str):
                    all_part_compositions.extend(parse_fabric_string(item))
    
    return all_part_compositions

def normalize_fabric_name(fabric):
    """Normalize fabric names to match column names"""
    fabric = fabric.capitalize()
    
    # Map common variations to standard names
    if fabric.lower() == 'spandex':
        return 'Elastane'
    elif fabric.lower() == 'nylon':
        return 'Nylon'
    
    # Try to find an exact match in columns
    if fabric in columns:
        return fabric
    
    # Try case-insensitive match
    for col in columns:
        if col.lower() == fabric.lower():
            return col
    
    # If no match found, return the original name
    return "Other"

def average_fabric_compositions(part_compositions):
    """
    Average the percentages of the same fabric types across different garment parts
    
    Args:
        part_compositions: List of tuples (part_name, list of (fabric, percentage) tuples)
    
    Returns:
        List of (fabric, averaged_percentage) tuples
    """
    fabric_counts = defaultdict(int)  # Track how many parts have each fabric
    fabric_totals = defaultdict(float)  # Track total percentage for each fabric
    
    # Sum up percentages for each fabric across all parts
    for part_name, compositions in part_compositions:
        for fabric, percentage in compositions:
            normalized_fabric = normalize_fabric_name(fabric)
            fabric_totals[normalized_fabric] += percentage
            fabric_counts[normalized_fabric] += 1
    
    # Calculate averages
    averaged_compositions = []
    for fabric, total in fabric_totals.items():
        average = total / fabric_counts[fabric]
        averaged_compositions.append((fabric, average))
    
    return averaged_compositions

def add_to_dataframe(data):
    global df
    if not data.get('facts') or not data['facts'].get('Fabric type'):
        return None
    
    fabric_composition = data['facts']['Fabric type']
    part_compositions = parse_fabric_composition(fabric_composition)
    
    # Average the percentages for the same fabrics across different parts
    averaged_compositions = average_fabric_compositions(part_compositions)
    
    # Initialize all values to 0.0
    new_row = {col: 0.0 for col in columns}
    
    # Fill in the averaged percentages
    for fabric, percentage in averaged_compositions:
        if fabric in columns:
            new_row[fabric] = percentage
    
    # Add new row to the existing DataFrame
    new_df = pd.DataFrame([new_row], dtype='float64')
    df = pd.concat([df, new_df], ignore_index=True)
    return new_row

@app.route('/')
def hello_world():
    return 'Hello World!'

@app.route('/receive-data', methods=['POST', 'OPTIONS'])
def receive_data():
    if request.method == "OPTIONS":
    #     # Respond to preflight request with correct CORS headers
    #     response = jsonify({"message": "CORS preflight successful"})
    #     response.headers.add("Access-Control-Allow-Origin", "chrome-extension://hkbnlehidddkgaefmcooilbgegnmclof", "chrome-extension://monjecbfolndichmnjlcebkjbcdlhhkk")
    #     response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
    #     response.headers.add("Access-Control-Allow-Headers", "Content-Type")
    #     response.headers.add('Access-Control-Allow-Credentials', 'true')
        return '', 200 # Preflight successful     
    
    global df
    try:
        data = request.get_json() # Extract JSON from request
        print(data)

        if not data:
            return jsonify({"success": False, "message": "No data received."}), 400
        
        # Hey Brian Im not sure how exactly youre working with the product. This caused 
        # an INTERNAL SERVER ERROR so I commented it out and replaced it with whats below

        # #Create a new df
        # results = []
        # for product in data:
        #     new_row = add_to_dataframe(product)
        #     if new_row:
        #         results.append(new_row)

        new_row = add_to_dataframe(data)
        if not new_row:
            return jsonify({"success": False, "message": "Unable to add product to dataframe."}), 400

        return jsonify({
            "success": True, 
            "message": "Data received",
 #########################################################################################
            "sustainable": False, # REPLACE THIS VALUE WITH WHAT THE MODEL SPITS OUT
 #########################################################################################
            "dataframe": df[columns].to_dict(orient="records"), 
            "new_entry": new_row
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)  



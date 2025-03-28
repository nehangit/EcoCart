from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS to allow cross-origin requests

app = Flask(__name__)
CORS(app) # Enable CORS so frontend (the extension) can communicate with backend

@app.route('/')
def hello_world():
    return 'Hello World!'

@app.route('/receive-data', methods=['POST'])
def receive_data():
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
        
        # Just print the data for now, but do something with data
        print("Received data: ", data) 
        return jsonify({"success": True, "message": "Data received"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500  

if __name__ == '__main__':
    app.run(debug=True)  



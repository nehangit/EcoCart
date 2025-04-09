from flask import Flask, request, jsonify
from flask_cors import CORS # Import CORS to allow cross-origin requests

import sklearn as skl
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import LabelEncoder

df = pd.read_excel("/Users/jingyuanni/Documents/GitHub/team8-dev-ada/Full Dataset.xlsx")

#df.dropna(inplace=True)

df['Type'] = LabelEncoder().fit_transform(df['Type'])
df['Manufacturing_location'] = LabelEncoder().fit_transform(df['Manufacturing_location'])
df['Use_location'] = LabelEncoder().fit_transform(df['Use_location'])
df['Drying_instruction'] = LabelEncoder().fit_transform(df['Drying_instruction'])
df['Washing_instruction'] = LabelEncoder().fit_transform(df['Washing_instruction'])

X = df.iloc[:,:-1]
y = df.iloc[:,-1]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, 
    test_size=0.2,    
    random_state=42,  
    stratify=y        
)

param_grid = {
    'n_estimators': [100, 125, 150, 175, 200],
    'max_leaf_nodes': [None, 10, 20, 50],
    'min_samples_leaf': [1, 2, 5],
    'min_weight_fraction_leaf': [0.0, 0.01, 0.05]
}

rfc = RandomForestClassifier(
    #n_estimators=100,   
    random_state=42
)

grid_search = GridSearchCV(
    estimator=rfc,
    param_grid=param_grid,
    cv=5,              
    scoring='accuracy',
    n_jobs=-1          
)

grid_search.fit(X_train, y_train)

best_model = grid_search.best_estimator_

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



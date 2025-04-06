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
print("Best parameters found:", grid_search.best_params_)
print("Best cross-validation accuracy:", grid_search.best_score_)

best_model = grid_search.best_estimator_

y_pred = best_model.predict(X_test)

# Print classification report
print("Classification Report on Test Set:")
print(classification_report(y_test, y_pred))

# Confusion matrix
cm = confusion_matrix(y_test, y_pred)
print("Confusion Matrix:")
print(cm)

#plot confusion matrix
plt.figure(figsize=(6, 4))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
plt.title("Confusion Matrix")
plt.ylabel("True Label")
plt.xlabel("Predicted Label")
plt.show()

#plot feature importance
importances = best_model.feature_importances_
feature_names = X.columns

# Sort features by importance
indices = np.argsort(importances)[::-1]

plt.figure(figsize=(10, 8))
sns.barplot(x=importances[indices], y=feature_names[indices], orient='h')
plt.title("Feature Importances")
plt.show()

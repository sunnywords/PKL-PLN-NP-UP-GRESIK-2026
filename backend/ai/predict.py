import sys
import json
import joblib
import pandas as pd
import os

# Load model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'mold_risk_model.pkl')

try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    print(json.dumps({"error": f"Failed to load model: {str(e)}"}))
    sys.exit(1)

def predict():
    try:
        # Baca data dari stdin
        input_data = sys.stdin.read()
        if not input_data:
            return
            
        data = json.loads(input_data)
        
        # URUTAN HARUS PERSIS SAMA DENGAN TRAINING SCRIPT USER
        # Kolom: [temp, hum, ldr]
        features = pd.DataFrame([[
            float(data['temp']), 
            float(data['hum']), 
            float(data['ldr'])
        ]], columns=['temp', 'hum', 'ldr'])
        
        # Prediksi
        risk_level = int(model.predict(features)[0])
        
        # Balikin hasil
        print(json.dumps({
            "riskLevel": risk_level,
            "label": ["LOW", "MEDIUM", "HIGH"][risk_level]
        }))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    predict()

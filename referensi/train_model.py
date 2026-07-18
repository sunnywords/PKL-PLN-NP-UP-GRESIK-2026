import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import os

def train_mold_model():
    input_file = "final_dataset_augmented.csv"
    output_model = "mold_risk_model.pkl"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} tidak ditemukan!")
        return

    print(f"--- Memulai Proses Training Mold Risk Model (3 Sensor Utama) ---")
    print(f"-> Memuat Dataset: {input_file}...")
    df = pd.read_csv(input_file)
    
    # 1. FITUR (Hanya 3 Sensor Utama)
    features = ['temp', 'hum', 'ldr']
    target = 'mold_risk_level'
    
    # 2. BALANCING DATASET (Under-sampling)
    print("-> Menyeimbangkan dataset (Under-sampling)...")
    min_samples = df[target].value_counts().min()
    
    # Cara yang lebih aman: ambil sample per class lalu gabungkan
    df_balanced = pd.concat([
        df[df[target] == cat].sample(min_samples, random_state=42) 
        for cat in df[target].unique()
    ])
    
    # Shuffle agar urutan kelas acak
    df_balanced = df_balanced.sample(frac=1, random_state=42).reset_index(drop=True)
    
    print(f"-> Jumlah data per kelas sekarang: {min_samples} baris.")
    print(f"-> Total data training & testing: {len(df_balanced)} baris.")

    X = df_balanced[features]
    y = df_balanced[target]

    # 3. SPLIT DATA
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 3. TRAINING
    print("-> Melatih model LightGBM...")
    clf = lgb.LGBMClassifier(objective='multiclass', num_class=3, verbose=-1, seed=42)
    clf.fit(X_train, y_train)

    # 4. EVALUASI & PLOTTING
    print("-> Menghasilkan Visualisasi Evaluasi...")
    y_pred = clf.predict(X_test)
    cm = confusion_matrix(y_test, y_pred)
    
    # Visualisasi Confusion Matrix
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Greens', 
                xticklabels=['Low', 'Medium', 'High'], 
                yticklabels=['Low', 'Medium', 'High'])
    plt.xlabel('Prediksi')
    plt.ylabel('Asli')
    plt.title('Confusion Matrix (Hanya 3 Sensor)')
    plt.savefig('confusion_matrix.png')
    plt.close()

    # Visualisasi Feature Importance
    plt.figure(figsize=(10, 6))
    lgb.plot_importance(clf, importance_type='split', title='Pentingnya Data Sensor (3 Sensor)')
    plt.tight_layout()
    plt.savefig('feature_importance.png')
    plt.close()

    # 5. SIMPAN MODEL
    joblib.dump(clf, output_model)
    print(f"\n--- SELESAI ---")
    print(f"Model disederhanakan menjadi 3 fitur sensor saja.")
    print(f"File disimpan: '{output_model}', 'confusion_matrix.png', 'feature_importance.png'")

if __name__ == "__main__":
    train_mold_model()

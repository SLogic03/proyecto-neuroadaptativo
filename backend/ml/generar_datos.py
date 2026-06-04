import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ==========================================
# Script para regenerar datos sintéticos
# calibrados a escalas físicas reales.
# ==========================================

NUM_SAMPLES_PER_CLASS = 5000
CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "synthetic_telemetry.csv")

def generar_datos_calibrados():
    np.random.seed(42)
    start_time = datetime(2026, 6, 4)

    data = []
    
    # ── CLASE 0: NORMAL ──
    # Movimientos pausados, suaves y precisos
    for i in range(NUM_SAMPLES_PER_CLASS):
        timestamp = start_time + timedelta(seconds=i*0.5)
        x = np.random.uniform(0, 1920)
        y = np.random.uniform(0, 1080)
        
        # Escalas fisicas del raton real (DPI)
        v = np.random.normal(2.0, 1.0)
        a = np.random.normal(0.05, 0.02)
        
        # Evitar valores negativos
        v = max(0.01, v)
        a = max(0.001, a)
        
        idle_time = np.random.uniform(0, 2)
        click_rate = np.random.randint(0, 3)
        
        data.append([timestamp, x, y, v, a, idle_time, click_rate, 0])
        
    # ── CLASE 1: ESTRES ──
    # Movimientos bruscos, rápidos e irregulares
    for i in range(NUM_SAMPLES_PER_CLASS):
        timestamp = start_time + timedelta(hours=1, seconds=i*0.5)
        x = np.random.uniform(0, 1920)
        y = np.random.uniform(0, 1080)
        
        # Escalas fisicas altas (sacudidas)
        v = np.random.normal(15.0, 5.0)
        a = np.random.normal(2.5, 1.0)
        
        # Evitar valores negativos
        v = max(0.01, v)
        a = max(0.001, a)
        
        # Posible mayor inactividad y mas clicks impulsivos
        idle_time = np.random.uniform(1, 6)
        click_rate = np.random.randint(2, 10)
        
        data.append([timestamp, x, y, v, a, idle_time, click_rate, 1])
        
    # Crear DataFrame y mezclar (shuffle)
    df = pd.DataFrame(data, columns=['timestamp', 'x', 'y', 'v', 'a', 'idle_time', 'click_rate', 'target'])
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Exportar
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    df.to_csv(CSV_PATH, index=False)
    print(f"CSV generado en: {CSV_PATH}")
    print(f"Total muestras: {len(df)}")
    print(f"Medias - Clase Normal (v: {df[df['target']==0]['v'].mean():.2f}, a: {df[df['target']==0]['a'].mean():.2f})")
    print(f"Medias - Clase Estrés (v: {df[df['target']==1]['v'].mean():.2f}, a: {df[df['target']==1]['a'].mean():.2f})")

if __name__ == "__main__":
    generar_datos_calibrados()

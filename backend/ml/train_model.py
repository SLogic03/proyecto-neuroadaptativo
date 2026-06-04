"""
====================================================================
 train_model.py  --  Sprint 2 / Bloque 1
 Pipeline completo: carga, feature engineering, entrenamiento
 LightGBM, explicabilidad SHAP y exportacion del modelo.
====================================================================
"""

import os
import warnings
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import lightgbm as lgb
import shap
import joblib

warnings.filterwarnings("ignore", category=UserWarning)

# ── Rutas ──────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH   = os.path.join(SCRIPT_DIR, "data", "synthetic_telemetry.csv")
MODEL_PATH = os.path.join(SCRIPT_DIR, "lightgbm_model.pkl")


# ==================================================================
# 1. CARGA Y PREPROCESAMIENTO
# ==================================================================
print("=" * 60)
print(" 1. CARGA Y PREPROCESAMIENTO")
print("=" * 60)

df = pd.read_csv(CSV_PATH, parse_dates=["timestamp"])
print(f"   Filas: {len(df)}  |  Columnas: {list(df.columns)}")
print(f"   Distribucion del target:\n{df['target'].value_counts().to_string()}\n")


# ==================================================================
# 2. FEATURE ENGINEERING  (LS-12)
# ==================================================================
print("=" * 60)
print(" 2. FEATURE ENGINEERING")
print("=" * 60)

# --- 2a. Jerk (derivada de la aceleracion) -----------------------
#     Aproximacion: delta_a entre filas consecutivas ordenadas por
#     timestamp. Se usa fillna(0) para la primera fila.
df = df.sort_values("timestamp").reset_index(drop=True)
df["jerk"] = df["a"].diff().fillna(0)

# --- 2b. Velocidad al cuadrado (energia cinetica relativa) --------
df["v_squared"] = df["v"] ** 2

# --- 2c. Ratio aceleracion / velocidad ---------------------------
#     Indicador de cambio brusco de movimiento.
df["a_over_v"] = np.where(df["v"] > 0, df["a"] / df["v"], 0.0)

# --- 2d. Interaccion idle * click_rate ----------------------------
#     Tiempo inactivo alto + clicks altos puede indicar frustracion.
df["idle_x_click"] = df["idle_time"] * df["click_rate"]

# Features finales
FEATURE_COLS = ["v", "a", "idle_time", "click_rate",
                "jerk", "v_squared", "a_over_v", "idle_x_click"]

X = df[FEATURE_COLS]
y = df["target"]

print(f"   Features usadas ({len(FEATURE_COLS)}): {FEATURE_COLS}")
print(f"   Features derivadas nuevas: jerk, v_squared, a_over_v, idle_x_click")
print(f"   Shape X: {X.shape}  |  Shape y: {y.shape}\n")


# ==================================================================
# 3. ENTRENAMIENTO Y EVALUACION  (LS-11 / LS-13)
# ==================================================================
print("=" * 60)
print(" 3. ENTRENAMIENTO Y EVALUACION")
print("=" * 60)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"   Train: {X_train.shape[0]}  |  Test: {X_test.shape[0]}")

model = lgb.LGBMClassifier(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=6,
    num_leaves=31,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    verbosity=-1,
)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)

print(f"\n   Accuracy global: {acc:.4f}  ({acc*100:.2f}%)")
print(f"\n   Classification Report:\n")
print(classification_report(y_test, y_pred, target_names=["Normal (0)", "Stress (1)"]))

if acc >= 0.80:
    print("   >> OBJETIVO CUMPLIDO: Accuracy >= 80%\n")
else:
    print("   >> ATENCION: Accuracy < 80%. Revisar features o hiperparametros.\n")


# ==================================================================
# 4. EXPLICABILIDAD CON SHAP  (LS-14)
# ==================================================================
print("=" * 60)
print(" 4. EXPLICABILIDAD CON SHAP")
print("=" * 60)

explainer = shap.TreeExplainer(model)

# Tomamos una muestra de test para explicar (primera fila)
sample = X_test.iloc[:1]
shap_values = explainer.shap_values(sample)

print(f"\n   Muestra de prueba (fila 0 del test set):")
print(f"   {sample.to_dict(orient='records')[0]}")
print(f"   Prediccion del modelo: {model.predict(sample)[0]}")

# shap_values para clasificacion binaria: lista de 2 arrays [clase_0, clase_1]
if isinstance(shap_values, list):
    sv = shap_values[1][0]  # SHAP values para la clase 1 (stress)
else:
    sv = shap_values[0]

print(f"\n   SHAP Feature Importance (clase Stress):")
print(f"   {'Feature':<16} {'SHAP Value':>12}")
print(f"   {'-'*16} {'-'*12}")
for feat, val in sorted(zip(FEATURE_COLS, sv), key=lambda x: abs(x[1]), reverse=True):
    print(f"   {feat:<16} {val:>12.6f}")

# Feature importance global del modelo (gain)
print(f"\n   LightGBM Feature Importance (gain):")
importances = model.feature_importances_
print(f"   {'Feature':<16} {'Importance':>12}")
print(f"   {'-'*16} {'-'*12}")
for feat, imp in sorted(zip(FEATURE_COLS, importances), key=lambda x: x[1], reverse=True):
    print(f"   {feat:<16} {imp:>12}")


# ==================================================================
# 5. EXPORTACION  (LS-15)
# ==================================================================
print(f"\n{'=' * 60}")
print(" 5. EXPORTACION DEL MODELO")
print("=" * 60)

joblib.dump(model, MODEL_PATH)
print(f"   Modelo exportado en: {MODEL_PATH}")
print(f"   Tamano: {os.path.getsize(MODEL_PATH) / 1024:.1f} KB")
print(f"\n{'=' * 60}")
print(" PIPELINE COMPLETADO EXITOSAMENTE")
print("=" * 60)

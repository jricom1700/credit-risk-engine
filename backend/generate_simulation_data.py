"""
Script de pre-cálculo y generación de la cartera de prueba calificada (Test Scored Portfolio).

Este script realiza la partición estratificada del conjunto de datos limpio (30% Test),
aplica el modelo Champion Scorecard entrenado y exporta una estructura optimizada en Parquet
con las columnas exactas requeridas para la simulación en memoria de la API:
['loan_amnt_mxn', 'loan_status', 'pd', 'credit_score'].
"""

import os
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

def generate_scored_portfolio():
    # Rutas base
    base_dir = Path(__file__).resolve().parent.parent
    data_path = base_dir / "data" / "processed" / "credit_risk_clean_mxn.parquet"
    model_path = base_dir / "backend" / "app" / "models" / "credit_risk_pipeline.joblib"
    output_path = base_dir / "data" / "processed" / "test_scored_portfolio.parquet"

    print(f"Cargando dataset depurado desde: {data_path}")
    if not data_path.exists():
        raise FileNotFoundError(f"No se encontró el dataset procesado en {data_path}")
    df = pd.read_parquet(data_path)

    print(f"Cargando modelo serializado desde: {model_path}")
    if not model_path.exists():
        raise FileNotFoundError(f"No se encontró el pipeline serializado en {model_path}")
    bundle = joblib.load(model_path)

    features = bundle["features"]
    target = "loan_status"

    # Partición estratificada idéntica a la Fase 2 (70% Train / 30% Test, random_state=42)
    X = df[features].copy()
    y = df[target].copy()
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=42
    )

    # Inferencia con Scorecard Champion
    scorecard = bundle["champion_scorecard"]
    print(f"Evaluando {len(X_test):,} contratos de prueba con el modelo Champion...")
    scores = scorecard.score(X_test)
    probas = scorecard.predict_proba(X_test)[:, 1]

    # DataFrame optimizado para memoria
    df_test_scored = pd.DataFrame({
        "loan_amnt_mxn": X_test["loan_amnt_mxn"].values.astype(np.float64),
        "loan_status": y_test.values.astype(np.int8),
        "pd": probas.astype(np.float64),
        "credit_score": np.round(scores).astype(np.int16)
    })

    # Guardar en formato Parquet
    df_test_scored.to_parquet(output_path, engine="pyarrow", index=False)
    file_size_kb = os.path.getsize(output_path) / 1024

    print(f"✓ Archivo generado exitosamente en: {output_path}")
    print(f"• Registros: {len(df_test_scored):,}")
    print(f"• Columnas: {list(df_test_scored.columns)}")
    print(f"• Tamaño en disco: {file_size_kb:.1f} KB")
    print(f"• Rango de Scores: {df_test_scored['credit_score'].min()} a {df_test_scored['credit_score'].max()} pts")
    print(f"• Tasa de mora real: {df_test_scored['loan_status'].mean()*100:.2f}%")

if __name__ == "__main__":
    generate_scored_portfolio()

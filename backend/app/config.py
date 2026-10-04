"""Configuración central del motor de crédito y parámetros regulatorios."""

import os
from pathlib import Path
from typing import List
from pydantic import BaseModel

# Rutas absolutas del proyecto
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

class Settings(BaseModel):
    """Parámetros de configuración institucional de la API."""

    API_TITLE: str = "Credit Decisioning & Risk Strategy Engine (México)"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = (
        "Motor de decisión de crédito al consumo en México basado en Scorecard "
        "regulatorio calibrado (CNBV / Buró de Crédito) y simulador financiero de portafolio."
    )
    
    # Rutas a los artefactos de datos y modelos
    MODEL_PATH: Path = APP_DIR / "models" / "credit_risk_pipeline.joblib"
    TEST_PORTFOLIO_PATH: Path = PROJECT_ROOT / "data" / "processed" / "test_scored_portfolio.parquet"

    # Parámetros prudenciales de originación (México)
    DEFAULT_LGD: float = 0.45  # Loss Given Default promedio para consumo sin garantía
    DTI_MAX_LIMIT: float = 0.40  # Límite prudencial máximo de apalancamiento
    
    # Umbrales de decisión basados en Score (escala 300 - 850)
    SCORE_THRESHOLD_APPROVE: int = 580  # Score >= 580: Aprobado
    SCORE_THRESHOLD_REVIEW: int = 540   # 540 <= Score < 580: Revisión Manual (< 540: Rechazado)

    # Parámetros por defecto para simulación de portafolio
    DEFAULT_INTEREST_RATE: float = 0.35  # 35% tasa de interés anual
    DEFAULT_FUNDING_COST: float = 0.11   # 11% costo de fondeo anual (TIIE + spread)
    DEFAULT_CUTOFF_SCORE: int = 560      # Corte base para simulación

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

settings = Settings()

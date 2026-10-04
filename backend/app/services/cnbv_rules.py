"""Reglas y tablas normativas de la CNBV (Circular Única de Bancos - CUB Anexo 33)."""

from typing import Dict, List, Tuple
import numpy as np

CNBV_RATING_MATRIX: List[Dict[str, float | str]] = [
    {"grade": "A-1", "max_pd": 0.020, "min_reserve": 0.005, "description": "Riesgo Mínimo"},
    {"grade": "A-2", "max_pd": 0.030, "min_reserve": 0.009, "description": "Riesgo Muy Bajo"},
    {"grade": "B-1", "max_pd": 0.040, "min_reserve": 0.015, "description": "Riesgo Bajo"},
    {"grade": "B-2", "max_pd": 0.065, "min_reserve": 0.025, "description": "Riesgo Moderado-Bajo"},
    {"grade": "C-1", "max_pd": 0.100, "min_reserve": 0.050, "description": "Riesgo Moderado-Alto"},
    {"grade": "C-2", "max_pd": 0.200, "min_reserve": 0.150, "description": "Riesgo Alto"},
    {"grade": "D",   "max_pd": 0.500, "min_reserve": 0.450, "description": "Riesgo Muy Alto"},
    {"grade": "E",   "max_pd": 1.000, "min_reserve": 0.800, "description": "Pérdida Esperada Severa"},
]

def get_cnbv_rating(pd_value: float) -> Tuple[str, float, str]:
    """Obtiene la calificación CNBV, reserva mínima y descripción para un valor escalar de PD."""
    for bucket in CNBV_RATING_MATRIX:
        if pd_value <= bucket["max_pd"]:
            return str(bucket["grade"]), float(bucket["min_reserve"]), str(bucket["description"])
    return "E", 0.800, "Pérdida Esperada Severa"

def assign_cnbv_ratings_vectorized(pd_array: np.ndarray) -> np.ndarray:
    """Clasifica un array de probabilidades de default en categorías CNBV de forma vectorizada."""
    bins = [0.0, 0.020, 0.030, 0.040, 0.065, 0.100, 0.200, 0.500, 1.001]
    labels = np.array(["A-1", "A-2", "B-1", "B-2", "C-1", "C-2", "D", "E"])
    indices = np.digitize(pd_array, bins, right=True) - 1
    indices = np.clip(indices, 0, len(labels) - 1)
    return labels[indices]

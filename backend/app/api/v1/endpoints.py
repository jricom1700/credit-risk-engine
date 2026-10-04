"""Endpoints REST de la API de riesgo de crédito versión 1."""

from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status

from app.schemas.individual import IndividualScoreRequest, IndividualScoreResponse
from app.schemas.portfolio import PortfolioSimulationRequest, PortfolioSimulationResponse
from app.services.scoring_service import scoring_service
from app.services.portfolio_service import portfolio_service

router = APIRouter(prefix="/api/v1", tags=["Motor de Riesgo y Decisión"])

@router.post(
    "/score",
    response_model=IndividualScoreResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluación Crediticia Individual",
    description="Evalúa los datos de un solicitante mediante el Scorecard Champion calibrado a Buró de Crédito "
                "y el explicador local SHAP. Retorna Score, PD, dictamen de originación, calificación CNBV y Pérdida Esperada."
)
def evaluate_individual_credit(request: IndividualScoreRequest) -> IndividualScoreResponse:
    """Endpoint para originación individual de crédito al consumo."""
    try:
        return scoring_service.score_individual(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error durante el scoring del solicitante: {str(e)}"
        )

@router.post(
    "/simulate-portfolio",
    response_model=PortfolioSimulationResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulación de Estrategia de Portafolio",
    description="Ejecuta en milisegundos una simulación vectorizada sobre una cartera de prueba precargada en RAM. "
                "Permite interactuar con sliders de punto de corte (Cutoff Score), tasa de interés, costo de fondeo y LGD, "
                "calculando el Margen Financiero Neto, Pérdida Esperada, ROA y distribución regulatoria CNBV."
)
def simulate_portfolio_strategy(request: PortfolioSimulationRequest) -> PortfolioSimulationResponse:
    """Endpoint para simulación y optimización de políticas de originación masiva."""
    try:
        return portfolio_service.simulate(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error durante la simulación de portafolio: {str(e)}"
        )

@router.get(
    "/model-metadata",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Metadatos y Métricas de Validación del Modelo",
    description="Retorna la información institucional del modelo, variables predictoras y métricas de desempeño "
                "en muestra independiente de prueba (AUC-ROC, Gini, Kolmogorov-Smirnov)."
)
def get_model_metadata() -> Dict[str, Any]:
    """Retorna metadatos y métricas de auditoría del modelo de riesgo."""
    if scoring_service.bundle is None:
        scoring_service.load_model()
    
    bundle = scoring_service.bundle
    return {
        "framework": bundle.get("framework", "CNBV-CUB / Buró de Crédito"),
        "version": bundle.get("version", "1.0.0"),
        "features": bundle.get("features", []),
        "categorical_features": bundle.get("categorical_features", []),
        "numerical_features": bundle.get("numerical_features", []),
        "scaling_params": bundle.get("scaling_params", {}),
        "validation_metrics": bundle.get("validation_metrics", {}),
        "cnbv_rating_scale": bundle.get("cnbv_rating_matrix", [])
    }

@router.get(
    "/scorecard-table",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Tabla de Asignación de Puntos del Scorecard",
    description="Retorna la tabla completa de bines, Weight of Evidence (WoE) y puntos asignados por variable."
)
def get_scorecard_table() -> Dict[str, Any]:
    """Retorna la tabla detallada del Scorecard para visualización en frontend o auditoría."""
    if scoring_service.bundle is None:
        scoring_service.load_model()

    df_table = scoring_service.bundle.get("scorecard_table")
    if df_table is not None:
        cleaned_records = []
        for row in df_table.to_dict(orient="records"):
            clean_row = {}
            for k, v in row.items():
                if hasattr(v, "tolist"):
                    clean_row[k] = str(v.tolist())
                elif hasattr(v, "item"):
                    clean_row[k] = v.item()
                else:
                    clean_row[k] = str(v) if not isinstance(v, (int, float, bool)) else v
            cleaned_records.append(clean_row)
        return {"total_bins": len(cleaned_records), "bins": cleaned_records}
    return {"total_bins": 0, "bins": []}

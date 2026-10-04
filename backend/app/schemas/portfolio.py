"""Schemas Pydantic para el simulador de estrategia de portafolio y rentabilidad."""

from typing import List
from pydantic import BaseModel, Field

class PortfolioSimulationRequest(BaseModel):
    """Parámetros de política y negocio para la simulación de portafolio."""

    cutoff_score: int = Field(
        560, ge=300, le=750, description="Punto de corte del Scorecard (Score >= cutoff se aprueba)", examples=[560]
    )
    interest_rate: float = Field(
        0.35, ge=0.01, le=1.50, description="Tasa de interés anual activa promedio cobrada a los acreditados", examples=[0.35]
    )
    funding_cost: float = Field(
        0.11, ge=0.01, le=0.50, description="Costo de fondeo anual de la entidad financiera (TIIE + spread)", examples=[0.11]
    )
    lgd: float = Field(
        0.45, ge=0.05, le=1.00, description="Severidad de la pérdida esperada (Loss Given Default)", examples=[0.45]
    )

class CNBVSummaryItem(BaseModel):
    """Distribución y reservas por categoría regulatoria CNBV (CUB Anexo 33)."""

    rating: str = Field(..., description="Grado de riesgo CNBV (A-1 a E)")
    description: str = Field(..., description="Descripción del nivel de riesgo")
    approved_contracts: int = Field(..., description="Número de contratos aprobados en este tramo")
    approved_share_pct: float = Field(..., description="Participación porcentual sobre el portafolio aprobado")
    approved_volume_mxn: float = Field(..., description="Saldo/Volumen colocado en MXN")
    expected_pd_pct: float = Field(..., description="Probabilidad de Incumplimiento promedio ponderada (%)")
    observed_default_rate_pct: float = Field(..., description="Tasa de default real observada históricamente (%)")
    minimum_reserve_pct: float = Field(..., description="Tasa de reserva preventiva regulatoria (%)")
    reserve_amount_mxn: float = Field(..., description="Monto estimado de reservas preventivas obligatorias en MXN")

class PortfolioSimulationResponse(BaseModel):
    """Resultados agregados financieros y de riesgo de la simulación de cartera."""

    # Parámetros aplicados
    cutoff_score: int = Field(..., description="Punto de corte utilizado")
    applied_interest_rate: float = Field(..., description="Tasa de interés aplicada")
    applied_funding_cost: float = Field(..., description="Costo de fondeo aplicado")
    applied_lgd: float = Field(..., description="LGD aplicado")

    # Volumetría de colocación
    total_applications: int = Field(..., description="Total de solicitudes analizadas en el portafolio de prueba")
    approved_contracts: int = Field(..., description="Número de contratos aprobados")
    rejected_contracts: int = Field(..., description="Número de contratos rechazados")
    approval_rate_pct: float = Field(..., description="Tasa de aprobación porcentual")

    # Importes monetarios
    total_requested_volume_mxn: float = Field(..., description="Volumen total solicitado en MXN")
    approved_volume_mxn: float = Field(..., description="Volumen total aprobado y colocado en MXN")
    rejected_volume_mxn: float = Field(..., description="Volumen rechazado en MXN")

    # Métricas de riesgo de cartera
    expected_portfolio_pd_pct: float = Field(..., description="Probabilidad de mora promedio proyectada de la cartera (%)")
    observed_default_rate_pct: float = Field(..., description="Tasa de mora histórica real en la cartera aprobada (%)")
    total_expected_loss_mxn: float = Field(..., description="Pérdida Esperada total en MXN (EL = SUM(PD * LGD * EAD))")
    expected_loss_ratio_pct: float = Field(..., description="Pérdida Esperada como porcentaje del volumen colocado (%)")

    # Estado de resultados proyectado (P&L del portafolio)
    gross_interest_income_mxn: float = Field(..., description="Ingresos brutos por intereses proyectados anuales en MXN")
    funding_expenses_mxn: float = Field(..., description="Costo financiero de fondeo proyectado en MXN")
    net_financial_margin_mxn: float = Field(..., description="Margen Financiero Neto (Ingresos - Fondeo - Pérdida Esperada)")
    net_margin_ratio_pct: float = Field(..., description="Retorno neto anualizado sobre cartera colocada (ROA crediticio %)")

    # Distribución regulatoria
    cnbv_distribution: List[CNBVSummaryItem] = Field(..., description="Desglose por tramos regulatorios de la CNBV")
    total_regulatory_reserves_mxn: float = Field(..., description="Total de reservas preventivas obligatorias CUB")

    # Desempeño computacional
    simulation_time_ms: float = Field(..., description="Tiempo de cómputo de la simulación en milisegundos")

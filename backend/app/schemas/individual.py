"""Schemas Pydantic para el endpoint de evaluación crediticia individual."""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

class IndividualScoreRequest(BaseModel):
    """Payload de entrada con los datos del solicitante de crédito."""

    person_age: int = Field(..., ge=18, le=100, description="Edad del solicitante en años", examples=[29])
    person_income_mxn: float = Field(..., gt=0, description="Ingreso anual bruto en Pesos Mexicanos (MXN)", examples=[240000.0])
    monthly_income_mxn: Optional[float] = Field(None, gt=0, description="Ingreso mensual neto en MXN (opcional, calculado si no se provee)", examples=[20000.0])
    person_home_ownership: Literal["RENT", "OWN", "MORTGAGE", "OTHER"] = Field(
        ..., description="Régimen patrimonial de vivienda", examples=["RENT"]
    )
    person_emp_length: Optional[float] = Field(
        None, ge=0, le=60, description="Antigüedad laboral en años (None para solicitantes Thin-File / sector informal)", examples=[3.5]
    )
    loan_intent: Literal["PERSONAL", "EDUCATION", "MEDICAL", "VENTURE", "HOMEIMPROVEMENT", "DEBTCONSOLIDATION"] = Field(
        ..., description="Destino del financiamiento", examples=["PERSONAL"]
    )
    loan_amnt_mxn: float = Field(..., gt=0, description="Monto del crédito solicitado en MXN", examples=[35000.0])
    loan_int_rate: Optional[float] = Field(None, ge=0, le=100, description="Tasa de interés pactada % (opcional, se imputa si es None)", examples=[12.5])
    loan_percent_income: Optional[float] = Field(
        None, ge=0.0, le=1.5, description="Ratio Capacidad de Pago / DTI (calculado automáticamente si es None)", examples=[0.1458]
    )
    cb_person_default_on_file: Literal["Y", "N"] = Field(
        ..., description="Marca histórica de morosidad grave en Buró de Crédito (MOP-04 o superior)", examples=["N"]
    )
    cb_person_cred_hist_length: int = Field(
        ..., ge=0, le=60, description="Antigüedad de la cuenta más antigua en Buró en años", examples=[4]
    )

    @model_validator(mode="after")
    def compute_derived_fields(self):
        """Calcula el ingreso mensual y el DTI si no fueron provistos explícitamente."""
        if self.monthly_income_mxn is None and self.person_income_mxn > 0:
            self.monthly_income_mxn = round(self.person_income_mxn / 12.0, 2)
        
        if self.loan_percent_income is None and self.person_income_mxn > 0:
            self.loan_percent_income = round(self.loan_amnt_mxn / self.person_income_mxn, 4)

        return self

class RiskFactorDetail(BaseModel):
    """Detalle de impacto de una variable individual en el score del solicitante."""

    feature: str = Field(..., description="Nombre del atributo")
    value: Any = Field(..., description="Valor observado del atributo")
    impact: Literal["FAVORABLE", "DESFAVORABLE"] = Field(..., description="Dirección del impacto en la solvencia")
    description: str = Field(..., description="Explicación cualitativa comprensible para el usuario")
    points_contribution: Optional[float] = Field(None, description="Puntos otorgados en el Scorecard")
    shap_impact: Optional[float] = Field(None, description="Magnitud de contribución local SHAP")

class IndividualScoreResponse(BaseModel):
    """Resultado integral de la evaluación crediticia individual."""

    # Identificadores y métricas de score
    credit_score: int = Field(..., ge=300, le=850, description="Puntuación en escala estándar de Buró de Crédito")
    probability_of_default: float = Field(..., ge=0.0, le=1.0, description="Probabilidad de Incumplimiento estimada (PD)")
    pd_percentage: float = Field(..., description="PD expresada en porcentaje (0% a 100%)")

    # Dictamen y semáforo de originación
    decision: Literal["APROBADO", "REVISIÓN MANUAL", "RECHAZADO"] = Field(..., description="Dictamen de originación de crédito")
    decision_color: str = Field(..., description="Código hexadecimal para UI (verde, amarillo o rojo)")
    policy_veto_applied: bool = Field(..., description="Indica si se aplicó un veto directo de política de crédito")

    # Calificación regulatoria CNBV (Circular Única de Bancos)
    cnbv_rating: str = Field(..., description="Grado de calificación crediticia según la CUB (A-1 a E)")
    cnbv_description: str = Field(..., description="Descripción del nivel de riesgo regulatorio")
    cnbv_minimum_reserve_pct: float = Field(..., description="Porcentaje de reserva preventiva obligatoria por CNBV")

    # Métricas financieras del contrato
    loan_amnt_mxn: float = Field(..., description="Monto del préstamo solicitado en MXN")
    expected_loss_mxn: float = Field(..., description="Pérdida Esperada en Pesos Mexicanos (EL = PD x LGD x EAD)")
    dti_ratio: float = Field(..., description="Capacidad de pago DTI del solicitante")
    dti_exceeded_limit: bool = Field(..., description="Indica si supera el umbral prudencial del 40%")

    # Explicabilidad y justificación ante CONDUSEF
    key_positive_factors: List[RiskFactorDetail] = Field(..., description="Factores que mayor puntaje positivo aportaron")
    key_risk_factors: List[RiskFactorDetail] = Field(..., description="Factores de mayor riesgo o penalización")
    adverse_action_reasons: List[str] = Field(..., description="Motivos fundados de la decisión para notificación al cliente")
    points_breakdown: Optional[Dict[str, float]] = Field(None, description="Desglose de puntos por cada variable del Scorecard")

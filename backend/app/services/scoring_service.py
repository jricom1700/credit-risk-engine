"""Servicio de evaluación crediticia individual (Inferencia Scorecard + SHAP)."""

from typing import Dict, List, Optional
import joblib
import numpy as np
import pandas as pd

from app.config import settings
from app.schemas.individual import (
    IndividualScoreRequest,
    IndividualScoreResponse,
    RiskFactorDetail,
)
from app.services.cnbv_rules import get_cnbv_rating

FEATURE_DESCRIPTIONS: Dict[str, str] = {
    "loan_percent_income": "Capacidad de pago / Apalancamiento (DTI)",
    "person_income_mxn": "Nivel de ingreso anual comprobable",
    "person_home_ownership": "Régimen de vivienda y arraigo patrimonial",
    "person_emp_length": "Antigüedad y estabilidad laboral",
    "cb_person_default_on_file": "Historial de mora grave en Buró de Crédito",
    "loan_intent": "Destino o propósito del financiamiento",
    "loan_amnt_mxn": "Monto del préstamo solicitado",
    "loan_int_rate_imputed": "Tasa de interés de colocación",
    "cb_person_cred_hist_length": "Antigüedad del expediente en Buró de Crédito",
    "person_age": "Edad del solicitante",
}

class ScoringService:
    """Orquestador de inferencia y reglas de decisión para originación individual."""

    def __init__(self):
        self.bundle: Optional[dict] = None
        self.scorecard = None
        self.challenger_tree = None
        self.shap_explainer = None
        self.features: List[str] = []
        self.categorical_features: List[str] = []

    def load_model(self) -> None:
        """Carga el bundle serializado del pipeline desde disco a memoria."""
        if not settings.MODEL_PATH.exists():
            raise FileNotFoundError(
                f"No se encontró el pipeline serializado en: {settings.MODEL_PATH}"
            )
        self.bundle = joblib.load(settings.MODEL_PATH)
        self.scorecard = self.bundle["champion_scorecard"]
        self.challenger_tree = self.bundle["challenger_base_tree"]
        self.shap_explainer = self.bundle["shap_explainer"]
        self.features = self.bundle["features"]
        self.categorical_features = self.bundle["categorical_features"]

    def score_individual(self, request: IndividualScoreRequest) -> IndividualScoreResponse:
        """Evalúa un solicitante y retorna el dictamen, score, pérdida esperada y factores explicativos."""
        if self.bundle is None:
            self.load_model()

        # Construcción del DataFrame para inferencia
        # Imputación de tasa de interés si no fue provista (mediana de cartera: 11.5%)
        int_rate = request.loan_int_rate if request.loan_int_rate is not None else 11.5

        emp_len = np.nan if request.person_emp_length is None else float(request.person_emp_length)

        raw_data = {
            "person_age": [int(request.person_age)],
            "person_income_mxn": [float(request.person_income_mxn)],
            "person_home_ownership": [request.person_home_ownership],
            "person_emp_length": [emp_len],
            "loan_intent": [request.loan_intent],
            "loan_amnt_mxn": [float(request.loan_amnt_mxn)],
            "loan_int_rate_imputed": [float(int_rate)],
            "loan_percent_income": [float(request.loan_percent_income)],
            "cb_person_default_on_file": [request.cb_person_default_on_file],
            "cb_person_cred_hist_length": [int(request.cb_person_cred_hist_length)],
        }
        df_input = pd.DataFrame(raw_data)
        df_input["person_emp_length"] = df_input["person_emp_length"].astype(np.float64)

        # 1. Inferencia del Modelo Champion (Scorecard WoE + LR)
        score_val = float(self.scorecard.score(df_input)[0])
        pd_val = float(self.scorecard.predict_proba(df_input)[:, 1][0])
        credit_score = int(np.round(score_val))

        # 2. Desglose de puntos del Scorecard
        df_points = self.scorecard.transform(df_input)

        # 3. Explicabilidad Local SHAP sobre el árbol de gradiente
        df_shap = df_input.copy()
        for cat_col in self.categorical_features:
            df_shap[cat_col] = df_shap[cat_col].astype("category")
        
        shap_res = self.shap_explainer(df_shap)
        shap_values = shap_res[0].values

        # 4. Calificación regulatoria CNBV
        cnbv_rating, cnbv_res_pct, cnbv_desc = get_cnbv_rating(pd_val)

        # 5. Cálculo de Pérdida Esperada (EL = PD * LGD * EAD)
        expected_loss = pd_val * settings.DEFAULT_LGD * request.loan_amnt_mxn

        # 6. Evaluación de Vetos y Decisión de Política de Crédito
        dti_exceeded = request.loan_percent_income > settings.DTI_MAX_LIMIT
        policy_veto = False
        adverse_reasons: List[str] = []

        if dti_exceeded:
            policy_veto = True
            adverse_reasons.append(
                f"Capacidad de pago comprometida: El ratio DTI ({request.loan_percent_income*100:.1f}%) "
                f"supera el límite prudencial máximo permitido ({settings.DTI_MAX_LIMIT*100:.0f}%)."
            )
        
        if request.cb_person_default_on_file == "Y" and credit_score < 560:
            policy_veto = True
            adverse_reasons.append(
                "Antecedente de morosidad grave (MOP-04+) registrado en Buró de Crédito "
                "con puntaje crediticio insuficiente para mitigación de riesgo."
            )

        # Semáforo de decisión
        if policy_veto:
            decision = "RECHAZADO"
            decision_color = "#ef4444"
        elif credit_score >= settings.SCORE_THRESHOLD_APPROVE:
            decision = "APROBADO"
            decision_color = "#10b981"
        elif credit_score >= settings.SCORE_THRESHOLD_REVIEW:
            decision = "REVISIÓN MANUAL"
            decision_color = "#f59e0b"
        else:
            decision = "RECHAZADO"
            decision_color = "#ef4444"

        # 7. Selección de los 3 factores positivos y 3 factores de riesgo
        factors_list = []
        for i, feat in enumerate(self.features):
            val = df_input[feat].values[0]
            if hasattr(val, "item"):
                val = val.item()
            elif pd.isna(val):
                val = None

            pts = float(df_points[feat].values[0])
            shap_v = float(shap_values[i])

            # En SHAP para morosidad: shap_v < 0 reduce riesgo (favorable), shap_v > 0 aumenta riesgo (desfavorable)
            is_favorable = shap_v < 0
            impact_label = "FAVORABLE" if is_favorable else "DESFAVORABLE"
            
            factors_list.append({
                "feature": feat,
                "value": val,
                "impact": impact_label,
                "description": FEATURE_DESCRIPTIONS.get(feat, feat),
                "points_contribution": round(pts, 1),
                "shap_impact": round(shap_v, 4),
            })

        # Factores favorables: menor valor SHAP (más negativo)
        positive_factors_sorted = sorted(
            [f for f in factors_list if f["impact"] == "FAVORABLE"],
            key=lambda x: x["shap_impact"]
        )[:3]

        # Factores de riesgo: mayor valor SHAP (más positivo)
        risk_factors_sorted = sorted(
            [f for f in factors_list if f["impact"] == "DESFAVORABLE"],
            key=lambda x: x["shap_impact"],
            reverse=True
        )[:3]

        # Si fue rechazado o requiere revisión manual y no hay razones de veto, agregar los factores de riesgo principales
        if decision in ("RECHAZADO", "REVISIÓN MANUAL") and not adverse_reasons:
            for rf in risk_factors_sorted:
                adverse_reasons.append(
                    f"{rf['description']}: Nivel observado ({rf['value']}) representa un factor de atención o riesgo para el perfil."
                )

        points_breakdown = {
            feat: round(float(df_points[feat].values[0]), 1) for feat in self.features
        }

        return IndividualScoreResponse(
            credit_score=credit_score,
            probability_of_default=round(pd_val, 4),
            pd_percentage=round(pd_val * 100, 2),
            decision=decision,
            decision_color=decision_color,
            policy_veto_applied=policy_veto,
            cnbv_rating=cnbv_rating,
            cnbv_description=cnbv_desc,
            cnbv_minimum_reserve_pct=round(cnbv_res_pct * 100, 2),
            loan_amnt_mxn=round(request.loan_amnt_mxn, 2),
            expected_loss_mxn=round(expected_loss, 2),
            dti_ratio=round(request.loan_percent_income, 4),
            dti_exceeded_limit=dti_exceeded,
            key_positive_factors=[RiskFactorDetail(**f) for f in positive_factors_sorted],
            key_risk_factors=[RiskFactorDetail(**f) for f in risk_factors_sorted],
            adverse_action_reasons=adverse_reasons,
            points_breakdown=points_breakdown,
        )

# Instancia singleton del servicio
scoring_service = ScoringService()

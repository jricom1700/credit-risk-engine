"""Servicio de simulación vectorizada de estrategias de portafolio y rentabilidad."""

import time
from typing import List, Optional
import numpy as np
import pandas as pd

from app.config import settings
from app.schemas.portfolio import (
    CNBVSummaryItem,
    PortfolioSimulationRequest,
    PortfolioSimulationResponse,
)
from app.services.cnbv_rules import CNBV_RATING_MATRIX, assign_cnbv_ratings_vectorized

class PortfolioService:
    """Simulador en memoria RAM para optimización de puntos de corte y márgenes financieros."""

    def __init__(self):
        self.df_portfolio: Optional[pd.DataFrame] = None

    def load_portfolio_data(self) -> None:
        """Carga el dataset de prueba calificado a la memoria RAM."""
        if not settings.TEST_PORTFOLIO_PATH.exists():
            raise FileNotFoundError(
                f"No se encontró el portafolio calificado en: {settings.TEST_PORTFOLIO_PATH}"
            )
        self.df_portfolio = pd.read_parquet(settings.TEST_PORTFOLIO_PATH)

    def simulate(self, request: PortfolioSimulationRequest) -> PortfolioSimulationResponse:
        """Ejecuta la simulación vectorizada sobre el portafolio precargado en memoria."""
        if self.df_portfolio is None:
            self.load_portfolio_data()

        t_start = time.perf_counter()

        df = self.df_portfolio
        total_apps = len(df)
        total_requested_vol = float(df["loan_amnt_mxn"].sum())

        # Filtrado vectorial por punto de corte
        approved_mask = df["credit_score"] >= request.cutoff_score
        df_app = df[approved_mask]

        approved_count = len(df_app)
        rejected_count = total_apps - approved_count
        approval_rate = (approved_count / total_apps * 100.0) if total_apps > 0 else 0.0

        approved_vol = float(df_app["loan_amnt_mxn"].sum()) if approved_count > 0 else 0.0
        rejected_vol = total_requested_vol - approved_vol

        if approved_count > 0:
            # Métricas de riesgo de la cartera aprobada
            # PD ponderada por monto de crédito
            expected_pd_weighted = float(
                (df_app["pd"] * df_app["loan_amnt_mxn"]).sum() / approved_vol * 100.0
            )
            observed_default_rate = float(df_app["loan_status"].mean() * 100.0)

            # Pérdida Esperada acumulada (EL = PD * LGD * EAD)
            total_el = float((df_app["pd"] * request.lgd * df_app["loan_amnt_mxn"]).sum())
            el_ratio = (total_el / approved_vol * 100.0) if approved_vol > 0 else 0.0

            # Estado de resultados proyectado (P&L)
            gross_interest = approved_vol * request.interest_rate
            funding_cost = approved_vol * request.funding_cost
            net_financial_margin = gross_interest - funding_cost - total_el
            net_margin_ratio = (net_financial_margin / approved_vol * 100.0) if approved_vol > 0 else 0.0

            # Desglose por calificación regulatoria CNBV
            cnbv_ratings_app = assign_cnbv_ratings_vectorized(df_app["pd"].values)
            df_app_calc = df_app.copy()
            df_app_calc["rating"] = cnbv_ratings_app

            cnbv_distribution: List[CNBVSummaryItem] = []
            total_regulatory_reserves = 0.0

            # Agrupación por tramos CNBV
            for bucket in CNBV_RATING_MATRIX:
                r_grade = str(bucket["grade"])
                r_desc = str(bucket["description"])
                r_min_res = float(bucket["min_reserve"])

                subset = df_app_calc[df_app_calc["rating"] == r_grade]
                cnt = len(subset)
                if cnt > 0:
                    sub_vol = float(subset["loan_amnt_mxn"].sum())
                    sub_pd = float((subset["pd"] * subset["loan_amnt_mxn"]).sum() / sub_vol * 100.0)
                    sub_obs_dr = float(subset["loan_status"].mean() * 100.0)
                    sub_res_amt = sub_vol * r_min_res
                else:
                    sub_vol = 0.0
                    sub_pd = 0.0
                    sub_obs_dr = 0.0
                    sub_res_amt = 0.0

                total_regulatory_reserves += sub_res_amt

                cnbv_distribution.append(
                    CNBVSummaryItem(
                        rating=r_grade,
                        description=r_desc,
                        approved_contracts=cnt,
                        approved_share_pct=round((cnt / approved_count * 100.0) if approved_count > 0 else 0.0, 2),
                        approved_volume_mxn=round(sub_vol, 2),
                        expected_pd_pct=round(sub_pd, 2),
                        observed_default_rate_pct=round(sub_obs_dr, 2),
                        minimum_reserve_pct=round(r_min_res * 100.0, 2),
                        reserve_amount_mxn=round(sub_res_amt, 2),
                    )
                )

        else:
            expected_pd_weighted = 0.0
            observed_default_rate = 0.0
            total_el = 0.0
            el_ratio = 0.0
            gross_interest = 0.0
            funding_cost = 0.0
            net_financial_margin = 0.0
            net_margin_ratio = 0.0
            cnbv_distribution = []
            total_regulatory_reserves = 0.0

        simulation_time_ms = (time.perf_counter() - t_start) * 1000.0

        return PortfolioSimulationResponse(
            cutoff_score=request.cutoff_score,
            applied_interest_rate=request.interest_rate,
            applied_funding_cost=request.funding_cost,
            applied_lgd=request.lgd,
            total_applications=total_apps,
            approved_contracts=approved_count,
            rejected_contracts=rejected_count,
            approval_rate_pct=round(approval_rate, 2),
            total_requested_volume_mxn=round(total_requested_vol, 2),
            approved_volume_mxn=round(approved_vol, 2),
            rejected_volume_mxn=round(rejected_vol, 2),
            expected_portfolio_pd_pct=round(expected_pd_weighted, 2),
            observed_default_rate_pct=round(observed_default_rate, 2),
            total_expected_loss_mxn=round(total_el, 2),
            expected_loss_ratio_pct=round(el_ratio, 2),
            gross_interest_income_mxn=round(gross_interest, 2),
            funding_expenses_mxn=round(funding_cost, 2),
            net_financial_margin_mxn=round(net_financial_margin, 2),
            net_margin_ratio_pct=round(net_margin_ratio, 2),
            cnbv_distribution=cnbv_distribution,
            total_regulatory_reserves_mxn=round(total_regulatory_reserves, 2),
            simulation_time_ms=round(simulation_time_ms, 2),
        )

# Instancia singleton del servicio
portfolio_service = PortfolioService()

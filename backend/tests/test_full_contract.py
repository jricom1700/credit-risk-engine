"""Test de integración de contrato completo Frontend-Backend."""

import sys
from pathlib import Path
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app

def test_full_contract_verification():
    with TestClient(app) as client:
        # 1. Health check
        res_health = client.get("/health")
        assert res_health.status_code == 200, "Health check falló"
        health_data = res_health.json()
        assert health_data["status"] == "healthy"
        assert health_data["model_loaded"] == "True"
        assert health_data["portfolio_cached"] == "True"
        print("  ✓ [1/5] Health Check verificado")

        # 2. Metadata
        res_meta = client.get("/api/v1/model-metadata")
        assert res_meta.status_code == 200
        meta_data = res_meta.json()
        assert "validation_metrics" in meta_data
        print("  ✓ [2/5] Metadatos del Modelo verificados")

        # 3. Scorecard Table
        res_sc = client.get("/api/v1/scorecard-table")
        assert res_sc.status_code == 200
        sc_data = res_sc.json()
        assert sc_data["total_bins"] > 0
        print("  ✓ [3/5] Tabla de Scorecard verificada")

        # 4. Individual Score (Contrato UnderwritingView.jsx)
        score_payload = {
            "person_age": 32,
            "person_income_mxn": 300000.0,
            "person_home_ownership": "OWN",
            "person_emp_length": 5.0,
            "loan_intent": "PERSONAL",
            "loan_amnt_mxn": 25000.0,
            "loan_int_rate": 12.0,
            "cb_person_default_on_file": "N",
            "cb_person_cred_hist_length": 5
        }
        res_score = client.post("/api/v1/score", json=score_payload)
        assert res_score.status_code == 200, f"Error en scoring: {res_score.text}"
        score_res = res_score.json()

        # Validar campos exactos consumidos por el componente UnderwritingView.jsx
        assert "credit_score" in score_res and isinstance(score_res["credit_score"], int)
        assert "probability_of_default" in score_res
        assert "decision" in score_res and score_res["decision"] in ["APROBADO", "REVISIÓN MANUAL", "RECHAZADO"]
        assert "cnbv_rating" in score_res and score_res["cnbv_rating"].startswith(("A", "B", "C", "D", "E"))
        assert "cnbv_minimum_reserve_pct" in score_res
        assert "expected_loss_mxn" in score_res
        assert "key_positive_factors" in score_res and isinstance(score_res["key_positive_factors"], list)
        if len(score_res["key_positive_factors"]) > 0:
            first_pos = score_res["key_positive_factors"][0]
            assert "description" in first_pos
            assert "points_contribution" in first_pos
        assert "adverse_action_reasons" in score_res and isinstance(score_res["adverse_action_reasons"], list)
        assert "points_breakdown" in score_res and isinstance(score_res["points_breakdown"], dict)
        assert len(score_res["points_breakdown"]) == 10
        print("  ✓ [4/5] Contrato de Evaluación Individual (UnderwritingView) 100% verificado")

        # 5. Portfolio Simulation (Contrato PortfolioStrategyView.jsx)
        sim_payload = {
            "cutoff_score": 560,
            "interest_rate": 0.35,
            "funding_cost": 0.11,
            "lgd": 0.45
        }
        res_sim = client.post("/api/v1/simulate-portfolio", json=sim_payload)
        assert res_sim.status_code == 200, f"Error en simulación: {res_sim.text}"
        sim_res = res_sim.json()

        # Validar campos exactos consumidos por el componente PortfolioStrategyView.jsx
        assert "gross_interest_income_mxn" in sim_res and sim_res["gross_interest_income_mxn"] > 0
        assert "funding_expenses_mxn" in sim_res and sim_res["funding_expenses_mxn"] > 0
        assert "net_financial_margin_mxn" in sim_res and sim_res["net_financial_margin_mxn"] > 0
        assert "total_regulatory_reserves_mxn" in sim_res and sim_res["total_regulatory_reserves_mxn"] > 0
        assert "approved_volume_mxn" in sim_res and sim_res["approved_volume_mxn"] > 0
        assert "cnbv_distribution" in sim_res and len(sim_res["cnbv_distribution"]) == 8

        first_cnbv = sim_res["cnbv_distribution"][0]
        assert "rating" in first_cnbv
        assert "description" in first_cnbv
        assert "approved_contracts" in first_cnbv
        assert "approved_share_pct" in first_cnbv
        assert "approved_volume_mxn" in first_cnbv
        assert "minimum_reserve_pct" in first_cnbv
        assert "reserve_amount_mxn" in first_cnbv
        print("  ✓ [5/5] Contrato de Simulación de Portafolio (PortfolioStrategyView) 100% verificado")

if __name__ == "__main__":
    print("=== Ejecutando Prueba Integral de Contrato de Datos Frontend <-> Backend ===")
    test_full_contract_verification()
    print("=== Todas las validaciones de contrato pasaron exitosamente ===")

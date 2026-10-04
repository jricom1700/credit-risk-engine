import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Asegurar que el backend esté en el sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app

def test_health_check():
    """Verifica que el servicio esté saludable y con los modelos precargados."""
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["model_loaded"] == "True"
        assert data["portfolio_cached"] == "True"

def test_root_info():
    """Verifica la información en la ruta raíz."""
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "docs" in data
        assert data["version"] == "1.0.0"

def test_model_metadata():
    """Verifica que los metadatos del modelo retornen métricas de validación."""
    with TestClient(app) as client:
        response = client.get("/api/v1/model-metadata")
        assert response.status_code == 200
        data = response.json()
        assert "validation_metrics" in data
        metrics = data["validation_metrics"]
        assert metrics["champion_auc"] >= 0.85
        assert metrics["champion_ks"] >= 50.0
        assert len(data["features"]) == 10

def test_scorecard_table():
    """Verifica que la tabla de asignación de puntos esté disponible."""
    with TestClient(app) as client:
        response = client.get("/api/v1/scorecard-table")
        assert response.status_code == 200
        data = response.json()
        assert data["total_bins"] > 0
        assert len(data["bins"]) == data["total_bins"]

def test_score_individual_prime_approved():
    """Evalúa un solicitante Prime: perfil solvente que debe ser APROBADO."""
    payload = {
        "person_age": 35,
        "person_income_mxn": 480000.0,  # $40,000 MXN mensuales
        "person_home_ownership": "OWN",
        "person_emp_length": 8.0,
        "loan_intent": "VENTURE",
        "loan_amnt_mxn": 40000.0,
        "loan_int_rate": 9.5,
        "cb_person_default_on_file": "N",
        "cb_person_cred_hist_length": 8
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/score", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["credit_score"] >= 580
        assert data["decision"] == "APROBADO"
        assert data["decision_color"] == "#10b981"
        assert data["policy_veto_applied"] is False
        assert data["cnbv_rating"] in ["A-1", "A-2", "B-1"]
        assert data["dti_exceeded_limit"] is False
        assert data["expected_loss_mxn"] > 0
        assert len(data["key_positive_factors"]) > 0

def test_score_individual_high_risk_rejected():
    """Evalúa un solicitante de Alto Riesgo: DTI > 40% y mora grave en Buró (RECHAZADO)."""
    payload = {
        "person_age": 22,
        "person_income_mxn": 100000.0,
        "person_home_ownership": "RENT",
        "person_emp_length": 1.0,
        "loan_intent": "DEBTCONSOLIDATION",
        "loan_amnt_mxn": 50000.0,  # DTI = 50% (supera el límite del 40%)
        "loan_int_rate": 18.5,
        "cb_person_default_on_file": "Y",
        "cb_person_cred_hist_length": 2
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/score", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["decision"] == "RECHAZADO"
        assert data["decision_color"] == "#ef4444"
        assert data["policy_veto_applied"] is True
        assert data["dti_exceeded_limit"] is True
        assert data["cnbv_rating"] in ["D", "E", "C-2"]
        assert len(data["adverse_action_reasons"]) > 0

def test_score_individual_thin_file():
    """Evalúa un solicitante Thin File (sin antigüedad laboral reportada)."""
    payload = {
        "person_age": 25,
        "person_income_mxn": 180000.0,
        "person_home_ownership": "RENT",
        "person_emp_length": None,  # Thin-File
        "loan_intent": "PERSONAL",
        "loan_amnt_mxn": 20000.0,
        "loan_int_rate": None,  # Deberá imputarse automáticamente
        "cb_person_default_on_file": "N",
        "cb_person_cred_hist_length": 3
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/score", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert 300 <= data["credit_score"] <= 850
        assert 0.0 <= data["probability_of_default"] <= 1.0

def test_simulate_portfolio_baseline():
    """Evalúa la simulación de portafolio con parámetros de negocio estándar."""
    payload = {
        "cutoff_score": 560,
        "interest_rate": 0.35,
        "funding_cost": 0.11,
        "lgd": 0.45
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/simulate-portfolio", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_applications"] == 9773
        assert data["approved_contracts"] > 0
        assert data["rejected_contracts"] > 0
        assert data["approved_contracts"] + data["rejected_contracts"] == 9773
        assert data["approval_rate_pct"] > 0
        assert data["approved_volume_mxn"] > 0
        assert data["net_financial_margin_mxn"] > 0
        assert data["net_margin_ratio_pct"] > 0
        assert len(data["cnbv_distribution"]) == 8
        assert data["simulation_time_ms"] < 100.0  # Respuesta sub-100ms

def test_simulate_portfolio_cutoff_sensitivity():
    """Verifica que un punto de corte más estricto reduzca la aprobación y la tasa de mora."""
    with TestClient(app) as client:
        # Corte permisivo
        res_low = client.post("/api/v1/simulate-portfolio", json={"cutoff_score": 450})
        # Corte restrictivo
        res_high = client.post("/api/v1/simulate-portfolio", json={"cutoff_score": 620})
        
        data_low = res_low.json()
        data_high = res_high.json()
        
        # El corte restrictivo debe aprobar menos contratos
        assert data_high["approved_contracts"] < data_low["approved_contracts"]
        # El corte restrictivo debe tener menor probabilidad de default proyectada
        assert data_high["expected_portfolio_pd_pct"] < data_low["expected_portfolio_pd_pct"]

if __name__ == "__main__":
    tests = [
        ("Health Check", test_health_check),
        ("Root Info", test_root_info),
        ("Model Metadata", test_model_metadata),
        ("Scorecard Table", test_scorecard_table),
        ("Individual Score: Prime Approved", test_score_individual_prime_approved),
        ("Individual Score: High Risk Rejected", test_score_individual_high_risk_rejected),
        ("Individual Score: Thin File Handled", test_score_individual_thin_file),
        ("Portfolio Simulation: Baseline", test_simulate_portfolio_baseline),
        ("Portfolio Simulation: Cutoff Sensitivity", test_simulate_portfolio_cutoff_sensitivity),
    ]

    print(f"=== Iniciando ejecución de {len(tests)} pruebas de integración de API ===")
    passed = 0
    for name, test_func in tests:
        try:
            test_func()
            print(f"  ✓ {name}: PASÓ")
            passed += 1
        except Exception as e:
            print(f"  ✗ {name}: FALLÓ ({e})")
            raise e

    print(f"\nResultado final: {passed}/{len(tests)} pruebas pasaron exitosamente.")

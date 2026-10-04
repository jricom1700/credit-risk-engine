# Directrices del Proyecto: Credit Decisioning & Risk Strategy Engine (México)

## 1. Entorno de Ejecución y Herramientas
- **Gestor de paquetes:** Miniforge / Conda.
- **Entorno virtual:** `risk-env` (Python 3.11).
- **Regla estricta:** NUNCA crees nuevos entornos virtuales (`venv` o `.venv`). Utiliza siempre el intérprete y librerías del entorno activo `risk-env`.
- **Comandos de terminal:** Si requieres instalar paquetes adicionales, usa `pip` dentro de `risk-env` y actualiza `backend/requirements.txt`.

## 2. Contexto de Negocio y Dominio (Riesgo de Crédito en México)
- **Regulación:** Normativa de la CNBV (Circular Única de Bancos - CUB) y estándares de Sociedades de Información Crediticia (Buró de Crédito / Círculo de Crédito).
- **Moneda:** Todos los importes financieros (`person_income`, `loan_amnt`) deben manejarse y visualizarse en Pesos Mexicanos (MXN).
- **Terminología de Buró:**
  - `cb_person_default_on_file`: Interpretar como antecedente de mora grave / quebranto (`MOP-04` o superior).
  - `loan_percent_income`: Capacidad de pago / DTI (Debt-to-Income), con límite prudencial típico del 30%-40%.
  - `cb_person_cred_hist_length`: Antigüedad de la cuenta más antigua en Buró.
- **Métricas obligatorias de riesgo:** Evaluar modelos con **AUC-ROC**, **Gini** ($2 \times \text{AUC} - 1$), **Kolmogorov-Smirnov (KS)**, y análisis de estabilidad con **PSI (Population Stability Index)**. No basar decisiones en Accuracy simple.
- **Enfoque de Negocio:** Siempre conectar la probabilidad de impago con el cálculo de Pérdida Esperada ($EL = PD \times LGD \times EAD$) y el impacto en el margen financiero.

## 3. Estructura de Directorios
- `data/raw/`: Datos originales inmutables (`credit_risk_dataset.csv`).
- `data/processed/`: Datasets limpios y transformados (`.parquet` o `.csv`).
- `notebooks/`: Experimentación, EDA, WoE/IV y entrenamiento de modelos con OptBinning.
- `backend/app/`: API REST con FastAPI (Pydantic, endpoints `/score` y `/simulate`, modelos `.joblib`).
- `frontend/`: Aplicación de interfaz con React (Vite + Tailwind CSS).
- `docs/`: Documentación metodológica y memorándum de riesgos.

## 4. Estándares de Código y Entregables
- Código modular, limpio y tipado (`type hints`).
- Comentarios y docstrings explicando la justificación económica/financiera detrás de cada decisión técnica.
- No dejar archivos temporales ni código muerto en la raíz del proyecto.
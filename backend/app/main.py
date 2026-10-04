import sys
from pathlib import Path

# Asegurar que el directorio backend/ esté en el sys.path sin importar desde dónde se invoque
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from contextlib import asynccontextmanager
import logging
from typing import Dict
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.endpoints import router as api_v1_router
from app.services.scoring_service import scoring_service
from app.services.portfolio_service import portfolio_service

# Configuración de logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("credit_risk_engine")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicación: precarga de modelos y datos en RAM al iniciar."""
    logger.info("=== Inicializando Credit Risk Decisioning Engine ===")
    
    # 1. Precarga del modelo Champion / Challenger / SHAP
    logger.info(f"Cargando modelo serializado desde {settings.MODEL_PATH}...")
    try:
        scoring_service.load_model()
        logger.info("✓ Pipeline de scoring cargado exitosamente en memoria.")
    except Exception as e:
        logger.error(f"✗ Error al cargar el modelo serializado: {e}")
        raise e

    # 2. Precarga de la cartera de prueba para simulación interactiva
    logger.info(f"Precargando cartera de prueba en RAM desde {settings.TEST_PORTFOLIO_PATH}...")
    try:
        portfolio_service.load_portfolio_data()
        n_records = len(portfolio_service.df_portfolio) if portfolio_service.df_portfolio is not None else 0
        logger.info(f"✓ Cartera de simulación lista en memoria ({n_records:,} contratos).")
    except Exception as e:
        logger.error(f"✗ Error al cargar la cartera de simulación: {e}")
        raise e

    logger.info("=== Motor de Crédito listo para recibir peticiones ===")
    yield
    logger.info("=== Apagando Credit Risk Decisioning Engine ===")

# Instancia de FastAPI
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description=settings.API_DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuración de CORS para permitir la conexión desde el frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montaje de las rutas v1
app.include_router(api_v1_router)

@app.get(
    "/health",
    status_code=status.HTTP_200_OK,
    tags=["Monitoreo"],
    summary="Verificación de Salud del Servicio"
)
def health_check() -> Dict[str, str]:
    """Retorna el estado de disponibilidad del motor y sus artefactos."""
    model_ready = scoring_service.bundle is not None
    portfolio_ready = portfolio_service.df_portfolio is not None
    return {
        "status": "healthy" if (model_ready and portfolio_ready) else "degraded",
        "engine": settings.API_TITLE,
        "version": settings.API_VERSION,
        "model_loaded": str(model_ready),
        "portfolio_cached": str(portfolio_ready)
    }

@app.get(
    "/",
    status_code=status.HTTP_200_OK,
    tags=["General"],
    summary="Información General del Motor"
)
def root_info() -> Dict[str, str]:
    """Página de bienvenida con accesos directos a la documentación OpenAPI."""
    return {
        "message": "Bienvenido al Credit Decisioning & Risk Strategy Engine (México)",
        "docs": "/docs",
        "health": "/health",
        "version": settings.API_VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

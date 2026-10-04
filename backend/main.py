"""Punto de entrada principal del backend FastAPI para despliegues (Render / Docker / Uvicorn)."""

import sys
from pathlib import Path

# Asegurar que el directorio backend/ esté en el PYTHONPATH
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

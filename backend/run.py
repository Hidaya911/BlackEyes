"""Development entry point: backend/venv/Scripts/python.exe backend/run.py."""

from pathlib import Path

import uvicorn


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        timeout_graceful_shutdown=10,
        reload_dirs=[str(Path(__file__).resolve().parent)],
    )

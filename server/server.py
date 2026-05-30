"""
6/7 Counter — Signaling Server

Endpoints:
  GET  /health    — health check
  GET  /me        — dados do jogador autenticado
  POST /nick      — define/atualiza o nick
  GET  /ranking   — ranking público
  WS   /queue     — fila de matchmaking
  WS   /room/{id} — sala de jogo (máx 2 jogadores)

Rodar:
    python -m uvicorn server:app --host 0.0.0.0 --port 8765 --reload
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).parent))

import db
from player_routes import router as player_router
from ws_routes import router as ws_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.environ.get("DATABASE_URL"):
        try:
            await db.init_db()
            logging.getLogger(__name__).info("Database initialized.")
        except Exception as e:
            logging.getLogger(__name__).warning("Database init failed: %s", e)
    yield


app = FastAPI(
    title="6/7 Counter Signaling Server",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(player_router)
app.include_router(ws_router)

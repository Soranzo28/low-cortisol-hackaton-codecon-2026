"""
Servidor de signaling para o contador 6-7 multiplayer.

Endpoints:
  GET  /health               — health check
  WS   /queue                — fila de matchmaking; ao emparelhar envia { type:"matched", roomId }
  WS   /room/{room_id}       — sala de jogo (máx 2 jogadores); relay WebRTC + contagens

Rodar:
    python -m uvicorn server:app --host 0.0.0.0 --port 8765 --reload --ssl-certfile cert.pem --ssl-keyfile key.pem
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import uuid
from pathlib import Path
from typing import Optional, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

API_DESCRIPTION = """
Servidor de signaling e matchmaking para o jogo 6/7 Counter multiplayer local.
A interface principal de documentação desta API é gerada via **ReDoc**.

## 🔌 WebSockets

Como o formato OpenAPI (base do ReDoc) é focado nativamente em HTTP, detalhamos abaixo o funcionamento dos endpoints WebSocket em tempo real para o jogo.

### 1. Matchmaking (`WS /queue`)
Ao se conectar, o cliente entra em uma fila aguardando outro jogador.

**Eventos Recebidos (do Servidor):**
- `{"type": "waiting"}`: Cliente entrou na fila e está aguardando par.
- `{"type": "matched", "roomId": "..."}`: Par encontrado. O cliente deve navegar e reconectar no endpoint da sala (`/room/{roomId}`).

### 2. Sala de Jogo (`WS /room/{room_id}`)
Responsável pela troca de sinalização WebRTC e sincronização de estado (como a pontuação). 
O limite da sala é estritamente de 2 conexões simultâneas.

**Eventos Recebidos (do Servidor):**
- `{"type": "start_offer"}`: Indica que os dois jogadores conectaram. O primeiro a chegar na sala (slot 0) recebe este sinal para iniciar o processo WebRTC criando a oferta (SDP Offer).
- `{"type": "offer", "sdp": {...}}`: Oferta WebRTC gerada pelo oponente.
- `{"type": "answer", "sdp": {...}}`: Resposta WebRTC gerada pelo oponente.
- `{"type": "ice", "candidate": {...}}`: Candidato ICE (rota de rede) do oponente.
- `{"type": "opponent_count", "value": 1}`: Oponente pontuou/atualizou seu contador.
- `{"type": "opponent_left"}`: Oponente perdeu a conexão ou fechou a sala.

**Eventos Enviados (para o Servidor):**
- `{"type": "offer", "sdp": {...}}`: Enviar oferta WebRTC local.
- `{"type": "answer", "sdp": {...}}`: Enviar resposta WebRTC local.
- `{"type": "ice", "candidate": {...}}`: Enviar candidato ICE local.
- `{"type": "count", "value": 1}`: Enviar contagem local atual.
"""

app = FastAPI(
    title="6/7 Counter Signaling Server",
    description=API_DESCRIPTION,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── State ────────────────────────────────────────────────────────────────────

# Queue: list of websockets waiting for a match
queue: list[WebSocket] = []

# Rooms: room_id -> list of connected WebSockets (max 2)
rooms: dict[str, list[WebSocket]] = {}

# Grace-period tasks: room_id -> asyncio Task cleaning up the room after delay
_cleanup_tasks: dict[str, asyncio.Task] = {}

# Last known score per player: room_id -> {id(ws): count}
room_scores: dict[str, dict[int, int]] = {}

# Match timer tasks: room_id -> asyncio Task running the countdown + game clock
_match_tasks: dict[str, asyncio.Task] = {}


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def ws_send(ws: WebSocket, msg: dict) -> None:
    try:
        await ws.send_text(json.dumps(msg))
    except Exception:
        pass


async def relay_to_opponent(room_id: str, sender: WebSocket, msg: dict) -> None:
    for ws in rooms.get(room_id, []):
        if ws is not sender:
            await ws_send(ws, msg)


CODECON_TERMS = [
    "bartolomeu_cansado",
    "deploy_na_sexta",
    "cafe_com_bug",
    "build_quebrado",
    "merge_conflict",
    "senior_sem_cafe",
    "gambiarra_funcional",
    "git_commit_force",
]

def make_room_id() -> str:
    """Generate a long, hard-to-guess room ID prefixed with a Codecon meme."""
    prefix = random.choice(CODECON_TERMS)
    # Two UUIDs concatenated = 256 bits of randomness
    return f"{prefix}_{uuid.uuid4().hex}{uuid.uuid4().hex}"


# ─── Match timer ──────────────────────────────────────────────────────────────

async def match_timer(room_id: str) -> None:
    async def broadcast(msg: dict) -> None:
        for ws in rooms.get(room_id, []):
            await ws_send(ws, msg)

    try:
        for i in range(10, 0, -1):
            await broadcast({"type": "countdown", "value": i})
            await asyncio.sleep(1)

        await broadcast({"type": "game_start"})
        log.info("Sala %s... PARTIDA INICIADA! 67 segundos de pura adrenalina.", room_id[:16])

        for i in range(67, -1, -1):
            await broadcast({"type": "tick", "remaining": i})
            if i == 0:
                break
            await asyncio.sleep(1)

        scores = room_scores.get(room_id, {})
        players = rooms.get(room_id, [])

        if len(players) == 2:
            s0 = scores.get(id(players[0]), 0)
            s1 = scores.get(id(players[1]), 0)
            if s0 > s1:
                w0, w1 = "you", "opponent"
            elif s1 > s0:
                w0, w1 = "opponent", "you"
            else:
                w0 = w1 = "draw"
            await ws_send(players[0], {"type": "game_over", "your_score": s0, "opponent_score": s1, "winner": w0})
            await ws_send(players[1], {"type": "game_over", "your_score": s1, "opponent_score": s0, "winner": w1})
            log.info("Sala %s... game over! Scores: %d vs %d", room_id[:16], s0, s1)

    except asyncio.CancelledError:
        log.info("Timer da sala %s... cancelado (jogador saiu antes do fim).", room_id[:16])
    finally:
        _match_tasks.pop(room_id, None)


# ─── Queue endpoint ───────────────────────────────────────────────────────────

@app.websocket("/queue")
async def queue_endpoint(ws: WebSocket):
    await ws.accept()
    # Generate a Codecon player nick
    player_id = f"{random.choice(CODECON_TERMS)}_{uuid.uuid4().hex[:4]}"
    log.info("Dev %s abriu um PR para a fila de matchmaking (fila antes: %d)", player_id, len(queue))

    # If someone is already waiting, match them
    if queue:
        opponent = queue.pop(0)
        room_id = make_room_id()
        rooms[room_id] = []  # pre-create so the room exists before clients connect

        log.info("Bartolomeu encontrou um par! Merge aceito, criando sala [%s] para os devs.", room_id[:16])

        # Tell both players to navigate to the room
        await ws_send(opponent, {"type": "matched", "roomId": room_id, "role": "offerer"})
        await ws_send(ws,       {"type": "matched", "roomId": room_id, "role": "answerer"})

        # Close the queue connections — players will reconnect via /room/{room_id}
        try:
            await opponent.close()
        except Exception:
            pass
        try:
            await ws.close()
        except Exception:
            pass
        return

    # Otherwise wait in the queue
    queue.append(ws)
    await ws_send(ws, {"type": "waiting"})
    log.info("Dev %s está na fila tomando um café e esperando o CI/CD parear...", player_id)

    try:
        # Keep the connection alive until matched or disconnected
        async for _ in ws.iter_text():
            pass  # no messages expected while queuing
    except WebSocketDisconnect:
        log.info("Dev %s deu ctrl+c na fila e foi resolver bug no StackOverflow", player_id)
    finally:
        if ws in queue:
            queue.remove(ws)


# ─── Room endpoint ────────────────────────────────────────────────────────────

@app.websocket("/room/{room_id}")
async def room_endpoint(ws: WebSocket, room_id: str):
    # Validate room exists
    if room_id not in rooms:
        await ws.close(code=4004, reason="Room not found")
        return

    # Enforce max 2 players
    if len(rooms[room_id]) >= 2:
        await ws.close(code=4003, reason="Room is full")
        return

    await ws.accept()
    rooms[room_id].append(ws)
    slot = len(rooms[room_id])  # 1 or 2
    log.info("Dev conectou ao localhost da sala %s... (%d/2)", room_id[:16], slot)

    # Once both players are in, tell the offerer to start and kick off the match timer
    if len(rooms[room_id]) == 2:
        offerer = rooms[room_id][0]
        await ws_send(offerer, {"type": "start_offer"})
        log.info("Sala %s... lotada! Sem merge conflicts. Iniciando compilador de gestos 6/7. Sem deploy na sexta!", room_id[:16])
        room_scores[room_id] = {}
        task = asyncio.create_task(match_timer(room_id))
        _match_tasks[room_id] = task

    try:
        async for raw in ws.iter_text():
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type in ("offer", "answer", "ice"):
                # WebRTC signaling relay
                await relay_to_opponent(room_id, ws, msg)

            elif msg_type == "count":
                room_scores.setdefault(room_id, {})[id(ws)] = msg.get("value", 0)
                await relay_to_opponent(
                    room_id, ws,
                    {"type": "opponent_count", "value": msg.get("value", 0)},
                )

            elif msg_type == "reset":
                await relay_to_opponent(room_id, ws, {"type": "opponent_reset"})

            else:
                log.warning("Unknown message type in room: %s", msg_type)

    except WebSocketDisconnect:
        log.info("Um dos devs dropou a conexão na sala %s... Deve ter dado NullPointerException ou falta de café!", room_id[:16])
    finally:
        if ws in rooms.get(room_id, []):
            rooms[room_id].remove(ws)

        # Cancel match timer when any player leaves mid-game
        if room_id in _match_tasks:
            _match_tasks[room_id].cancel()

        # Notify opponent
        for peer in rooms.get(room_id, []):
            await ws_send(peer, {"type": "opponent_left"})

    async def _maybe_destroy(room_id: str) -> None:
        """Destroy room only if still empty after a short grace period."""
        await asyncio.sleep(5)
        if not rooms.get(room_id):
            rooms.pop(room_id, None)
            room_scores.pop(room_id, None)
            log.info("Sala %s... destruída com sucesso! Garbage Collector limpou o Bartolomeu da memória RAM.", room_id[:16])
        _cleanup_tasks.pop(room_id, None)

    # Destroy empty rooms (with grace period so reconnects don't kill the room)
    if not rooms.get(room_id):
        # Cancel any existing cleanup task for this room
        if room_id in _cleanup_tasks:
            _cleanup_tasks[room_id].cancel()
        task = asyncio.create_task(_maybe_destroy(room_id))
        _cleanup_tasks[room_id] = task


# ─── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Monitoramento"], summary="Health Check do Servidor")
async def health():
    """
    Retorna o status atual do servidor e métricas de utilização.
    
    ### Retorno:
    - **status**: Estado do servidor (ex: "ok").
    - **queue_size**: Quantidade de jogadores na fila aguardando matchmaking.
    - **active_rooms**: Quantidade de salas ativas atualmente alocadas na memória.
    """
    return {
        "status": "ok",
        "queue_size": len(queue),
        "active_rooms": len(rooms),
    }




# ─── Documentação Swagger para WebSockets ──────────────────────────────────────

class QueueResponse(BaseModel):
    type: str = Field(..., description="Tipo do evento: 'waiting' ou 'matched'")
    roomId: Optional[str] = Field(None, description="UUID da sala gerada (presente apenas se type='matched')")
    role: Optional[str] = Field(None, description="Role do jogador (offerer ou answerer)")

class RoomMessageSchema(BaseModel):
    type: str = Field(..., description="Tipo do evento ('offer', 'answer', 'ice', 'count', 'start_offer', 'opponent_count', 'opponent_left')")
    sdp: Optional[dict] = Field(None, description="Objeto SDP do WebRTC (para offer/answer)")
    candidate: Optional[dict] = Field(None, description="Objeto ICE Candidate do WebRTC")
    value: Optional[int] = Field(None, description="Valor do contador (para eventos de contagem)")

@app.get("/queue", tags=["WebSockets (Documentação)"], summary="Fila de Matchmaking", response_model=QueueResponse)
async def _docs_queue():
    """
    **⚠️ ATENÇÃO: Endpoint WebSocket! Não use GET/POST HTTP.**

    Utilize um cliente WebSocket (ex: `new WebSocket("wss://<ip>/queue")`) para conectar.
    
    ### Fluxo:
    1. Cliente conecta.
    2. Servidor envia `{"type": "waiting"}` se não houver ninguém na fila.
    3. Quando um oponente conectar, o servidor envia `{"type": "matched", "roomId": "uuid..."}` para ambos.
    """
    raise HTTPException(status_code=426, detail="Upgrade Required - Use WebSocket para conectar aqui.")

@app.get("/room/{room_id}", tags=["WebSockets (Documentação)"], summary="Sala de Jogo Multiplayer", response_model=RoomMessageSchema)
async def _docs_room(room_id: str):
    """
    **⚠️ ATENÇÃO: Endpoint WebSocket! Não use GET/POST HTTP.**

    Utilize um cliente WebSocket (ex: `new WebSocket("wss://<ip>/room/{room_id}")`) para conectar.
    O `room_id` é o UUID recebido no endpoint `/queue`. O limite da sala é de 2 pessoas.
    
    ### O que você pode enviar (JSON):
    - `{"type": "offer", "sdp": {...}}`
    - `{"type": "answer", "sdp": {...}}`
    - `{"type": "ice", "candidate": {...}}`
    - `{"type": "count", "value": 5}`

    ### O que você pode receber (JSON):
    - `{"type": "start_offer"}` -> Você foi escolhido pelo servidor para gerar o SDP Offer WebRTC.
    - `{"type": "offer", "sdp": {...}}` -> Oferta do oponente.
    - `{"type": "answer", "sdp": {...}}` -> Resposta do oponente.
    - `{"type": "ice", "candidate": {...}}` -> Candidato de rede do oponente.
    - `{"type": "opponent_count", "value": 5}` -> O oponente incrementou a contagem dele.
    - `{"type": "opponent_left"}` -> Oponente fechou o navegador ou caiu.
    """
    raise HTTPException(status_code=426, detail="Upgrade Required - Use WebSocket para conectar aqui.")

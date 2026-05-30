"""
Servidor de signaling para o contador 6-7 multiplayer.

Endpoints:
  GET  /health               — health check
  GET  /me                   — dados do jogador autenticado
  POST /nick                 — define/atualiza o nick do jogador
  GET  /ranking              — ranking público
  WS   /queue                — fila de matchmaking
  WS   /room/{room_id}       — sala de jogo (máx 2 jogadores)

Rodar:
    python -m uvicorn server:app --host 0.0.0.0 --port 8765 --reload
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import sys
import time
import uuid
import random
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, Header, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── DB (optional) ────────────────────────────────────────────────────────────

sys.path.insert(0, str(Path(__file__).parent))
try:
    import db
    _db_available = True
except Exception as _db_err:
    _db_available = False

    class _NullDB:
        _pool = None
        async def init_db(self): pass
        async def get_player(self, *a): return None
        async def create_or_update_nick(self, *a): raise ValueError("DB not available")
        async def record_match(self, *a): pass
        async def get_ranking(self, *a): return []

    db = _NullDB()  # type: ignore

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.environ.get("DATABASE_URL"):
        try:
            await db.init_db()
            log.info("Database initialized.")
        except Exception as e:
            log.warning("Database init failed: %s", e)
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

# ─── State ────────────────────────────────────────────────────────────────────

queue: list[WebSocket] = []
rooms: dict[str, list[WebSocket]] = {}
_cleanup_tasks: dict[str, asyncio.Task] = {}
room_scores: dict[str, dict[int, int]] = {}
_match_tasks: dict[str, asyncio.Task] = {}

# id(ws) -> {clerk_user_id, nick}  — populated in queue_endpoint
player_info: dict[int, dict] = {}

# room_id -> [{clerk_user_id, nick}, ...]  — set at match time, used by match_timer
room_player_info: dict[str, list[dict]] = {}

# ─── Clerk JWT helpers ────────────────────────────────────────────────────────

_jwks_cache: tuple[dict, float] | None = None
_JWKS_TTL = 3600.0


async def _get_jwks() -> dict:
    global _jwks_cache
    now = time.monotonic()
    if _jwks_cache and now - _jwks_cache[1] < _JWKS_TTL:
        return _jwks_cache[0]
    secret = os.environ.get("CLERK_SECRET_KEY", "")
    if not secret:
        return {}
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://api.clerk.com/v1/jwks",
            headers={"Authorization": f"Bearer {secret}"},
        )
        r.raise_for_status()
        jwks = r.json()
    _jwks_cache = (jwks, now)
    return jwks


async def verify_clerk_token(token: str) -> str:
    from jose import jwt as jose_jwt, JWTError

    if not os.environ.get("CLERK_SECRET_KEY"):
        raise ValueError("Clerk not configured")
    jwks = await _get_jwks()
    header = jose_jwt.get_unverified_header(token)
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None)
    if not key:
        _jwks_cache_clear()
        raise ValueError("JWKS key not found")
    try:
        claims = jose_jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
        return claims["sub"]
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")


def _jwks_cache_clear():
    global _jwks_cache
    _jwks_cache = None


def _auth_header(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    return authorization[len("Bearer "):]

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
    "bartolomeu_cansado", "deploy_na_sexta", "cafe_com_bug",
    "build_quebrado", "merge_conflict", "senior_sem_cafe",
    "gambiarra_funcional", "git_commit_force",
]


def make_room_id() -> str:
    prefix = random.choice(CODECON_TERMS)
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
        log.info("Sala %s... PARTIDA INICIADA!", room_id[:16])

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
            w0, w1 = ("you", "opponent") if s0 > s1 else (("opponent", "you") if s1 > s0 else ("draw", "draw"))
            await ws_send(players[0], {"type": "game_over", "your_score": s0, "opponent_score": s1, "winner": w0})
            await ws_send(players[1], {"type": "game_over", "your_score": s1, "opponent_score": s0, "winner": w1})
            log.info("Sala %s game over: %d vs %d", room_id[:16], s0, s1)

            # Persist match result
            pinfos = room_player_info.get(room_id, [])
            if len(pinfos) == 2:
                uid_a = pinfos[0].get("clerk_user_id")
                uid_b = pinfos[1].get("clerk_user_id")
                if uid_a and uid_b:
                    try:
                        await db.record_match(uid_a, uid_b, s0, s1)
                    except Exception as e:
                        log.warning("record_match failed: %s", e)

    except asyncio.CancelledError:
        log.info("Timer da sala %s cancelado.", room_id[:16])
    finally:
        _match_tasks.pop(room_id, None)

# ─── REST endpoints ───────────────────────────────────────────────────────────

class NickRequest(BaseModel):
    nick: str


@app.get("/me")
async def me_endpoint(authorization: Optional[str] = Header(default=None)):
    token = _auth_header(authorization)
    try:
        clerk_user_id = await verify_clerk_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))
    player = await db.get_player(clerk_user_id)
    if not player:
        return {"clerk_user_id": clerk_user_id, "nick": None}
    return player


@app.post("/nick")
async def nick_endpoint(body: NickRequest, authorization: Optional[str] = Header(default=None)):
    token = _auth_header(authorization)
    try:
        clerk_user_id = await verify_clerk_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))
    nick = body.nick.strip()
    if not re.match(r"^\S{3,20}$", nick):
        raise HTTPException(400, "Nick must be 3–20 chars without spaces")
    try:
        player = await db.create_or_update_nick(clerk_user_id, nick)
        return player
    except ValueError:
        raise HTTPException(409, "Nick already taken")


@app.get("/ranking")
async def ranking_endpoint():
    rows = await db.get_ranking(10)
    return rows


@app.get("/health")
async def health():
    return {"status": "ok", "queue_size": len(queue), "active_rooms": len(rooms)}

# ─── Queue endpoint ───────────────────────────────────────────────────────────

@app.websocket("/queue")
async def queue_endpoint(ws: WebSocket):
    await ws.accept()

    # Identify: expect {type: 'identify', clerk_token: '...'}
    clerk_user_id: str | None = None
    nick = "anon"
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=5.0)
        msg = json.loads(raw)
        if msg.get("type") == "identify" and msg.get("clerk_token"):
            clerk_user_id = await verify_clerk_token(msg["clerk_token"])
            player = await db.get_player(clerk_user_id)
            if player and player.get("nick"):
                nick = player["nick"]
            elif player is None:
                # User exists in Clerk but not in DB yet — needs to set nick first
                clerk_user_id = None
    except Exception:
        pass

    if not clerk_user_id:
        await ws.close(code=1008, reason="Authentication required or nick not set")
        return

    player_info[id(ws)] = {"clerk_user_id": clerk_user_id, "nick": nick}
    log.info("Player %s (%s) joined queue (size before: %d)", nick, clerk_user_id[:8], len(queue))

    if queue:
        opponent = queue.pop(0)
        room_id = make_room_id()
        rooms[room_id] = []

        opp_info = player_info.get(id(opponent), {})
        opp_nick = opp_info.get("nick", "anon")

        # Store player identities for this room (used by match_timer for record_match)
        room_player_info[room_id] = [opp_info, player_info[id(ws)]]

        log.info("Match found! Room %s: %s vs %s", room_id[:16], opp_nick, nick)
        await ws_send(opponent, {"type": "matched", "roomId": room_id, "role": "offerer", "opp_nick": nick})
        await ws_send(ws,       {"type": "matched", "roomId": room_id, "role": "answerer", "opp_nick": opp_nick})

        player_info.pop(id(ws), None)
        try:
            await opponent.close()
        except Exception:
            pass
        try:
            await ws.close()
        except Exception:
            pass
        return

    queue.append(ws)
    await ws_send(ws, {"type": "waiting"})
    log.info("Player %s waiting in queue...", nick)

    try:
        async for _ in ws.iter_text():
            pass
    except WebSocketDisconnect:
        log.info("Player %s left queue.", nick)
    finally:
        if ws in queue:
            queue.remove(ws)
        player_info.pop(id(ws), None)

# ─── Room endpoint ────────────────────────────────────────────────────────────

@app.websocket("/room/{room_id}")
async def room_endpoint(ws: WebSocket, room_id: str):
    if room_id not in rooms:
        await ws.close(code=4004, reason="Room not found")
        return
    if len(rooms[room_id]) >= 2:
        await ws.close(code=4003, reason="Room is full")
        return

    await ws.accept()
    rooms[room_id].append(ws)
    slot = len(rooms[room_id])
    log.info("Player connected to room %s (%d/2)", room_id[:16], slot)

    if len(rooms[room_id]) == 2:
        offerer = rooms[room_id][0]
        await ws_send(offerer, {"type": "start_offer"})
        room_scores[room_id] = {}
        task = asyncio.create_task(match_timer(room_id))
        _match_tasks[room_id] = task
        log.info("Room %s full — match timer started.", room_id[:16])

    try:
        async for raw in ws.iter_text():
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type in ("offer", "answer", "ice"):
                await relay_to_opponent(room_id, ws, msg)
            elif msg_type == "count":
                room_scores.setdefault(room_id, {})[id(ws)] = msg.get("value", 0)
                await relay_to_opponent(room_id, ws, {"type": "opponent_count", "value": msg.get("value", 0)})
            elif msg_type == "reset":
                await relay_to_opponent(room_id, ws, {"type": "opponent_reset"})
            else:
                log.warning("Unknown message type in room: %s", msg_type)

    except WebSocketDisconnect:
        log.info("Player disconnected from room %s.", room_id[:16])
    finally:
        if ws in rooms.get(room_id, []):
            rooms[room_id].remove(ws)

        if room_id in _match_tasks:
            _match_tasks[room_id].cancel()

        for peer in rooms.get(room_id, []):
            await ws_send(peer, {"type": "opponent_left"})

    async def _maybe_destroy(rid: str) -> None:
        await asyncio.sleep(5)
        if not rooms.get(rid):
            rooms.pop(rid, None)
            room_scores.pop(rid, None)
            room_player_info.pop(rid, None)
            log.info("Room %s destroyed.", rid[:16])
        _cleanup_tasks.pop(rid, None)

    if not rooms.get(room_id):
        if room_id in _cleanup_tasks:
            _cleanup_tasks[room_id].cancel()
        _cleanup_tasks[room_id] = asyncio.create_task(_maybe_destroy(room_id))


# ─── WebSocket docs (Swagger stubs) ───────────────────────────────────────────

class QueueResponse(BaseModel):
    type: str = Field(..., description="'waiting' ou 'matched'")
    roomId: Optional[str] = Field(None)
    role: Optional[str] = Field(None)

class RoomMessageSchema(BaseModel):
    type: str = Field(...)
    sdp: Optional[dict] = Field(None)
    candidate: Optional[dict] = Field(None)
    value: Optional[int] = Field(None)

@app.get("/queue", tags=["WebSockets (Documentação)"], response_model=QueueResponse)
async def _docs_queue():
    raise HTTPException(status_code=426, detail="Use WebSocket")

@app.get("/room/{room_id}", tags=["WebSockets (Documentação)"], response_model=RoomMessageSchema)
async def _docs_room(room_id: str):
    raise HTTPException(status_code=426, detail="Use WebSocket")

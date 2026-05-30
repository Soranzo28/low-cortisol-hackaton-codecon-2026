from __future__ import annotations

import asyncio
import json
import logging
import random
import uuid

import db
from fastapi import WebSocket

log = logging.getLogger(__name__)

CODECON_TERMS = [
    "bartolomeu_cansado", "deploy_na_sexta", "cafe_com_bug",
    "build_quebrado", "merge_conflict", "senior_sem_cafe",
    "gambiarra_funcional", "git_commit_force",
]

# ── State ──────────────────────────────────────────────────────────────────────

queue: list[WebSocket] = []
rooms: dict[str, list[WebSocket]] = {}
_cleanup_tasks: dict[str, asyncio.Task] = {}
room_scores: dict[str, dict[int, int]] = {}
_match_tasks: dict[str, asyncio.Task] = {}
player_info: dict[int, dict] = {}
room_player_info: dict[str, list[dict]] = {}

# ── Transport helpers ──────────────────────────────────────────────────────────

async def ws_send(ws: WebSocket, msg: dict) -> None:
    try:
        await ws.send_text(json.dumps(msg))
    except Exception:
        pass


async def relay_to_opponent(room_id: str, sender: WebSocket, msg: dict) -> None:
    for ws in rooms.get(room_id, []):
        if ws is not sender:
            await ws_send(ws, msg)


def make_room_id() -> str:
    prefix = random.choice(CODECON_TERMS)
    return f"{prefix}_{uuid.uuid4().hex}{uuid.uuid4().hex}"


# ── Match timer ────────────────────────────────────────────────────────────────

async def match_timer(room_id: str) -> None:
    async def broadcast(msg: dict) -> None:
        for ws in rooms.get(room_id, []):
            await ws_send(ws, msg)

    try:
        for i in range(10, 0, -1):
            await broadcast({"type": "countdown", "value": i})
            await asyncio.sleep(1)

        await broadcast({"type": "game_start"})
        log.info("Room %s — match started.", room_id[:16])

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
            w0, w1 = (
                ("you", "opponent") if s0 > s1
                else ("opponent", "you") if s1 > s0
                else ("draw", "draw")
            )
            await ws_send(players[0], {"type": "game_over", "your_score": s0, "opponent_score": s1, "winner": w0})
            await ws_send(players[1], {"type": "game_over", "your_score": s1, "opponent_score": s0, "winner": w1})
            log.info("Room %s — game over: %d vs %d", room_id[:16], s0, s1)

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
        log.info("Room %s — timer cancelled.", room_id[:16])
    finally:
        _match_tasks.pop(room_id, None)

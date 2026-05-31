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
    "bartolomeu_cansado",
    "deploy_na_sexta",
    "cafe_com_bug",
    "build_quebrado",
    "merge_conflict",
    "senior_sem_cafe",
    "gambiarra_funcional",
    "git_commit_force",
]

# ── State ──────────────────────────────────────────────────────────────────────

queue: list[WebSocket] = []
rooms: dict[str, list[WebSocket]] = {}
_cleanup_tasks: dict[str, asyncio.Task] = {}
room_scores: dict[str, dict[int, int]] = {}
_match_tasks: dict[str, asyncio.Task] = {}
player_info: dict[int, dict] = {}
room_player_info: dict[str, list[dict]] = {}
# room_id -> 'waiting' | 'in_progress' | 'finished'
room_state: dict[str, str] = {}
room_remaining: dict[str, int] = {}  # room_id -> seconds remaining in match
room_reconnect_tasks: dict[str, asyncio.Task] = {}
# room_id -> {id(ws): clerk_user_id}
room_ws_to_uid: dict[str, dict[int, str]] = {}

# ── Event state ────────────────────────────────────────────────────────────────

room_event_tasks: dict[str, asyncio.Task] = {}
# first event_complete signal wins
room_event_trigger: dict[str, asyncio.Queue] = {}
# {clerk_user_id: bonus_points}
room_event_bonus: dict[str, dict[str, int]] = {}

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


# ── Event coroutine ────────────────────────────────────────────────────────────


async def fire_event(room_id: str, delay: float) -> None:
    await asyncio.sleep(delay)

    if room_state.get(room_id) != "in_progress":
        return

    event_id = random.choice(["absolute_cinema", "nerd_up"])
    duration = 10

    # Bounded queue: first put_nowait wins; second raises QueueFull (ignored)
    q: asyncio.Queue = asyncio.Queue(maxsize=1)
    room_event_trigger[room_id] = q

    for ws in rooms.get(room_id, []):
        await ws_send(
            ws, {"type": "event_start", "event_id": event_id, "duration": duration}
        )
    log.info("Room %s — event '%s' fired.", room_id[:16], event_id)

    winner_uid: str | None = None
    try:
        uid, received_id = await asyncio.wait_for(q.get(), timeout=float(duration))
        if received_id == event_id:
            winner_uid = uid
    except asyncio.TimeoutError:
        pass
    finally:
        room_event_trigger.pop(room_id, None)

    bonus = 15
    if winner_uid:
        bonuses = room_event_bonus.setdefault(room_id, {})
        bonuses[winner_uid] = bonuses.get(winner_uid, 0) + bonus
        for ws in rooms.get(room_id, []):
            await ws_send(
                ws, {"type": "event_winner", "winner_id": winner_uid, "bonus": bonus}
            )
        log.info(
            "Room %s — event winner: %s (+%d)", room_id[:16], winner_uid[:8], bonus
        )
    else:
        for ws in rooms.get(room_id, []):
            await ws_send(ws, {"type": "event_expired"})
        log.info("Room %s — event expired with no winner.", room_id[:16])


async def run_match_events(room_id: str) -> None:
    loop = asyncio.get_event_loop()
    game_start = loop.time()

    delay1 = random.uniform(5, 15)
    delay2 = random.uniform(25, 35)

    await fire_event(room_id, delay1)

    elapsed = loop.time() - game_start
    await fire_event(room_id, max(0.0, delay2 - elapsed))


# ── Match timer ────────────────────────────────────────────────────────────────


async def match_timer(room_id: str) -> None:
    async def broadcast(msg: dict) -> None:
        for ws in rooms.get(room_id, []):
            await ws_send(ws, msg)

    event_task_local: asyncio.Task | None = None

    try:
        for i in range(10, 0, -1):
            await broadcast({"type": "countdown", "value": i})
            await asyncio.sleep(1)

        room_state[room_id] = "in_progress"
        await broadcast({"type": "game_start"})
        log.info("Room %s — match started.", room_id[:16])

        # Launch events concurrently with the match timer
        event_task_local = asyncio.create_task(run_match_events(room_id))
        room_event_tasks[room_id] = event_task_local

        for i in range(42, -1, -1):
            room_remaining[room_id] = i
            await broadcast({"type": "tick", "remaining": i})
            if i == 0:
                break
            await asyncio.sleep(1)

        # Cancel event task if it hasn't finished yet
        if event_task_local and not event_task_local.done():
            event_task_local.cancel()

        scores = room_scores.get(room_id, {})
        players = rooms.get(room_id, [])
        room_state[room_id] = "finished"

        # Apply event bonus to the winner's score
        event_bonus = room_event_bonus.get(room_id, {})
        if event_bonus:
            ws_uid_map = room_ws_to_uid.get(room_id, {})
            for ws_id_key, uid in ws_uid_map.items():
                if uid in event_bonus:
                    scores[ws_id_key] = scores.get(ws_id_key, 0) + event_bonus[uid]

        if len(players) == 2:
            s0 = scores.get(id(players[0]), 0)
            s1 = scores.get(id(players[1]), 0)
            w0, w1 = (
                ("you", "opponent")
                if s0 > s1
                else ("opponent", "you")
                if s1 > s0
                else ("draw", "draw")
            )
            await ws_send(
                players[0],
                {
                    "type": "game_over",
                    "your_score": s0,
                    "opponent_score": s1,
                    "winner": w0,
                },
            )
            await ws_send(
                players[1],
                {
                    "type": "game_over",
                    "your_score": s1,
                    "opponent_score": s0,
                    "winner": w1,
                },
            )
            log.info("Room %s — game over: %d vs %d", room_id[:16], s0, s1)

            ws_uid_map = room_ws_to_uid.get(room_id, {})
            uid_0 = ws_uid_map.get(id(players[0]))
            uid_1 = ws_uid_map.get(id(players[1]))
            if uid_0 and uid_1:
                try:
                    await db.record_match(uid_0, uid_1, s0, s1)
                except Exception as e:
                    log.warning("record_match failed: %s", e)

        elif len(players) == 1:
            stayer = players[0]
            s_stayer = scores.get(id(stayer), 0)
            s_opponent = next((v for k, v in scores.items() if k != id(stayer)), 0)
            await ws_send(
                stayer,
                {
                    "type": "game_over",
                    "your_score": s_stayer,
                    "opponent_score": s_opponent,
                    "winner": "you",
                },
            )
            log.info(
                "Room %s — game over (1 player): stayer=%d opponent=%d",
                room_id[:16],
                s_stayer,
                s_opponent,
            )

    except asyncio.CancelledError:
        if event_task_local and not event_task_local.done():
            event_task_local.cancel()
        log.info("Room %s — timer cancelled.", room_id[:16])
    finally:
        _match_tasks.pop(room_id, None)
        room_event_tasks.pop(room_id, None)
        room_event_bonus.pop(room_id, None)
        room_event_trigger.pop(room_id, None)

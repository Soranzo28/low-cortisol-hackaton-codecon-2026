from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

import db
import game
from auth import verify_clerk_token
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

router = APIRouter()
log = logging.getLogger(__name__)


@router.websocket("/queue")
async def queue_endpoint(ws: WebSocket):
    await ws.accept()

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
                clerk_user_id = None
    except Exception:
        pass

    if not clerk_user_id:
        await ws.close(code=1008, reason="Authentication required or nick not set")
        return

    total_score = player.get("total_score", 0) if player else 0
    game.player_info[id(ws)] = {"clerk_user_id": clerk_user_id, "nick": nick, "total_score": total_score}
    log.info("Player %s (%s) joined queue (size: %d)", nick, clerk_user_id[:8], len(game.queue))

    if game.queue:
        opponent = game.queue.pop(0)
        room_id = game.make_room_id()
        game.rooms[room_id] = []

        opp_info = game.player_info.get(id(opponent), {})
        opp_nick = opp_info.get("nick", "anon")
        opp_score = opp_info.get("total_score", 0)
        game.room_player_info[room_id] = [opp_info, game.player_info[id(ws)]]
        game.room_state[room_id] = 'waiting'

        await game.ws_send(opponent, {"type": "matched", "roomId": room_id, "role": "offerer", "opp_nick": nick, "opp_score": total_score, "your_score": opp_score})
        await game.ws_send(ws, {"type": "matched", "roomId": room_id, "role": "answerer", "opp_nick": opp_nick, "opp_score": opp_score, "your_score": total_score})

        game.player_info.pop(id(ws), None)
        try:
            await opponent.close()
        except Exception:
            pass
        try:
            await ws.close()
        except Exception:
            pass
        return

    game.queue.append(ws)
    await game.ws_send(ws, {"type": "waiting"})
    log.info("Player %s waiting in queue.", nick)

    try:
        async for _ in ws.iter_text():
            pass
    except WebSocketDisconnect:
        log.info("Player %s left queue.", nick)
    finally:
        if ws in game.queue:
            game.queue.remove(ws)
        game.player_info.pop(id(ws), None)


async def _reconnect_grace(room_id: str) -> None:
    """End the match if the disconnected player doesn't reconnect within 15s."""
    await asyncio.sleep(15)
    game.room_reconnect_tasks.pop(room_id, None)
    if len(game.rooms.get(room_id, [])) < 2:
        log.info("Room %s — grace period expired, ending match.", room_id[:16])
        for peer in game.rooms.get(room_id, []):
            await game.ws_send(peer, {"type": "opponent_left"})
        if room_id in game._match_tasks:
            game._match_tasks[room_id].cancel()
        game.room_state[room_id] = 'finished'


@router.websocket("/room/{room_id}")
async def room_endpoint(ws: WebSocket, room_id: str):
    if room_id not in game.rooms:
        await ws.close(code=4004, reason="Room not found")
        return
    if game.room_state.get(room_id) == 'finished':
        await ws.close(code=4000, reason="Match already finished")
        return
    if len(game.rooms[room_id]) >= 2:
        await ws.close(code=4003, reason="Room is full")
        return

    await ws.accept()

    # If room is in_progress, verify this player belongs to the original match
    if game.room_state.get(room_id) == 'in_progress':
        clerk_user_id: str | None = None
        try:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=5.0)
            msg = json.loads(raw)
            if msg.get("type") == "identify" and msg.get("clerk_token"):
                clerk_user_id = await verify_clerk_token(msg["clerk_token"])
        except Exception:
            pass

        original_ids = {p.get("clerk_user_id") for p in game.room_player_info.get(room_id, [])}
        if not clerk_user_id or clerk_user_id not in original_ids:
            await ws.close(code=4003, reason="Not a participant of this room")
            return

    game.rooms[room_id].append(ws)
    log.info("Player connected to room %s (%d/2)", room_id[:16], len(game.rooms[room_id]))

    if len(game.rooms[room_id]) == 2:
        state = game.room_state.get(room_id)
        if state == 'waiting':
            # Fresh start
            await game.ws_send(game.rooms[room_id][0], {"type": "start_offer"})
            game.room_scores[room_id] = {}
            game._match_tasks[room_id] = asyncio.create_task(game.match_timer(room_id))
        elif state == 'in_progress':
            # Player reconnected — cancel grace period and resync
            if room_id in game.room_reconnect_tasks:
                game.room_reconnect_tasks[room_id].cancel()
                game.room_reconnect_tasks.pop(room_id, None)
            stayer = next(p for p in game.rooms[room_id] if p is not ws)
            await game.ws_send(stayer, {"type": "opponent_reconnected"})
            await game.ws_send(stayer, {"type": "start_offer"})
            remaining = game.room_remaining.get(room_id, 0)
            await game.ws_send(ws, {"type": "sync", "remaining": remaining})
            log.info("Room %s — player reconnected, synced at %ds.", room_id[:16], remaining)

    try:
        async for raw in ws.iter_text():
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            t = msg.get("type", "")
            if t in ("offer", "answer", "ice"):
                await game.relay_to_opponent(room_id, ws, msg)
            elif t == "count":
                game.room_scores.setdefault(room_id, {})[id(ws)] = msg.get("value", 0)
                await game.relay_to_opponent(room_id, ws, {"type": "opponent_count", "value": msg.get("value", 0)})
            elif t == "reset":
                await game.relay_to_opponent(room_id, ws, {"type": "opponent_reset"})
            elif t == "identify":
                pass  # consumed on reconnect before loop; ignore if it arrives here

    except WebSocketDisconnect:
        log.info("Player disconnected from room %s.", room_id[:16])
    finally:
        if ws in game.rooms.get(room_id, []):
            game.rooms[room_id].remove(ws)

        if game.room_state.get(room_id) == 'in_progress':
            # Notify stayer that opponent is reconnecting
            for peer in game.rooms.get(room_id, []):
                await game.ws_send(peer, {"type": "opponent_reconnecting", "timeout": 15})
            # Grace period: give the player 15s to reconnect before ending the match
            if room_id in game.room_reconnect_tasks:
                game.room_reconnect_tasks[room_id].cancel()
            game.room_reconnect_tasks[room_id] = asyncio.create_task(
                _reconnect_grace(room_id)
            )
            log.info("Room %s — player disconnected, grace period started.", room_id[:16])
        else:
            # Not in progress — end immediately
            if room_id in game._match_tasks:
                game._match_tasks[room_id].cancel()
            for peer in game.rooms.get(room_id, []):
                await game.ws_send(peer, {"type": "opponent_left"})

    async def _maybe_destroy(rid: str) -> None:
        await asyncio.sleep(5)
        if not game.rooms.get(rid):
            game.rooms.pop(rid, None)
            game.room_scores.pop(rid, None)
            game.room_player_info.pop(rid, None)
            game.room_state.pop(rid, None)
            game.room_remaining.pop(rid, None)
            log.info("Room %s destroyed.", rid[:16])
        game._cleanup_tasks.pop(rid, None)

    if not game.rooms.get(room_id):
        if room_id in game._cleanup_tasks:
            game._cleanup_tasks[room_id].cancel()
        game._cleanup_tasks[room_id] = asyncio.create_task(_maybe_destroy(room_id))


# ── Swagger stubs for WebSocket docs ──────────────────────────────────────────

class _QueueResponse(BaseModel):
    type: str = Field(..., description="'waiting' ou 'matched'")
    roomId: Optional[str] = Field(None)
    role: Optional[str] = Field(None)


class _RoomMessage(BaseModel):
    type: str = Field(...)
    sdp: Optional[dict] = Field(None)
    candidate: Optional[dict] = Field(None)
    value: Optional[int] = Field(None)


@router.get("/queue", tags=["WebSockets (Documentação)"], response_model=_QueueResponse)
async def _docs_queue():
    raise HTTPException(426, "Use WebSocket")


@router.get("/room/{room_id}", tags=["WebSockets (Documentação)"], response_model=_RoomMessage)
async def _docs_room(room_id: str):
    raise HTTPException(426, "Use WebSocket")

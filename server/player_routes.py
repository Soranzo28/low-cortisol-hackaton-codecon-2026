from __future__ import annotations

import re
from typing import Optional

import db
from auth import require_auth, verify_clerk_token
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter()


class NickRequest(BaseModel):
    nick: str


@router.get("/health", tags=["Monitoramento"])
async def health():
    import game
    return {"status": "ok", "queue_size": len(game.queue), "active_rooms": len(game.rooms)}


@router.get("/me")
async def me_endpoint(authorization: Optional[str] = Header(default=None)):
    token = require_auth(authorization)
    try:
        clerk_user_id = await verify_clerk_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))
    player = await db.get_player(clerk_user_id)
    if not player:
        return {"clerk_user_id": clerk_user_id, "nick": None}
    return player


@router.post("/nick")
async def nick_endpoint(body: NickRequest, authorization: Optional[str] = Header(default=None)):
    token = require_auth(authorization)
    try:
        clerk_user_id = await verify_clerk_token(token)
    except ValueError as e:
        raise HTTPException(401, str(e))
    nick = body.nick.strip()
    if not re.match(r"^\S{3,20}$", nick):
        raise HTTPException(400, "Nick must be 3–20 chars without spaces")
    try:
        return await db.create_or_update_nick(clerk_user_id, nick)
    except ValueError:
        raise HTTPException(409, "Nick already taken")


@router.get("/ranking")
async def ranking_endpoint():
    return await db.get_ranking(10)

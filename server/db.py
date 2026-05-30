from __future__ import annotations

import os
from pathlib import Path

import asyncpg

_pool: asyncpg.Pool | None = None


async def init_db() -> None:
    global _pool
    _pool = await asyncpg.create_pool(os.environ["DATABASE_URL"], min_size=1, max_size=10)
    schema = (Path(__file__).parent / "schema.sql").read_text()
    async with _pool.acquire() as conn:
        await conn.execute(schema)


async def get_player(clerk_user_id: str) -> dict | None:
    if not _pool:
        return None
    row = await _pool.fetchrow("SELECT * FROM players WHERE clerk_user_id = $1", clerk_user_id)
    return dict(row) if row else None


async def create_or_update_nick(clerk_user_id: str, nick: str) -> dict:
    try:
        row = await _pool.fetchrow(
            """
            INSERT INTO players (clerk_user_id, nick)
            VALUES ($1, $2)
            ON CONFLICT (clerk_user_id) DO UPDATE SET nick = EXCLUDED.nick
            RETURNING *
            """,
            clerk_user_id,
            nick,
        )
        return dict(row)
    except asyncpg.UniqueViolationError:
        raise ValueError("nick already taken")


async def record_match(player_a: str, player_b: str, score_a: int, score_b: int) -> None:
    if not _pool:
        return
    winner = player_a if score_a > score_b else (player_b if score_b > score_a else None)
    async with _pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO matches (player_a, player_b, score_a, score_b, winner)
                VALUES ($1, $2, $3, $4, $5)
                """,
                player_a, player_b, score_a, score_b, winner,
            )
            for uid, score in [(player_a, score_a), (player_b, score_b)]:
                won = 1 if winner == uid else 0
                await conn.execute(
                    """
                    UPDATE players
                    SET matches_played = matches_played + 1,
                        total_score    = total_score + $1,
                        wins           = wins + $2
                    WHERE clerk_user_id = $3
                    """,
                    score, won, uid,
                )


async def get_ranking(limit: int = 10) -> list[dict]:
    if not _pool:
        return []
    rows = await _pool.fetch(
        """
        SELECT nick, total_score, wins, matches_played
        FROM players
        WHERE nick IS NOT NULL
        ORDER BY total_score DESC, wins DESC
        LIMIT $1
        """,
        limit,
    )
    return [dict(r) for r in rows]

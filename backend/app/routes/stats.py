"""
FastAPI Route Handlers for War Card Game Analytics & Statistics.
Includes global overview metrics, player statistics, leaderboard rankings, most wars, and recent matches.
"""

from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException

from app.models import (
    APIResponse,
    GameResponse,
    GameStats,
    LeaderboardEntry,
    PlayerStats,
)
from app.database import db

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview", response_model=APIResponse[GameStats])
async def get_stats_overview():
    """
    1. GET /api/stats/overview
    Returns aggregate stats: total games, win rates, average rounds, wars count, min/max length.
    """
    total_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games")
    total_games = total_res[0]["cnt"] if total_res else 0

    comp_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE status = 'completed'")
    completed_games = comp_res[0]["cnt"] if comp_res else 0

    abandoned_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE status = 'abandoned'")
    abandoned_games = abandoned_res[0]["cnt"] if abandoned_res else 0

    p1_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE winner_player = 1")
    p1_wins = p1_res[0]["cnt"] if p1_res else 0

    p2_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE winner_player = 2")
    p2_wins = p2_res[0]["cnt"] if p2_res else 0

    ties_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE status = 'completed' AND winner_player IS NULL")
    ties_count = ties_res[0]["cnt"] if ties_res else 0

    avg_rounds_res = await db.execute_query("SELECT AVG(total_rounds) as avg_r FROM games WHERE status = 'completed'")
    avg_rounds = round(float(avg_rounds_res[0]["avg_r"]), 2) if (avg_rounds_res and avg_rounds_res[0]["avg_r"]) else 0.0

    total_wars_res = await db.execute_query("SELECT COUNT(*) as cnt FROM rounds WHERE is_war = 1")
    total_wars = total_wars_res[0]["cnt"] if total_wars_res else 0

    avg_wars = round(total_wars / total_games, 2) if total_games > 0 else 0.0

    max_wars_res = await db.execute_query("SELECT MAX(war_round_count) as max_w FROM rounds")
    max_wars = max_wars_res[0]["max_w"] if (max_wars_res and max_wars_res[0]["max_w"]) else 0

    min_len_res = await db.execute_query("SELECT MIN(total_rounds) as min_r FROM games WHERE status = 'completed' AND total_rounds > 0")
    min_len = min_len_res[0]["min_r"] if (min_len_res and min_len_res[0]["min_r"]) else None

    max_len_res = await db.execute_query("SELECT MAX(total_rounds) as max_r FROM games WHERE status = 'completed'")
    max_len = max_len_res[0]["max_r"] if (max_len_res and max_len_res[0]["max_r"]) else None

    stats_obj = GameStats(
        total_games=total_games,
        completed_games=completed_games,
        abandoned_games=abandoned_games,
        player1_wins=p1_wins,
        player2_wins=p2_wins,
        ties_or_max_rounds=ties_count,
        avg_rounds_per_game=avg_rounds,
        total_wars_fought=total_wars,
        avg_wars_per_game=avg_wars,
        max_wars_in_single_game=max_wars,
        shortest_game_rounds=min_len,
        longest_game_rounds=max_len,
    )
    return APIResponse(success=True, message="Stats overview retrieved", data=stats_obj)


@router.get("/player/{player_id}", response_model=APIResponse[PlayerStats])
async def get_player_stats(player_id: str):
    """
    2. GET /api/stats/player/{player_id}
    Returns player specific statistics (wins, losses, win rate).
    """
    p_num = 1 if player_id in ["1", "p1", "player1"] else 2 if player_id in ["2", "p2", "player2"] else None
    if not p_num:
        raise HTTPException(status_code=400, detail="Invalid player_id. Must be 1 or 2.")

    p_name = f"Player {p_num}"

    wins_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE winner_player = ?", (p_num,))
    wins = wins_res[0]["cnt"] if wins_res else 0

    losses_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE winner_player IS NOT NULL AND winner_player != ?", (p_num,))
    losses = losses_res[0]["cnt"] if losses_res else 0

    total_p = wins + losses
    win_rate = round((wins / total_p) * 100, 2) if total_p > 0 else 0.0

    p_stats = PlayerStats(
        player_name=p_name,
        total_games_played=total_p,
        wins=wins,
        losses=losses,
        win_rate=win_rate,
    )
    return APIResponse(success=True, message=f"Stats for {p_name} retrieved", data=p_stats)


@router.get("/most-wars", response_model=APIResponse[List[Dict]])
async def get_most_wars_games():
    """
    3. GET /api/stats/most-wars
    Returns list of games sorted by highest war count fought.
    """
    query = """
    SELECT g.id, g.start_time, g.total_rounds, g.winner_player, COUNT(r.id) as war_count
    FROM games g
    JOIN rounds r ON g.id = r.game_id
    WHERE r.is_war = 1
    GROUP BY g.id
    ORDER BY war_count DESC
    LIMIT 10;
    """
    rows = await db.execute_query(query)
    return APIResponse(success=True, message="Games with most wars retrieved", data=rows)


@router.get("/leaderboard", response_model=APIResponse[List[LeaderboardEntry]])
async def get_leaderboard():
    """
    4. GET /api/stats/leaderboard
    Returns top players sorted by wins.
    """
    entries = []
    for p_num in [1, 2]:
        wins_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE winner_player = ?", (p_num,))
        wins = wins_res[0]["cnt"] if wins_res else 0

        total_res = await db.execute_query("SELECT COUNT(*) as cnt FROM games WHERE status = 'completed'")
        total = total_res[0]["cnt"] if total_res else 0

        win_rate = round((wins / total) * 100, 2) if total > 0 else 0.0
        entries.append({
            "player_name": f"Player {p_num}",
            "games_played": total,
            "wins": wins,
            "win_rate": win_rate
        })

    entries.sort(key=lambda x: x["wins"], reverse=True)

    leaderboard = [
        LeaderboardEntry(
            rank=idx + 1,
            player_name=e["player_name"],
            games_played=e["games_played"],
            wins=e["wins"],
            win_rate=e["win_rate"]
        )
        for idx, e in enumerate(entries)
    ]

    return APIResponse(success=True, message="Leaderboard retrieved", data=leaderboard)


@router.get("/recent", response_model=APIResponse[List[GameResponse]])
async def get_recent_games():
    """
    5. GET /api/stats/recent
    Returns recent 10 games played.
    """
    rows = await db.execute_query("SELECT * FROM games ORDER BY created_at DESC LIMIT 10")
    items = [
        GameResponse(
            id=r["id"],
            start_time=datetime.fromisoformat(r["start_time"]) if r.get("start_time") else datetime.utcnow(),
            end_time=datetime.fromisoformat(r["end_time"]) if r.get("end_time") else None,
            winner_player=r.get("winner_player"),
            total_rounds=r.get("total_rounds", 0),
            status=r.get("status", "in_progress"),
            created_at=datetime.fromisoformat(r["created_at"]) if r.get("created_at") else datetime.utcnow(),
        )
        for r in rows
    ]
    return APIResponse(success=True, message="Recent games retrieved", data=items)

"""
FastAPI Route Handlers for War Card Game Matches.
Supports creation, stepping rounds, simulations, pagination, state retrieval, and game completion.
"""

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, HTTPException, Query, status

from app.models import (
    APIResponse,
    GameCreate,
    GameResponse,
    PaginatedResponse,
    RoundResponse,
    RoundWithWarDetails,
)
from app.game_logic import WarGame, Player, Card, Deck
from app.database import db

router = APIRouter(prefix="/api/games", tags=["games"])

# Hot cache only; the database remains the source of truth for resumable games.
active_games: Dict[str, WarGame] = {}

ROUND_INSERT_QUERY = """
INSERT INTO rounds (
    id, game_id, round_number, player1_card, player2_card, is_war,
    war_round_count, winner_player, cards_won, created_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

WAR_DETAIL_INSERT_QUERY = """
INSERT INTO war_details (
    id, round_id, war_round_number, player1_card, player2_card,
    winner_player, created_at
)
VALUES (?, ?, ?, ?, ?, ?, ?)
"""


def _serialize_hand(cards: List[Card]) -> str:
    return json.dumps([{"rank": card.rank, "suit": card.suit} for card in cards])


def _deserialize_hand(raw_hand: str) -> List[Card]:
    try:
        return [Card(item["rank"], item["suit"]) for item in json.loads(raw_hand)]
    except (TypeError, ValueError, KeyError, json.JSONDecodeError) as exc:
        raise ValueError("Saved game hand is invalid") from exc


async def _save_game_state(game: WarGame) -> None:
    """Persist everything required to resume the exact next round."""
    winner_player = int(game.winner.player_id) if game.winner else None
    await db.execute_query(
        """
        INSERT INTO game_states (
            game_id, player1_name, player2_name, player1_hand, player2_hand,
            round_counter, total_wars, max_rounds, status, winner_player, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(game_id) DO UPDATE SET
            player1_name = excluded.player1_name,
            player2_name = excluded.player2_name,
            player1_hand = excluded.player1_hand,
            player2_hand = excluded.player2_hand,
            round_counter = excluded.round_counter,
            total_wars = excluded.total_wars,
            max_rounds = excluded.max_rounds,
            status = excluded.status,
            winner_player = excluded.winner_player,
            updated_at = excluded.updated_at
        """,
        (
            game.game_id,
            game.player1.name,
            game.player2.name,
            _serialize_hand(game.player1.hand),
            _serialize_hand(game.player2.hand),
            game.round_counter,
            game.total_wars,
            game.max_rounds,
            game.status,
            winner_player,
            datetime.utcnow().isoformat(),
        ),
    )


async def _load_saved_game(game_id: str, game_row: Dict[str, Any]) -> Optional[WarGame]:
    state_rows = await db.execute_query(
        "SELECT * FROM game_states WHERE game_id = ?",
        (game_id,),
    )
    if not state_rows:
        return None

    state = state_rows[0]
    player1 = Player("1", state.get("player1_name") or "Player 1")
    player2 = Player("2", state.get("player2_name") or "Player 2")
    player1.hand = _deserialize_hand(state.get("player1_hand") or "[]")
    player2.hand = _deserialize_hand(state.get("player2_hand") or "[]")

    game = WarGame(
        game_id,
        player1,
        player2,
        max_rounds=int(state.get("max_rounds") or 1000),
    )
    game.round_counter = int(state.get("round_counter") or 0)
    game.total_wars = int(state.get("total_wars") or 0)
    game.status = game_row.get("status") or state.get("status") or "in_progress"

    winner_player = game_row.get("winner_player") or state.get("winner_player")
    game.winner = player1 if winner_player == 1 else player2 if winner_player == 2 else None
    return game


async def _legacy_round_summary(game_id: str) -> Tuple[int, int, int]:
    """Best-effort counts for games created before exact state persistence."""
    persisted_rounds = await db.execute_query(
        """
        SELECT winner_player, cards_won, is_war
        FROM rounds
        WHERE game_id = ?
        ORDER BY round_number ASC
        """,
        (game_id,),
    )
    p1_cards = 26
    p2_cards = 26
    total_wars = 0
    for persisted_round in persisted_rounds:
        cards_won = int(persisted_round.get("cards_won") or 0)
        p1_contribution = cards_won // 2
        p2_contribution = cards_won - p1_contribution
        p1_cards -= p1_contribution
        p2_cards -= p2_contribution
        if persisted_round.get("winner_player") == 1:
            p1_cards += cards_won
        elif persisted_round.get("winner_player") == 2:
            p2_cards += cards_won
        if persisted_round.get("is_war"):
            total_wars += 1

    return (
        max(0, min(52, p1_cards)),
        max(0, min(52, p2_cards)),
        total_wars,
    )


async def _load_or_migrate_game(game_id: str, game_row: Dict[str, Any]) -> WarGame:
    """Load exact state, or migrate a legacy game without resetting its round."""
    saved_game = await _load_saved_game(game_id, game_row)
    if saved_game:
        active_games[game_id] = saved_game
        return saved_game

    p1_cards, p2_cards, total_wars = await _legacy_round_summary(game_id)
    deck = Deck()
    deck.shuffle()
    player1 = Player("1", "Player 1")
    player2 = Player("2", "Player 2")
    player1.hand = deck.cards[:p1_cards]
    player2.hand = deck.cards[p1_cards:p1_cards + p2_cards]

    game = WarGame(game_id, player1, player2)
    game.round_counter = int(game_row.get("total_rounds") or 0)
    game.total_wars = total_wars
    game.status = game_row.get("status") or "in_progress"
    winner_player = game_row.get("winner_player")
    game.winner = player1 if winner_player == 1 else player2 if winner_player == 2 else None
    active_games[game_id] = game
    await _save_game_state(game)
    return game


def _build_round_records(
    game_id: str,
    result: Dict[str, Any],
) -> Tuple[RoundWithWarDetails, Tuple[Any, ...], List[Tuple[Any, ...]]]:
    round_id = str(uuid.uuid4())
    now = datetime.utcnow()
    p1_card = result["player1_card"].short_name
    p2_card = result["player2_card"].short_name
    round_params = (
        round_id,
        game_id,
        result["round_number"],
        p1_card,
        p2_card,
        1 if result["is_war"] else 0,
        result["war_round_count"],
        result["winner_player"],
        result["cards_won"],
        now.isoformat(),
    )

    war_params: List[Tuple[Any, ...]] = []
    war_details = []
    for step in result.get("war_details") or []:
        war_id = str(uuid.uuid4())
        p1_war_card = step["p1_war_card"].short_name if step.get("p1_war_card") else "NONE"
        p2_war_card = step["p2_war_card"].short_name if step.get("p2_war_card") else "NONE"
        war_params.append((
            war_id,
            round_id,
            step["war_round_number"],
            p1_war_card,
            p2_war_card,
            step.get("winner"),
            now.isoformat(),
        ))
        war_details.append({
            "id": war_id,
            "round_id": round_id,
            "war_round_number": step["war_round_number"],
            "player1_card": p1_war_card,
            "player2_card": p2_war_card,
            "winner_player": step.get("winner"),
            "created_at": now,
        })

    response = RoundWithWarDetails(
        id=round_id,
        game_id=game_id,
        round_number=result["round_number"],
        player1_card=p1_card,
        player2_card=p2_card,
        is_war=result["is_war"],
        war_round_count=result["war_round_count"],
        winner_player=result["winner_player"],
        cards_won=result["cards_won"],
        p1_remaining=result["p1_remaining"],
        p2_remaining=result["p2_remaining"],
        created_at=now,
        war_details=war_details,
    )
    return response, round_params, war_params


async def _update_game_record(game: WarGame, end_time: Optional[datetime] = None) -> None:
    winner_player = int(game.winner.player_id) if game.winner else None
    await db.execute_query(
        """
        UPDATE games
        SET total_rounds = ?, status = ?, winner_player = ?, end_time = ?
        WHERE id = ?
        """,
        (
            game.round_counter,
            game.status,
            winner_player,
            end_time.isoformat() if end_time else None,
            game.game_id,
        ),
    )


@router.post("", response_model=APIResponse[GameResponse], status_code=status.HTTP_201_CREATED)
async def create_game(payload: Optional[GameCreate] = None):
    """
    1. POST /api/games
    Starts a new War card game match, initializes players, deals cards, and persists game record.
    """
    game_create = payload or GameCreate()
    game_id = str(uuid.uuid4())
    now = datetime.utcnow()

    p1 = Player("1", game_create.player1_name or "Player 1")
    p2 = Player("2", game_create.player2_name or "Player 2")

    game = WarGame(game_id, p1, p2, max_rounds=game_create.max_rounds or 1000)
    game.start_game()
    active_games[game_id] = game

    # Persist in DB
    query = """
    INSERT INTO games (id, start_time, winner_player, total_rounds, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?);
    """
    await db.execute_query(query, (game_id, now.isoformat(), None, 0, "in_progress", now.isoformat()))
    await _save_game_state(game)

    game_resp = GameResponse(
        id=game_id,
        start_time=now,
        winner_player=None,
        total_rounds=0,
        status="in_progress",
        created_at=now,
        player1_name=p1.name,
        player2_name=p2.name,
    )
    return APIResponse(success=True, message="New game created successfully", data=game_resp)


@router.get("", response_model=PaginatedResponse[GameResponse])
async def list_games(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
):
    """
    2. GET /api/games
    Lists all recorded games with pagination and optional status filtering.
    """
    offset = (page - 1) * limit
    
    count_query = "SELECT COUNT(*) as cnt FROM games"
    params = []
    if status:
        count_query += " WHERE status = ?"
        params.append(status)
        
    count_res = await db.execute_query(count_query, params)
    total_items = count_res[0]["cnt"] if count_res else 0

    list_query = "SELECT * FROM games"
    if status:
        list_query += " WHERE status = ?"
    list_query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"

    queryParams = list(params) + [limit, offset]
    rows = await db.execute_query(list_query, queryParams)

    items = []
    for r in rows:
        items.append(
            GameResponse(
                id=r["id"],
                start_time=datetime.fromisoformat(r["start_time"]) if r.get("start_time") else datetime.utcnow(),
                end_time=datetime.fromisoformat(r["end_time"]) if r.get("end_time") else None,
                winner_player=r.get("winner_player"),
                total_rounds=r.get("total_rounds", 0),
                status=r.get("status", "in_progress"),
                created_at=datetime.fromisoformat(r["created_at"]) if r.get("created_at") else datetime.utcnow(),
            )
        )

    total_pages = (total_items + limit - 1) // limit if total_items > 0 else 0

    return PaginatedResponse(
        success=True,
        page=page,
        limit=limit,
        total_items=total_items,
        total_pages=total_pages,
        data=items,
    )


@router.get("/{game_id}", response_model=APIResponse[GameResponse])
async def get_game(game_id: str):
    """
    3. GET /api/games/{game_id}
    Retrieves detailed game state and metadata.
    """
    rows = await db.execute_query("SELECT * FROM games WHERE id = ?", (game_id,))
    if not rows:
        raise HTTPException(status_code=404, detail=f"Game with id {game_id} not found")

    r = rows[0]
    p1_name = "Player 1"
    p2_name = "Player 2"
    if game_id in active_games:
        p1_name = active_games[game_id].player1.name
        p2_name = active_games[game_id].player2.name
    else:
        state_rows = await db.execute_query(
            "SELECT player1_name, player2_name FROM game_states WHERE game_id = ?",
            (game_id,),
        )
        if state_rows:
            p1_name = state_rows[0].get("player1_name") or p1_name
            p2_name = state_rows[0].get("player2_name") or p2_name

    game_resp = GameResponse(
        id=r["id"],
        start_time=datetime.fromisoformat(r["start_time"]) if r.get("start_time") else datetime.utcnow(),
        end_time=datetime.fromisoformat(r["end_time"]) if r.get("end_time") else None,
        winner_player=r.get("winner_player"),
        total_rounds=r.get("total_rounds", 0),
        status=r.get("status", "in_progress"),
        created_at=datetime.fromisoformat(r["created_at"]) if r.get("created_at") else datetime.utcnow(),
        player1_name=p1_name,
        player2_name=p2_name,
    )
    return APIResponse(success=True, message="Game details retrieved", data=game_resp)


@router.get("/{game_id}/rounds", response_model=PaginatedResponse[RoundResponse])
async def get_game_rounds(
    game_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    """
    4. GET /api/games/{game_id}/rounds
    Retrieves all played rounds for a given match.
    """
    offset = (page - 1) * limit

    count_res = await db.execute_query("SELECT COUNT(*) as cnt FROM rounds WHERE game_id = ?", (game_id,))
    total_items = count_res[0]["cnt"] if count_res else 0

    rows = await db.execute_query(
        "SELECT * FROM rounds WHERE game_id = ? ORDER BY round_number ASC LIMIT ? OFFSET ?",
        (game_id, limit, offset),
    )

    rounds = [
        RoundResponse(
            id=r["id"],
            game_id=r["game_id"],
            round_number=r["round_number"],
            player1_card=r["player1_card"],
            player2_card=r["player2_card"],
            is_war=bool(r.get("is_war", 0)),
            war_round_count=r.get("war_round_count", 0),
            winner_player=r.get("winner_player"),
            cards_won=r.get("cards_won", 2),
            created_at=datetime.fromisoformat(r["created_at"]) if r.get("created_at") else datetime.utcnow(),
        )
        for r in rows
    ]

    total_pages = (total_items + limit - 1) // limit if total_items > 0 else 0

    return PaginatedResponse(
        success=True,
        page=page,
        limit=limit,
        total_items=total_items,
        total_pages=total_pages,
        data=rounds,
    )


@router.post("/{game_id}/next-round", response_model=APIResponse[RoundWithWarDetails])
async def play_next_round(game_id: str):
    """
    5. POST /api/games/{game_id}/next-round
    Plays a single step round in the War match.
    """
    game = active_games.get(game_id)
    if not game:
        rows = await db.execute_query("SELECT * FROM games WHERE id = ?", (game_id,))
        if not rows:
            raise HTTPException(status_code=404, detail="Game not found")
        if rows[0]["status"] != "in_progress":
            raise HTTPException(status_code=400, detail="Game is already completed")
        game = await _load_or_migrate_game(game_id, rows[0])

    if game.status != "in_progress":
        raise HTTPException(status_code=400, detail=f"Game is not in progress ({game.status})")

    res = game.play_round()
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])

    round_resp, round_params, war_params = _build_round_records(game_id, res)
    await db.execute_query(ROUND_INSERT_QUERY, round_params)
    if war_params:
        await db.execute_many(WAR_DETAIL_INSERT_QUERY, war_params)

    end_time = datetime.utcnow() if game.status == "completed" else None
    await _update_game_record(game, end_time=end_time)
    await _save_game_state(game)

    return APIResponse(success=True, message="Round played successfully", data=round_resp)


@router.post("/{game_id}/simulate", response_model=APIResponse[GameResponse])
async def simulate_game(game_id: str):
    """
    6. POST /api/games/{game_id}/simulate
    Simulates the game continuously until completion or max rounds threshold.
    """
    rows = await db.execute_query("SELECT * FROM games WHERE id = ?", (game_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Game not found")
    game_row = rows[0]
    if game_row.get("status") != "in_progress":
        raise HTTPException(status_code=400, detail="Game is already completed")

    game = active_games.get(game_id)
    if not game:
        game = await _load_or_migrate_game(game_id, game_row)

    round_records: List[Tuple[Any, ...]] = []
    war_records: List[Tuple[Any, ...]] = []

    while game.status == "in_progress":
        res = game.play_round()
        if "error" in res:
            break
        _, round_params, war_params = _build_round_records(game_id, res)
        round_records.append(round_params)
        war_records.extend(war_params)

    if round_records:
        await db.execute_many(ROUND_INSERT_QUERY, round_records)
    if war_records:
        await db.execute_many(WAR_DETAIL_INSERT_QUERY, war_records)

    now = datetime.utcnow()
    if game.status != "completed":
        p1_cards = game.player1.cards_remaining()
        p2_cards = game.player2.cards_remaining()
        game.winner = game.player1 if p1_cards > p2_cards else game.player2 if p2_cards > p1_cards else None
        game.status = "completed"

    winner_int = int(game.winner.player_id) if game.winner else None
    await _update_game_record(game, end_time=now)
    await _save_game_state(game)

    game_resp = GameResponse(
        id=game_id,
        start_time=datetime.fromisoformat(game_row["start_time"]) if game_row.get("start_time") else now,
        end_time=now,
        winner_player=winner_int,
        total_rounds=game.round_counter,
        status="completed",
        created_at=datetime.fromisoformat(game_row["created_at"]) if game_row.get("created_at") else now,
        player1_name=game.player1.name,
        player2_name=game.player2.name,
    )
    return APIResponse(success=True, message="Game simulation finished", data=game_resp)


@router.post("/{game_id}/complete", response_model=APIResponse[GameResponse])
async def complete_game(game_id: str):
    """
    7. POST /api/games/{game_id}/complete
    Manually finishes an ongoing game and determines current card count winner.
    """
    rows = await db.execute_query("SELECT * FROM games WHERE id = ?", (game_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Game not found")
    game_row = rows[0]
    game = active_games.get(game_id)
    if not game:
        game = await _load_or_migrate_game(game_id, game_row)

    now = datetime.utcnow()
    p1_cards = game.player1.cards_remaining()
    p2_cards = game.player2.cards_remaining()
    game.winner = game.player1 if p1_cards > p2_cards else game.player2 if p2_cards > p1_cards else None
    game.status = "completed"
    winner_int = int(game.winner.player_id) if game.winner else None

    await _update_game_record(game, end_time=now)
    await _save_game_state(game)

    game_resp = GameResponse(
        id=game_id,
        start_time=datetime.fromisoformat(game_row["start_time"]) if game_row.get("start_time") else now,
        end_time=now,
        winner_player=winner_int,
        total_rounds=game.round_counter,
        status="completed",
        created_at=datetime.fromisoformat(game_row["created_at"]) if game_row.get("created_at") else now,
        player1_name=game.player1.name,
        player2_name=game.player2.name,
    )
    return APIResponse(success=True, message="Game manually completed", data=game_resp)


@router.get("/{game_id}/state", response_model=APIResponse[Dict])
async def get_game_state(game_id: str):
    """
    8. GET /api/games/{game_id}/state
    Returns detailed internal state snapshot including cards remaining in hands.
    """
    game = active_games.get(game_id)
    if not game:
        rows = await db.execute_query("SELECT * FROM games WHERE id = ?", (game_id,))
        if not rows:
            raise HTTPException(status_code=404, detail="Game not found")
        game = await _load_or_migrate_game(game_id, rows[0])

    return APIResponse(success=True, message="Game state retrieved", data=game.get_game_state())

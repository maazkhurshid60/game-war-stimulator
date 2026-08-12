from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

class CardSchema(BaseModel):
    suit: str  # 'spades', 'hearts', 'diamonds', 'clubs'
    rank: str  # '2'-'10', 'J', 'Q', 'K', 'A'
    value: int # 2-14

class GameCreate(BaseModel):
    player1_name: Optional[str] = "Player 1"
    player2_name: Optional[str] = "Player 2"
    max_rounds: Optional[int] = 1000

class RoundResponse(BaseModel):
    id: int
    game_id: int
    round_number: int
    player1_card: CardSchema
    player2_card: CardSchema
    winner: str
    cards_won: int
    is_war: bool
    war_depth: int
    war_details: Optional[List[Dict[str, Any]]] = None
    player1_deck_count: int
    player2_deck_count: int
    timestamp: datetime

    class Config:
        from_attributes = True

class GameStateResponse(BaseModel):
    id: int
    player1_name: str
    player2_name: str
    status: str
    winner: Optional[str] = None
    total_rounds: int
    max_rounds: int
    total_wars: int
    player1_deck_count: int
    player2_deck_count: int
    player1_current_card: Optional[CardSchema] = None
    player2_current_card: Optional[CardSchema] = None
    last_round: Optional[RoundResponse] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class GameSimulateRequest(BaseModel):
    steps: Optional[int] = None  # None means play until game ends or max_rounds

class GlobalStatsResponse(BaseModel):
    total_games: int
    completed_games: int
    player1_wins: int
    player2_wins: int
    ties_or_max_rounds: int
    avg_rounds_per_game: float
    total_wars_fought: int
    avg_wars_per_game: float
    max_wars_in_single_game: int
    shortest_game_rounds: Optional[int] = None
    longest_game_rounds: Optional[int] = None

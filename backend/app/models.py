"""
Pydantic Data Models for War Card Game Simulator.
Includes request, response, card representations, analytics, and generic API response wrappers.
"""

from datetime import datetime
from typing import Generic, List, Optional, TypeVar, Any, Literal
from pydantic import BaseModel, Field, field_validator, computed_field

T = TypeVar("T")

# Valid suits and ranks constants
VALID_SUITS = {"hearts", "diamonds", "clubs", "spades"}
VALID_RANKS = {"2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"}
RANK_VALUE_MAP = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    "J": 11, "Q": 12, "K": 13, "A": 14
}
SUIT_SYMBOLS = {
    "hearts": "♥",
    "diamonds": "♦",
    "clubs": "♣",
    "spades": "♠"
}


# ============================================================================
# 1. Card Model
# ============================================================================

class Card(BaseModel):
    """
    Represents a playing card in a standard 52-card deck.

    Example:
        >>> card = Card(suit="hearts", rank="A", value=14)
        >>> card.display_name
        'A♥'
    """
    suit: str = Field(..., description="Card suit: hearts, diamonds, clubs, spades")
    rank: str = Field(..., description="Card rank: 2-10, J, Q, K, A")
    value: int = Field(..., ge=2, le=14, description="Card numerical value: 2-14")

    @field_validator("suit")
    @classmethod
    def validate_suit(cls, v: str) -> str:
        suit_lower = v.lower()
        if suit_lower not in VALID_SUITS:
            raise ValueError(f"Invalid suit: {v}. Must be one of {VALID_SUITS}")
        return suit_lower

    @field_validator("rank")
    @classmethod
    def validate_rank(cls, v: str) -> str:
        rank_upper = v.upper()
        if rank_upper not in VALID_RANKS:
            raise ValueError(f"Invalid rank: {v}. Must be one of {VALID_RANKS}")
        return rank_upper

    @computed_field
    @property
    def display_name(self) -> str:
        """Computes human-readable short display representation like '10H' or 'A♥'."""
        symbol = SUIT_SYMBOLS.get(self.suit, self.suit[0].upper())
        return f"{self.rank}{symbol}"


# ============================================================================
# 2. Game Models
# ============================================================================

class GameCreate(BaseModel):
    """
    Payload for initializing a new War game match.

    Example:
        >>> payload = GameCreate(player1_name="Alice", player2_name="Bob", max_rounds=1000)
    """
    player1_name: Optional[str] = Field(default="Player 1", max_length=50)
    player2_name: Optional[str] = Field(default="Player 2", max_length=50)
    max_rounds: Optional[int] = Field(default=1000, ge=10, le=10000)


class GameUpdate(BaseModel):
    """
    Payload for updating an ongoing game status.
    """
    status: Optional[Literal["in_progress", "completed", "abandoned"]] = None
    winner_player: Optional[Literal[1, 2]] = None
    end_time: Optional[datetime] = None


class GameResponse(BaseModel):
    """
    API Response model representing the full state of a game.
    """
    id: str = Field(..., description="UUID string identifier")
    start_time: datetime
    end_time: Optional[datetime] = None
    winner_player: Optional[int] = Field(None, description="1, 2, or None if ongoing/tie")
    total_rounds: int = 0
    status: str = "in_progress"
    created_at: datetime
    player1_name: str = "Player 1"
    player2_name: str = "Player 2"

    class Config:
        from_attributes = True


# ============================================================================
# 3. WarDetail Models
# ============================================================================

class WarDetailCreate(BaseModel):
    """
    Payload for recording a War tie step within a round.
    """
    round_id: str
    war_round_number: int
    player1_card: str
    player2_card: str
    winner_player: Optional[int] = None


class WarDetailResponse(BaseModel):
    """
    Response model for War tie details.
    """
    id: str
    round_id: str
    war_round_number: int
    player1_card: str
    player2_card: str
    winner_player: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# 4. Round Models
# ============================================================================

class RoundCreate(BaseModel):
    """
    Payload for logging a played round turn.
    """
    game_id: str
    round_number: int
    player1_card: str  # Format: "10H", "KS", "AD"
    player2_card: str
    is_war: bool = False
    war_round_count: int = 0
    winner_player: Optional[int] = None  # 1 or 2
    cards_won: int = 2


class RoundResponse(BaseModel):
    """
    Response model for individual game round.
    """
    id: str
    game_id: str
    round_number: int
    player1_card: str
    player2_card: str
    is_war: bool = False
    war_round_count: int = 0
    winner_player: Optional[int] = None
    cards_won: int = 2
    # Present on live round results so the UI can show the exact deck totals
    # immediately after resolving normal rounds and wars.
    p1_remaining: Optional[int] = Field(default=None, ge=0, le=52)
    p2_remaining: Optional[int] = Field(default=None, ge=0, le=52)
    created_at: datetime

    class Config:
        from_attributes = True


class RoundWithWarDetails(RoundResponse):
    """
    Extends RoundResponse to include nested war step breakdowns.
    """
    war_details: List[WarDetailResponse] = Field(default_factory=list)


# ============================================================================
# 5. Stats Models
# ============================================================================

class PlayerStats(BaseModel):
    """
    Summary stats for an individual player.
    """
    player_name: str
    total_games_played: int
    wins: int
    losses: int
    win_rate: float = Field(..., description="Percentage 0.0 - 100.0")


class GameStats(BaseModel):
    """
    Global analytics and overall game performance metrics.
    """
    total_games: int
    completed_games: int
    abandoned_games: int
    player1_wins: int
    player2_wins: int
    ties_or_max_rounds: int
    avg_rounds_per_game: float
    total_wars_fought: int
    avg_wars_per_game: float
    max_wars_in_single_game: int
    shortest_game_rounds: Optional[int] = None
    longest_game_rounds: Optional[int] = None


class LeaderboardEntry(BaseModel):
    """
    Entry for global top player leaderboard rankings.
    """
    rank: int
    player_name: str
    games_played: int
    wins: int
    win_rate: float


# ============================================================================
# 6. API Response Wrappers
# ============================================================================

class APIResponse(BaseModel, Generic[T]):
    """
    Standardized API Envelope response wrapper.

    Example:
        >>> resp = APIResponse[GameResponse](success=True, message="Game fetched", data=game_obj)
    """
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[T] = None
    errors: Optional[List[str]] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standardized paginated list response wrapper.
    """
    success: bool = True
    page: int = Field(default=1, ge=1)
    # Round history endpoints support fetching up to 200 records at once.
    # Keep the response model aligned with the route validation; otherwise
    # FastAPI turns an otherwise valid response into a 500 validation error.
    limit: int = Field(default=20, ge=1, le=200)
    total_items: int = Field(default=0, ge=0)
    total_pages: int = Field(default=0, ge=0)
    data: List[T] = Field(default_factory=list)

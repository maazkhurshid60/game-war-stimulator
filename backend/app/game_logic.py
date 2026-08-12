"""
War Card Game Engine.

Implements standard 52-card War mechanics with OOP design (Card, Deck, Player, WarGame),
tie war handling, cascading wars, card transfers, state tracking, and logging.
"""

import random
import logging
from typing import List, Optional, Dict, Any, Tuple

# Setup Logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


SUITS = ["hearts", "diamonds", "clubs", "spades"]
SUIT_SYMBOLS = {"hearts": "♥", "diamonds": "♦", "clubs": "♣", "spades": "♠"}
RANK_VALUES = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    "J": 11, "Q": 12, "K": 13, "A": 14
}


class Card:
    """
    Represents an individual playing card.
    """

    def __init__(self, rank: str, suit: str):
        rank_upper = rank.upper()
        suit_lower = suit.lower()
        if rank_upper not in RANK_VALUES:
            raise ValueError(f"Invalid rank: {rank}")
        if suit_lower not in SUITS:
            raise ValueError(f"Invalid suit: {suit}")

        self.rank: str = rank_upper
        self.suit: str = suit_lower

    @property
    def value(self) -> int:
        """Numerical strength value (2..14)."""
        return RANK_VALUES[self.rank]

    @property
    def display_name(self) -> str:
        """Human readable name like 'Ace of Hearts'."""
        return f"{self.rank} of {self.suit.capitalize()}"

    @property
    def short_name(self) -> str:
        """Short representation like '10H', 'AD'."""
        return f"{self.rank}{self.suit[0].upper()}"

    def __str__(self) -> str:
        symbol = SUIT_SYMBOLS.get(self.suit, "")
        return f"{self.rank}{symbol}"

    def __repr__(self) -> str:
        return f"Card('{self.rank}', '{self.suit}')"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Card):
            return False
        return self.value == other.value

    def __lt__(self, other: object) -> bool:
        if not isinstance(other, Card):
            raise TypeError("Cannot compare Card with non-Card")
        return self.value < other.value


class Deck:
    """
    Represents a deck of playing cards.
    """

    def __init__(self, cards: Optional[List[Card]] = None):
        self.cards: List[Card] = cards if cards is not None else self.create_standard_deck()

    @staticmethod
    def create_standard_deck() -> List[Card]:
        """Creates a standard 52-card deck."""
        deck = []
        for suit in SUITS:
            for rank in RANK_VALUES.keys():
                deck.append(Card(rank, suit))
        return deck

    def shuffle(self) -> None:
        """Shuffles the deck cards randomly."""
        random.shuffle(self.cards)
        logger.debug("Deck shuffled.")

    def draw(self) -> Optional[Card]:
        """Draws the top card from the deck."""
        if not self.cards:
            return None
        return self.cards.pop(0)

    def remaining_count(self) -> int:
        """Returns remaining card count."""
        return len(self.cards)

    def __len__(self) -> int:
        return self.remaining_count()


class Player:
    """
    Represents a player in the War card game.
    """

    def __init__(self, player_id: str, name: str = ""):
        self.player_id: str = player_id
        self.name: str = name if name else f"Player {player_id}"
        self.hand: List[Card] = []

    def add_cards(self, cards_list: List[Card]) -> None:
        """Adds a list of won cards to the bottom of player's hand."""
        self.hand.extend(cards_list)
        logger.debug(f"{self.name} received {len(cards_list)} cards. Total hand: {len(self.hand)}")

    def play_card(self) -> Optional[Card]:
        """Plays (draws) top card from hand."""
        if not self.hand:
            return None
        card = self.hand.pop(0)
        logger.debug(f"{self.name} played {card.short_name}")
        return card

    def cards_remaining(self) -> int:
        """Returns count of cards in hand."""
        return len(self.hand)

    def has_enough_cards(self, count: int) -> bool:
        """Checks if player has at least `count` cards remaining."""
        return len(self.hand) >= count

    def peek_top_card(self) -> Optional[Card]:
        """Peeks at top card without removing it."""
        return self.hand[0] if self.hand else None

    def get_hand_size(self) -> int:
        """Returns hand size."""
        return len(self.hand)

    def __str__(self) -> str:
        return f"{self.name} ({len(self.hand)} cards)"


class WarGame:
    """
    State machine & battle simulator for the War card game.
    """

    def __init__(self, game_id: str, player1: Player, player2: Player, max_rounds: int = 1000):
        self.game_id: str = game_id
        self.player1: Player = player1
        self.player2: Player = player2
        self.max_rounds: int = max_rounds
        self.round_counter: int = 0
        self.total_wars: int = 0
        self.status: str = "created"  # created, in_progress, completed, abandoned
        self.winner: Optional[Player] = None
        self.history: List[Dict[str, Any]] = []

    def start_game(self) -> None:
        """
        Shuffles standard deck, deals 26 cards to each player, and sets status to in_progress.
        """
        logger.info(f"Starting Game {self.game_id}: {self.player1.name} vs {self.player2.name}")
        deck = Deck()
        deck.shuffle()

        # Deal 26 cards to each
        self.player1.hand = deck.cards[:26]
        self.player2.hand = deck.cards[26:]
        self.status = "in_progress"
        self.round_counter = 0
        self.total_wars = 0
        self.history.clear()
        logger.info("Dealt 26 cards to each player successfully.")

    def play_round(self) -> Dict[str, Any]:
        """
        Plays a single turn/round of War.
        Returns detailed summary dictionary of the played round.
        """
        if self.status != "in_progress":
            return {"error": f"Game is not in progress (Current status: {self.status})"}

        if self.player1.cards_remaining() == 0 or self.player2.cards_remaining() == 0:
            self.check_winner()
            return {"error": "Game is already completed"}

        self.round_counter += 1
        p1_card = self.player1.play_card()
        p2_card = self.player2.play_card()

        if not p1_card or not p2_card:
            self.check_winner()
            return {"error": "Insufficient cards to play round"}

        table_cards: List[Card] = [p1_card, p2_card]
        comparison = self._compare_cards(p1_card, p2_card)

        round_data: Dict[str, Any] = {
            "round_number": self.round_counter,
            "player1_card": p1_card,
            "player2_card": p2_card,
            "is_war": False,
            "war_round_count": 0,
            "war_details": [],
            "winner_player": None,
            "cards_won": 0,
            "p1_remaining": self.player1.cards_remaining(),
            "p2_remaining": self.player2.cards_remaining()
        }

        if comparison > 0:
            # Player 1 wins round
            round_data["winner_player"] = 1
            round_data["cards_won"] = len(table_cards)
            self._transfer_cards(self.player1, table_cards)
            logger.info(f"Round {self.round_counter}: {self.player1.name} won {p1_card.short_name} vs {p2_card.short_name}")
        elif comparison < 0:
            # Player 2 wins round
            round_data["winner_player"] = 2
            round_data["cards_won"] = len(table_cards)
            self._transfer_cards(self.player2, table_cards)
            logger.info(f"Round {self.round_counter}: {self.player2.name} won {p1_card.short_name} vs {p2_card.short_name}")
        else:
            # WAR!
            logger.info(f"Round {self.round_counter}: WAR triggered! {p1_card.short_name} == {p2_card.short_name}")
            round_data["is_war"] = True
            self.total_wars += 1
            war_winner, war_depth, war_steps = self._handle_war(p1_card, p2_card, table_cards)
            
            round_data["war_round_count"] = war_depth
            round_data["war_details"] = war_steps
            round_data["cards_won"] = len(table_cards)

            if war_winner == 1:
                round_data["winner_player"] = 1
                self._transfer_cards(self.player1, table_cards)
            elif war_winner == 2:
                round_data["winner_player"] = 2
                self._transfer_cards(self.player2, table_cards)
            else:
                round_data["winner_player"] = None  # Tie/Draw if both ran out

        # Update remaining counts
        round_data["p1_remaining"] = self.player1.cards_remaining()
        round_data["p2_remaining"] = self.player2.cards_remaining()

        self.history.append(round_data)

        # Check win condition
        self.check_winner()

        return round_data

    def _handle_war(
        self,
        p1_init_card: Card,
        p2_init_card: Card,
        table_cards: List[Card]
    ) -> Tuple[Optional[int], int, List[Dict[str, Any]]]:
        """
        Handles War tie resolution recursively/iteratively until a player wins the pile.
        """
        war_depth = 0
        war_steps = []
        cur_p1_card = p1_init_card
        cur_p2_card = p2_init_card

        while cur_p1_card.value == cur_p2_card.value:
            war_depth += 1
            step_info: Dict[str, Any] = {
                "war_round_number": war_depth,
                "p1_burn": [],
                "p2_burn": [],
                "p1_war_card": None,
                "p2_war_card": None,
                "winner": None
            }

            # This simulator uses one additional face-up card per player for
            # each war stage. No hidden burn cards are removed from either
            # player's count.
            step_info["p1_burn"] = []
            step_info["p2_burn"] = []

            # Check if anyone is out of cards before drawing the war pair.
            if self.player1.cards_remaining() == 0 and self.player2.cards_remaining() == 0:
                logger.info(f"War depth {war_depth}: Both players ran out of cards during war!")
                return None, war_depth, war_steps
            elif self.player1.cards_remaining() == 0:
                logger.info(f"War depth {war_depth}: {self.player1.name} ran out of cards!")
                step_info["winner"] = 2
                war_steps.append(step_info)
                return 2, war_depth, war_steps
            elif self.player2.cards_remaining() == 0:
                logger.info(f"War depth {war_depth}: {self.player2.name} ran out of cards!")
                step_info["winner"] = 1
                war_steps.append(step_info)
                return 1, war_depth, war_steps

            # Each player contributes exactly one additional war card.
            next_p1_war = self.player1.play_card()
            next_p2_war = self.player2.play_card()

            if next_p1_war:
                table_cards.append(next_p1_war)
                step_info["p1_war_card"] = next_p1_war
            if next_p2_war:
                table_cards.append(next_p2_war)
                step_info["p2_war_card"] = next_p2_war

            if not next_p1_war or not next_p2_war:
                winner = 2 if not next_p1_war else 1
                step_info["winner"] = winner
                war_steps.append(step_info)
                return winner, war_depth, war_steps

            comp = self._compare_cards(next_p1_war, next_p2_war)
            if comp > 0:
                step_info["winner"] = 1
                war_steps.append(step_info)
                return 1, war_depth, war_steps
            elif comp < 0:
                step_info["winner"] = 2
                war_steps.append(step_info)
                return 2, war_depth, war_steps
            else:
                # Tie again -> Loop next war depth!
                cur_p1_card = next_p1_war
                cur_p2_card = next_p2_war
                war_steps.append(step_info)

        return None, war_depth, war_steps

    def _compare_cards(self, card1: Card, card2: Card) -> int:
        """
        Compares 2 cards. Returns >0 if card1 wins, <0 if card2 wins, 0 if tie.
        """
        if card1.value > card2.value:
            return 1
        elif card1.value < card2.value:
            return -1
        return 0

    def _transfer_cards(self, winner: Player, cards: List[Card]) -> None:
        """
        Shuffles spoils cards and adds them to winner's hand.
        """
        random.shuffle(cards)
        winner.add_cards(cards)

    def check_winner(self) -> Optional[Player]:
        """
        Checks if game is over and sets winner/status.
        """
        p1_count = self.player1.cards_remaining()
        p2_count = self.player2.cards_remaining()

        if p1_count == 0 or p2_count == 0 or self.round_counter >= self.max_rounds:
            self.status = "completed"
            if p1_count > p2_count:
                self.winner = self.player1
            elif p2_count > p1_count:
                self.winner = self.player2
            else:
                self.winner = None  # Tie game
            
            winner_str = self.winner.name if self.winner else "Tie"
            logger.info(f"Game Over! Final Winner: {winner_str} after {self.round_counter} rounds.")

        return self.winner

    def get_game_state(self) -> Dict[str, Any]:
        """
        Returns full state snapshot of the game.
        """
        return {
            "game_id": self.game_id,
            "status": self.status,
            "round_counter": self.round_counter,
            "total_wars": self.total_wars,
            "player1": {
                "id": self.player1.player_id,
                "name": self.player1.name,
                "cards_remaining": self.player1.cards_remaining()
            },
            "player2": {
                "id": self.player2.player_id,
                "name": self.player2.name,
                "cards_remaining": self.player2.cards_remaining()
            },
            "winner": self.winner.name if self.winner else None
        }

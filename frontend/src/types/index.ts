/**
 * TypeScript Type Definitions for War Card Game Simulator Frontend.
 * Includes Enums, Card, Game, Round, WarDetail, Stats, API Wrappers, and App State Interfaces.
 */

// ============================================================================
// Enums & Literal Union Types
// ============================================================================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export type GameStatus = 'in_progress' | 'completed' | 'abandoned';

export type Winner = 1 | 2 | null;


// ============================================================================
// Core Entities Interfaces
// ============================================================================

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number;
  display_name: string;
  short_name: string;
}

export interface Game {
  id: string;
  start_time: string;
  end_time: string | null;
  winner_player: Winner;
  total_rounds: number;
  status: GameStatus;
  created_at: string;
  player1_name?: string;
  player2_name?: string;
}

export interface WarDetail {
  id: string;
  round_id: string;
  war_round_number: number;
  player1_card: string;
  player2_card: string;
  winner_player: Winner;
  created_at: string;
}

export interface Round {
  id: string;
  game_id: string;
  round_number: number;
  player1_card: string;
  player2_card: string;
  is_war: boolean;
  war_round_count: number;
  winner_player: Winner;
  cards_won: number;
  p1_remaining?: number | null;
  p2_remaining?: number | null;
  created_at: string;
  war_details?: WarDetail[];
}


// ============================================================================
// API Response Wrappers
// ============================================================================

export interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[] | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  data: T[];
}


// ============================================================================
// Stats Interfaces
// ============================================================================

export interface GameStats {
  total_games: number;
  completed_games: number;
  abandoned_games: number;
  player1_wins: number;
  player2_wins: number;
  ties_or_max_rounds: number;
  avg_rounds_per_game: number;
  total_wars_fought: number;
  avg_wars_per_game: number;
  max_wars_in_single_game: number;
  shortest_game_rounds?: number | null;
  longest_game_rounds?: number | null;
}

export interface PlayerStats {
  player_name: string;
  total_games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export interface LeaderboardEntry {
  rank: number;
  player_name: string;
  games_played: number;
  wins: number;
  win_rate: number;
}


// ============================================================================
// App State Interfaces
// ============================================================================

export interface PlayerState {
  id: string;
  name: string;
  cards_remaining: number;
}

export interface GameState {
  game_id: string;
  status: GameStatus;
  round_counter: number;
  total_wars: number;
  player1: PlayerState;
  player2: PlayerState;
  winner?: string | null;
}

export interface RoundResult {
  round_number: number;
  player1_card: Card | string;
  player2_card: Card | string;
  is_war: boolean;
  war_round_count: number;
  winner_player: Winner;
  cards_won: number;
  war_details?: WarDetail[];
}

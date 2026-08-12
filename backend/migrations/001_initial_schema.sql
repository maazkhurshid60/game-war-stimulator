-- Migration Script: 001_initial_schema.sql
-- Target Database: Turso (libsql://war-game-maazkhurshid60.aws-ap-south-1.turso.io)

-- Enable foreign keys constraint enforcement in SQLite/libSQL
PRAGMA foreign_keys = ON;

-- ============================================================================
-- Table 1: games
-- ============================================================================
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    winner_player INTEGER CHECK (winner_player IN (1, 2) OR winner_player IS NULL),
    total_rounds INTEGER DEFAULT 0,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Table 2: rounds
-- ============================================================================
CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    player1_card TEXT NOT NULL,
    player2_card TEXT NOT NULL,
    is_war BOOLEAN DEFAULT 0,
    war_round_count INTEGER DEFAULT 0,
    winner_player INTEGER CHECK (winner_player IN (1, 2) OR winner_player IS NULL),
    cards_won INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- ============================================================================
-- Table 3: war_details
-- ============================================================================
CREATE TABLE IF NOT EXISTS war_details (
    id TEXT PRIMARY KEY,
    round_id TEXT NOT NULL,
    war_round_number INTEGER NOT NULL,
    player1_card TEXT NOT NULL,
    player2_card TEXT NOT NULL,
    winner_player INTEGER CHECK (winner_player IN (1, 2) OR winner_player IS NULL),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE
);

-- Exact resumable state. Round logs alone cannot recover shuffled deck order
-- after the API process restarts.
CREATE TABLE IF NOT EXISTS game_states (
    game_id TEXT PRIMARY KEY,
    player1_name TEXT NOT NULL DEFAULT 'Player 1',
    player2_name TEXT NOT NULL DEFAULT 'Player 2',
    player1_hand TEXT NOT NULL,
    player2_hand TEXT NOT NULL,
    round_counter INTEGER NOT NULL DEFAULT 0,
    total_wars INTEGER NOT NULL DEFAULT 0,
    max_rounds INTEGER NOT NULL DEFAULT 1000,
    status TEXT NOT NULL DEFAULT 'in_progress',
    winner_player INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_rounds_game_id ON rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_rounds_created_at ON rounds(created_at);
CREATE INDEX IF NOT EXISTS idx_war_details_round_id ON war_details(round_id);
CREATE INDEX IF NOT EXISTS idx_game_states_updated_at ON game_states(updated_at);

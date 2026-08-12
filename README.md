# War Card Game Simulator

Full-stack War card game simulator built with FastAPI, SQLite/Turso-compatible SQL storage, and React TypeScript.

This project implements the classic two-player War card game with interactive round play, full-game simulation, resumable game state, round history, and analytics.

## Features

- Start a new War game with a shuffled 52-card deck.
- Deal 26 cards to each player.
- Play one round at a time.
- Simulate the full game until completion.
- Handle War/tie rounds.
- Persist exact game state so a user can leave and resume the same game.
- View round logs and analytics.
- Export game/stat reports as CSV from the frontend.
- Light UI with real playing-card visuals.

## Technology Stack

Backend:

- Python 3.10+
- FastAPI
- Pydantic v2
- Uvicorn
- SQLite fallback
- Turso/libSQL compatible design

Frontend:

- React 18
- TypeScript
- Tailwind CSS
- Axios
- Recharts
- Framer Motion
- React Hot Toast

Database:

- SQLite locally by default
- Turso/libSQL-compatible schema

## Project Structure

```text
war-game/
  backend/
    app/
      main.py              FastAPI app setup, CORS, startup, health checks
      database.py          DB connection manager and schema initialization
      game_logic.py        Core War simulator classes and game rules
      models.py            Pydantic request/response models
      routes/
        games.py           Game creation, rounds, simulation, state APIs
        stats.py           Analytics and leaderboard APIs
    migrations/
      001_initial_schema.sql
    requirements.txt
    Dockerfile

  frontend/
    src/
      App.tsx
      pages/
        HomePage.tsx
        GamePage.tsx
        StatsPage.tsx
      components/
        CardAsset.tsx
        CardDisplay.tsx
        GameBoard.tsx
        GameController.tsx
        RoundHistory.tsx
        GameStats.tsx
      services/
        api.ts
        sound.ts
      types/
        index.ts
    package.json
    Dockerfile

  docker-compose.yml
  README.md
```

## SQL Schema

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    winner_player INTEGER CHECK (winner_player IN (1, 2) OR winner_player IS NULL),
    total_rounds INTEGER DEFAULT 0,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_rounds_game_id ON rounds(game_id);
CREATE INDEX IF NOT EXISTS idx_rounds_created_at ON rounds(created_at);
CREATE INDEX IF NOT EXISTS idx_war_details_round_id ON war_details(round_id);
CREATE INDEX IF NOT EXISTS idx_game_states_updated_at ON game_states(updated_at);
```

## Schema Notes and Assumptions

- `games` stores match-level metadata.
- `rounds` stores one top-level round per play.
- `war_details` stores nested tie-resolution steps for rounds that triggered War.
- `game_states` stores the exact remaining hands as JSON so the game can resume after browser refresh or backend restart.
- `winner_player` is `1`, `2`, or `NULL` for tie/ongoing.
- Cards are stored in short format such as `AS`, `10H`, `KD`.

## Game Rules Implemented

- A standard 52-card deck is shuffled.
- Player 1 and Player 2 each receive 26 cards.
- Each round, both players reveal their top card.
- Higher rank wins the round and receives the played cards.
- Card values: `2` low, Ace high.
- If cards have equal rank, War starts.
- In this implementation, each War stage uses one additional face-up card from each player.
- If the War card also ties, War repeats until one player wins or both cannot continue.
- The game ends when one player has all cards, a player runs out of cards, or the maximum round limit is reached.
- If maximum rounds are reached, the player with more cards wins.

## Backend API Summary

Game APIs:

```text
POST   /api/games
GET    /api/games
GET    /api/games/{game_id}
GET    /api/games/{game_id}/rounds
POST   /api/games/{game_id}/next-round
POST   /api/games/{game_id}/simulate
POST   /api/games/{game_id}/complete
GET    /api/games/{game_id}/state
```

Stats APIs:

```text
GET /api/stats/overview
GET /api/stats/player/{player_id}
GET /api/stats/most-wars
GET /api/stats/leaderboard
GET /api/stats/recent
```

System APIs:

```text
GET /health
GET /docs
GET /redoc
```

## Design Decisions

- The core simulator is isolated in `game_logic.py` using `Card`, `Deck`, `Player`, and `WarGame` classes.
- API routes do not directly implement card rules; they call the game engine and persist results.
- The database stores both event history and exact resumable state.
- Round history is separate from current state. This makes analytics easy while still allowing exact resume.
- The frontend uses a typed API service layer so components do not call Axios directly.
- The UI fetches game metadata, current state, and full round history separately.
- Simulate mode persists every generated round, not only the final result.
- Manual complete chooses the winner based on current card counts.

## How To Run Locally

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Open:

```text
http://localhost:3000
```

API documentation:

```text
http://localhost:8000/docs
```

## Environment Variables

Backend optional `.env`:

```env
PROJECT_NAME=War Card Game Simulator API
DATABASE_URL=sqlite:///./war_game.db
CORS_ORIGINS=["http://localhost:3000"]
DEBUG=True
```

For Turso/libSQL:

```env
TURSO_DATABASE_URL=libsql://your-database-url
TURSO_AUTH_TOKEN=your-token
CORS_ORIGINS=["http://localhost:3000"]
```

Frontend optional `.env`:

```env
REACT_APP_API_URL=http://localhost:8000
```

## Docker Run

```bash
docker-compose up --build
```

Services:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

## Testing and Verification

Backend syntax check:

```bash
cd backend
python -m compileall -q app
```

Frontend production build:

```bash
cd frontend
npm run build
```

Manual verification flow:

1. Start backend and frontend.
2. Create a new game.
3. Confirm both players start with 26 cards.
4. Play one round.
5. Confirm round number increments and card counts update.
6. Refresh page or leave/reopen game URL.
7. Confirm the game resumes from the same round and card counts.
8. Click Simulate All.
9. Confirm final result shows Player 1 wins, Player 2 wins, tie/war rounds, and final winner.

## Submission Zip Notes

Include:

```text
backend/
frontend/
docker-compose.yml
README.md
DEPLOYMENT.md if desired
```

Do not include:

```text
frontend/node_modules/
frontend/build/
backend/venv/
backend/war_game.db
__pycache__/
*.pyc
```

## Time-Box Note

This implementation was time-boxed around the expected 4-6 hour exercise scope. The focus was on delivering a working simulator, persistent game state, REST APIs, frontend gameplay, and analytics.

With more time, I would improve/add:

- Automated backend unit tests for deterministic War scenarios.
- Frontend component tests for card counts and final result rendering.
- A seed option for reproducible simulations.
- Better migration/version management instead of a single initial SQL file.
- WebSocket updates for live multi-tab game state.
- Cleaner packaging script for generating a submission zip.
- More robust analytics, such as average war depth and longest tie chain.
- Authentication or named users if this became a multi-user product.
# game-war-stimulator

import os
import asyncio
import logging
from typing import Any, Dict, List, Optional, Union, Tuple
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import libsql_experimental or fallback to sqlite3
try:
    import libsql_experimental as libsql
    HAS_LIBSQL = True
except ImportError:
    import sqlite3 as libsql  # fallback for standard sqlite
    HAS_LIBSQL = False
    logger.warning("libsql-experimental is not installed. Falling back to local sqlite3 database.")


class Database:
    """
    Database connection manager for Turso (libSQL) and SQLite with async support,
    connection pooling, type hinting, and robust error handling.
    """

    def __init__(self):
        self.turso_url: str = os.getenv(
            "TURSO_DATABASE_URL",
            os.getenv("DATABASE_URL", "sqlite:///./war_game.db")
        )
        self.auth_token: str = os.getenv("TURSO_AUTH_TOKEN", "")
        self._connection = None
        self._lock = asyncio.Lock()
        
        if self.turso_url.startswith("sqlite:///"):
            self.db_path = self.turso_url.replace("sqlite:///", "")
            self.is_remote = False
        elif HAS_LIBSQL and (self.turso_url.startswith("libsql://") or self.turso_url.startswith("https://")):
            self.db_path = self.turso_url
            self.is_remote = True
        else:
            # Fallback for standard sqlite when libsql is not present
            self.db_path = "war_game.db"
            self.is_remote = False

    async def get_connection(self):
        """
        Retrieves or initializes a thread-safe connection to Turso / SQLite.
        """
        async with self._lock:
            if self._connection is None:
                try:
                    logger.info(f"Connecting to database: {self.db_path} (Remote: {self.is_remote})")
                    
                    def _connect():
                        if self.is_remote and HAS_LIBSQL:
                            return libsql.connect(self.db_path, auth_token=self.auth_token)
                        elif HAS_LIBSQL:
                            return libsql.connect(self.db_path)
                        else:
                            import sqlite3
                            conn = sqlite3.connect(self.db_path, check_same_thread=False)
                            conn.row_factory = sqlite3.Row
                            return conn

                    self._connection = await asyncio.to_thread(_connect)
                    logger.info("Database connection successfully established.")
                except Exception as e:
                    logger.error(f"Failed to connect to database: {str(e)}", exc_info=True)
                    raise e

            return self._connection

    async def execute_query(
        self,
        query: str,
        params: Optional[Union[Tuple[Any, ...], Dict[str, Any], List[Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes a read or write SQL query asynchronously and returns dictionary formatted rows.
        """
        conn = await self.get_connection()
        params = params or ()

        def _sync_execute():
            try:
                cursor = conn.cursor()
                cursor.execute(query, params)
                
                # Check if statement returns data (e.g. SELECT)
                if cursor.description:
                    columns = [col[0] for col in cursor.description]
                    rows = cursor.fetchall()
                    result = []
                    for row in rows:
                        if isinstance(row, dict):
                            result.append(row)
                        elif hasattr(row, "keys"):
                            result.append(dict(row))
                        else:
                            result.append(dict(zip(columns, row)))
                    return result
                else:
                    conn.commit()
                    return []
            except Exception as err:
                logger.error(f"Query execution error: {err} | Query: {query} | Params: {params}")
                raise err

        return await asyncio.to_thread(_sync_execute)

    async def execute_many(
        self,
        query: str,
        params_list: List[Union[Tuple[Any, ...], Dict[str, Any], List[Any]]]
    ) -> None:
        """
        Executes batch queries with a list of parameter sets asynchronously.
        """
        conn = await self.get_connection()

        def _sync_execute_many():
            try:
                cursor = conn.cursor()
                if hasattr(cursor, "executemany"):
                    cursor.executemany(query, params_list)
                else:
                    for param in params_list:
                        cursor.execute(query, param)
                conn.commit()
                logger.info(f"Batch query executed successfully with {len(params_list)} parameter sets.")
            except Exception as err:
                logger.error(f"Batch query execution error: {err} | Query: {query}")
                raise err

        await asyncio.to_thread(_sync_execute_many)

    async def create_tables(self) -> None:
        """
        Executes the initial DDL schema to create tables (games, rounds, war_details) and indexes.
        """
        migration_path = Path(__file__).parent.parent / "migrations" / "001_initial_schema.sql"
        if migration_path.exists():
            sql_script = migration_path.read_text(encoding="utf-8")
        else:
            sql_script = """
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
            """

        statements = [stmt.strip() for stmt in sql_script.split(";") if stmt.strip()]
        for stmt in statements:
            await self.execute_query(stmt)
            
        logger.info("All database tables and indexes created successfully.")

    async def drop_tables(self) -> None:
        """
        Drops all application tables from the database.
        """
        drop_statements = [
            "DROP TABLE IF EXISTS game_states;",
            "DROP TABLE IF EXISTS war_details;",
            "DROP TABLE IF EXISTS rounds;",
            "DROP TABLE IF EXISTS games;"
        ]
        for stmt in drop_statements:
            await self.execute_query(stmt)
        logger.info("All database tables dropped successfully.")

    async def close_connection(self) -> None:
        """
        Closes the active database connection.
        """
        async with self._lock:
            if self._connection is not None:
                def _sync_close():
                    try:
                        self._connection.close()
                    except Exception as err:
                        logger.error(f"Error closing database connection: {err}")

                await asyncio.to_thread(_sync_close)
                self._connection = None
                logger.info("Database connection closed successfully.")


# Global Database instance
db = Database()

async def get_db_connection():
    return await db.get_connection()

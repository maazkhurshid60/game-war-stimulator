"""
Turso Migration Runner Script
Executes 001_initial_schema.sql against a Turso (libSQL) database or local SQLite.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

TURSO_DATABASE_URL = os.getenv(
    "TURSO_DATABASE_URL",
    "libsql://war-game-maazkhurshid60.aws-ap-south-1.turso.io"
)
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")

def run_migration():
    migration_file = Path(__file__).parent.parent / "migrations" / "001_initial_schema.sql"
    if not migration_file.exists():
        print(f"Error: Migration file not found at {migration_file}")
        sys.exit(1)

    sql_statements = migration_file.read_text(encoding="utf-8")

    print(f"Connecting to database: {TURSO_DATABASE_URL}")

    if TURSO_DATABASE_URL.startswith("libsql://") or TURSO_DATABASE_URL.startswith("https://"):
        try:
            import libsql_experimental as libsql
            conn = libsql.connect(TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN)
            cursor = conn.cursor()
            for statement in sql_statements.split(";"):
                stmt = statement.strip()
                if stmt:
                    cursor.execute(stmt)
            conn.commit()
            print("Successfully applied migration to Turso database!")
        except ImportError:
            print("\nNote: 'libsql-experimental' package is not installed.")
            print("You can run the DDL directly using Turso CLI:")
            print(f"  turso db shell war-game < backend/migrations/001_initial_schema.sql")
    else:
        import sqlite3
        conn = sqlite3.connect("war_game.db")
        conn.executescript(sql_statements)
        conn.commit()
        conn.close()
        print("Successfully applied migration to local SQLite database!")

if __name__ == "__main__":
    run_migration()

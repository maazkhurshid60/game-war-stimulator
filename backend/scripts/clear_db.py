import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

TURSO_DATABASE_URL = os.getenv(
    "TURSO_DATABASE_URL",
    ""
)
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./war_game.db")

# Detect whether we have libsql
try:
    import libsql_experimental as libsql
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False

def clear_database():
    # SQL commands to clear data while retaining the tables
    clear_statements = [
        "PRAGMA foreign_keys = OFF;",
        "DELETE FROM war_details;",
        "DELETE FROM rounds;",
        "DELETE FROM games;",
        "PRAGMA foreign_keys = ON;"
    ]

    # Determine database path matching database.py
    is_remote = False
    db_path = "war_game.db"

    if TURSO_DATABASE_URL.startswith("sqlite:///"):
        db_path = TURSO_DATABASE_URL.replace("sqlite:///", "")
    elif HAS_LIBSQL and (TURSO_DATABASE_URL.startswith("libsql://") or TURSO_DATABASE_URL.startswith("https://")):
        db_path = TURSO_DATABASE_URL
        is_remote = True
    else:
        # Fallback to local SQLite database
        db_path = "war_game.db"

    print(f"Connecting to database to clear data: {db_path} (Remote: {is_remote})")

    if is_remote and HAS_LIBSQL:
        try:
            conn = libsql.connect(db_path, auth_token=TURSO_AUTH_TOKEN)
            cursor = conn.cursor()
            for stmt in clear_statements:
                cursor.execute(stmt)
            conn.commit()
            conn.close()
            print("Successfully cleared all data from Turso remote database!")
        except Exception as e:
            print(f"Error clearing remote database: {e}")
            sys.exit(1)
    else:
        try:
            import sqlite3
            # Check standard path
            db_file = db_path
            if not os.path.exists(db_file):
                # Try relative to backend dir
                db_file = Path(__file__).parent.parent / db_path
            
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            for stmt in clear_statements:
                cursor.execute(stmt)
            conn.commit()
            conn.close()
            print(f"Successfully cleared all data from local SQLite database: {db_file}")
        except Exception as e:
            print(f"Error clearing local SQLite database: {e}")
            sys.exit(1)

if __name__ == "__main__":
    clear_database()

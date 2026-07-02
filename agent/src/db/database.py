import os
import sqlite3

DB_DIR = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'Orbit', 'config')
DB_PATH = os.path.join(DB_DIR, 'orbit_agent.db')

def init_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create clients table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paired_clients (
            client_id TEXT PRIMARY KEY,
            client_name TEXT,
            public_key TEXT,
            shared_secret TEXT,
            paired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create active sessions table for pending pairings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pending_pairings (
            pairing_session_token TEXT PRIMARY KEY,
            client_id TEXT,
            client_name TEXT,
            public_key TEXT,
            pin TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create scenarios table for macro automations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            steps TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

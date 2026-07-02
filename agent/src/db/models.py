from db.database import get_db_connection

def add_pending_pairing(session_token: str, client_id: str, client_name: str, public_key: str, pin: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO pending_pairings (pairing_session_token, client_id, client_name, public_key, pin)
        VALUES (?, ?, ?, ?, ?)
    """, (session_token, client_id, client_name, public_key, pin))
    conn.commit()
    conn.close()

def get_pending_pairing(session_token: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pending_pairings WHERE pairing_session_token = ?", (session_token,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_pending_pairing(session_token: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM pending_pairings WHERE pairing_session_token = ?", (session_token,))
    conn.commit()
    conn.close()

def add_paired_client(client_id: str, client_name: str, public_key: str, shared_secret: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO paired_clients (client_id, client_name, public_key, shared_secret)
        VALUES (?, ?, ?, ?)
    """, (client_id, client_name, public_key, shared_secret))
    conn.commit()
    conn.close()

def get_paired_client(client_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM paired_clients WHERE client_id = ?", (client_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_paired_clients():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM paired_clients")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

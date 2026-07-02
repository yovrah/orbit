from db.database import get_db_connection

def add_scenario(name: str, description: str, steps_json: str) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO scenarios (name, description, steps)
        VALUES (?, ?, ?)
    """, (name, description, steps_json))
    scenario_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return scenario_id

def get_scenarios() -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM scenarios ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_scenario(scenario_id: int) -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM scenarios WHERE id = ?", (scenario_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_scenario(scenario_id: int, name: str, description: str, steps_json: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE scenarios
        SET name = ?, description = ?, steps = ?
        WHERE id = ?
    """, (name, description, steps_json, scenario_id))
    conn.commit()
    conn.close()

def delete_scenario(scenario_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM scenarios WHERE id = ?", (scenario_id,))
    conn.commit()
    conn.close()

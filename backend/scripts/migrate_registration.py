"""Migración: agrega columna student_id a la tabla users.
Ejecutar: python -m scripts.migrate_registration
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.db.session import engine

MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(50) UNIQUE",
]

def migrate():
    print("[MIGRATE] Iniciando migración de registro...")
    with engine.connect() as conn:
        for sql in MIGRATIONS:
            print(f"  → {sql}")
            conn.execute(text(sql))
        conn.commit()
    print("[MIGRATE] ✅ Migración completada. Columna student_id añadida.")

if __name__ == "__main__":
    migrate()

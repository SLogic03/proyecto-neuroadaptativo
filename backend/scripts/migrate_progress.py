"""Migración: agrega columnas de progreso a la tabla enrollments.
Ejecutar: python -m scripts.migrate_progress
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from app.db.session import engine

MIGRATIONS = [
    "ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS current_chapter_index INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS completed_quizzes TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER NOT NULL DEFAULT 0",
]

def migrate():
    print("[MIGRATE] Iniciando migración de progreso...")
    with engine.connect() as conn:
        for sql in MIGRATIONS:
            print(f"  → {sql}")
            conn.execute(text(sql))
        conn.commit()
    print("[MIGRATE] ✅ Migración completada. Columnas de progreso añadidas.")

if __name__ == "__main__":
    migrate()

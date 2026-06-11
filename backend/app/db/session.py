"""Conexión y sesión de SQLAlchemy para PostgreSQL.

Lee la URL de conexión desde la variable de entorno ``DATABASE_URL``.
Por defecto apunta al contenedor PostgreSQL definido en docker-compose.yml:

    postgresql://neuro_user:neuro_password@localhost:5432/neuro_db
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ── URL de conexión ───────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neuro_user:neuro_password@localhost:5432/neuro_db",
)

# ── Motor y sesión ────────────────────────────────────────────────
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Base declarativa (SQLAlchemy 2.x) ────────────────────────────
class Base(DeclarativeBase):
    """Clase base para todos los modelos ORM del proyecto."""
    pass


# ── Dependencia FastAPI (inyección de sesión por request) ─────────
def get_db():
    """Generador que entrega una sesión de BD y la cierra al terminar.

    Uso típico en un endpoint::

        @router.get("/items")
        def list_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

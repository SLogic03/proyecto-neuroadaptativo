"""Script de semilla (seed) para la base de datos PostgreSQL.

Ejecutar desde la raíz del backend::

    python -m scripts.seed_db

Comportamiento:
1. Crea todas las tablas definidas en ``app.db.models`` si no existen.
2. Inserta un usuario Super Administrador por defecto si no existe.
"""

import sys
import os

# Asegurar que el paquete 'app' sea importable cuando se ejecuta
# directamente como script (python -m scripts.seed_db)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import Base, engine, SessionLocal
from app.db.models import User, UserRole  # noqa: F401 – registra los modelos en Base
from app.core.security import get_password_hash

# ── Datos del Super Administrador ─────────────────────────────────
ADMIN_EMAIL = "admin@espe.edu.ec"
ADMIN_PASSWORD = "admin"
ADMIN_FULL_NAME = "Jose Sebastian Lojan Vicuña"
ADMIN_ROLE = UserRole.admin


def seed() -> None:
    """Crea las tablas y el usuario admin inicial."""

    # 1. Crear todas las tablas (sin efecto si ya existen)
    print("[SEED] Creando tablas en la base de datos…")
    Base.metadata.create_all(bind=engine)
    print("[SEED] ✅ Tablas sincronizadas correctamente.")

    # 2. Insertar Super Administrador si no existe
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()

        if existing:
            print(
                f"[SEED] ℹ️  El usuario admin '{ADMIN_EMAIL}' ya existe "
                f"(id={existing.id}). No se creó duplicado."
            )
        else:
            admin_user = User(
                email=ADMIN_EMAIL,
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                full_name=ADMIN_FULL_NAME,
                role=ADMIN_ROLE,
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print(
                f"[SEED] ✅ Super Administrador creado exitosamente:\n"
                f"       Nombre: {admin_user.full_name}\n"
                f"       Email:  {admin_user.email}\n"
                f"       Rol:    {admin_user.role.value}\n"
                f"       ID:     {admin_user.id}"
            )
    except Exception as e:
        db.rollback()
        print(f"[SEED] ❌ Error al crear el usuario admin: {e}")
        raise
    finally:
        db.close()

    print("[SEED] Proceso de semilla finalizado.")


if __name__ == "__main__":
    seed()

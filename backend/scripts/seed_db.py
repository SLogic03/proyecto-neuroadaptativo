"""Script de semilla (seed) para la base de datos PostgreSQL.

Ejecutar desde la raíz del backend::

    python -m scripts.seed_db

Comportamiento:
1. Crea todas las tablas definidas en ``app.db.models`` si no existen.
2. Inserta un usuario Super Administrador por defecto si no existe.
"""

import sys
import os
import json

# Asegurar que el paquete 'app' sea importable cuando se ejecuta
# directamente como script (python -m scripts.seed_db)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import Base, engine, SessionLocal
from app.db.models import User, UserRole, Course, Enrollment  # noqa: F401 – registra los modelos en Base
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
            admin_user = existing
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
    # 3. Insertar Curso por defecto
    try:
        existing_course = db.query(Course).filter(Course.title == "Inducción Estudiantil - Normas ESPE").first()
        if existing_course:
            course = existing_course
            print(f"[SEED] ℹ️  El curso '{course.title}' ya existe (id={course.id}).")
        else:
            course_data = [
                {"section": "1. Derechos Inalienables", "text": "Todo estudiante admitido adquiere los derechos establecidos en la Constitución y las leyes orgánicas de educación superior, incluyendo la gratuidad, equidad, y acceso a servicios de bienestar estudiantil."},
                {"section": "2. Sanciones Disciplinarias", "text": "El incumplimiento reiterado de las normativas de la Universidad, así como cometer fraude académico, podrá resultar en faltas leves, graves o muy graves, derivando en suspensión o expulsión."},
                {"section": "3. Procedimientos de Matrícula", "text": "La matrícula ordinaria, extraordinaria y especial debe realizarse mediante el sistema institucional en las fechas del calendario académico oficial. No se permiten matrículas extemporáneas sin la debida justificación de fuerza mayor."}
            ]
            course = Course(
                title="Inducción Estudiantil - Normas ESPE",
                description="Curso fundamental sobre la normativa y estatutos de la universidad.",
                content_data=json.dumps(course_data)
            )
            db.add(course)
            db.commit()
            db.refresh(course)
            print(f"[SEED] ✅ Curso por defecto creado exitosamente (id={course.id}).")

        # 4. Matricular al admin en el curso
        if admin_user and course:
            enrollment = db.query(Enrollment).filter(
                Enrollment.user_id == admin_user.id,
                Enrollment.course_id == course.id
            ).first()
            if not enrollment:
                new_enrollment = Enrollment(user_id=admin_user.id, course_id=course.id)
                db.add(new_enrollment)
                db.commit()
                print(f"[SEED] ✅ Admin matriculado exitosamente en el curso '{course.title}'.")
            else:
                 print(f"[SEED] ℹ️  El admin ya estaba matriculado en el curso '{course.title}'.")

    except Exception as e:
        db.rollback()
        print(f"[SEED] ❌ Error al crear curso o matrícula: {e}")
        raise
    finally:
        db.close()

    print("[SEED] Proceso de semilla finalizado.")


if __name__ == "__main__":
    seed()

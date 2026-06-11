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
    # 3. Insertar o actualizar Curso por defecto
    try:
        course_data = [
            {
                "section": "1. Contexto y Autonomía Universitaria",
                "text": "La Constitución y la Ley Orgánica de Educación Superior (LOES) reconocen a las universidades y escuelas politécnicas autonomía académica, administrativa, financiera y orgánica. Esto incluye la libertad para nombrar a sus autoridades, profesores e investigadores en consonancia con los principios de alternancia y equidad."
            },
            {
                "section": "2. Vinculación del Personal Ocasional",
                "text": "Para el personal académico ocasional tipo 1, normalmente se exige acreditar al menos una obra de relevancia o un artículo indexado en bases de datos mundiales. Sin embargo, mediante la Resolución ESPE-HCU-RES-2025-058, el Honorable Consejo Universitario ha establecido una excepción temporal para una rama específica."
            },
            {
                "section": "3. Disposición Transitoria: Ciencias Médicas",
                "text": "Para la vinculación del personal académico Ocasional 1 del Departamento de Ciencias Médicas, el requisito de publicación científica podrá ser sustituido por la participación como expositor en al menos 1 congreso médico en los últimos 5 años, o por la aprobación de 3 eventos científicos de mínimo 32 horas. Esta disposición estará vigente únicamente hasta la finalización del periodo académico SII-2025.",
                "question": {
                    "text": "PUNTO DE CONTROL: ¿Cuál es el requisito alternativo principal que permite esta resolución para los docentes de Ciencias Médicas?",
                    "options": [
                        "Acreditar 10 años de experiencia en hospitales públicos.",
                        "Participar como expositor en al menos 1 congreso médico en los últimos 5 años.",
                        "Publicar un libro sobre medicina interna."
                    ],
                    "correctIndex": 1
                }
            }
        ]
        course_json = json.dumps(course_data, ensure_ascii=False)

        existing_course = db.query(Course).filter(Course.title == "Inducción Estudiantil - Normas ESPE").first()
        if existing_course:
            course = existing_course
            # Siempre actualizar el content_data para reflejar cambios en la semilla
            course.content_data = course_json
            db.commit()
            db.refresh(course)
            print(f"[SEED] ✅ Curso '{course.title}' actualizado con nuevo content_data (id={course.id}).")
        else:
            course = Course(
                title="Inducción Estudiantil - Normas ESPE",
                description="Curso fundamental sobre la normativa y estatutos de la universidad.",
                content_data=course_json
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

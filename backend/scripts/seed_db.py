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
                "section": "1. Fundamentos Constitucionales sobre Autonomía y Carrera",
                "text": "Que, el artículo 349 de la Constitución de la República del Ecuador, enuncia: “El Estado garantizará al personal docente, en todos los niveles y modalidades, estabilidad, actualización, formación continua y mejoramiento pedagógico y académico; una remuneración justa, de acuerdo a la profesionalización, desempeño y méritos académicos. La ley regulará la carrera docente y el escalafón; establecerá un sistema nacional de evaluación del desempeño y la política salarial en todos los niveles. Se establecerán políticas de promoción, movilidad y alternancia docente.”"
            },
            {
                "section": "2. Ejercicio de la Autonomía Responsable en la Educación Superior",
                "text": "Que, el artículo 18 reformado de la LOES define: “Ejercicio de la autonomía responsable.- La autonomía responsable que ejercen las instituciones de educación superior consiste en: a) La independencia para que los profesores e investigadores de las instituciones de educación superior ejerzan la libertad de cátedra e investigación; b) La libertad de expedir sus estatutos en el marco de las disposiciones de la presente Ley; c) La libertad en la elaboración de sus planes y programas de estudio... d) La libertad para nombrar a sus autoridades, profesores o profesoras, investigadores o investigadoras, las y los servidores, y las y los trabajadores, atendiendo a la alternancia, equidad de género e interculturalidad..."
            },
            {
                "section": "3. Requisitos para el Personal Académico Ocasional",
                "text": "Que, el artículo innumerado a) incorporado a continuación del Art. 25 del Reglamento de Carrera y Escalafón del Personal Académico de la Universidad de las Fuerzas Armadas – ESPE señala: “Requisitos para la vinculación del personal académico ocasional 1, a) Tener al menos un grado académico de maestría o su equivalente... b) Poseer al menos doce (12) meses de experiencia en educación superior o veinticuatro (24) meses de experiencia profesional... c) Acreditar un mínimo de noventa y seis (96) horas de capacitación en los últimos 4 años... y, d) Acreditar al menos una (1) obra de relevancia o un Art. indexado en bases de datos mundiales."
            },
            {
                "section": "4. Problemática Actual en el Departamento de Ciencias Médicas",
                "text": "Que, mediante Oficio Nro. ESPE-DCME-C-10-2025-0003-O de 17 de abril de 2025, suscrito por el Crnl. C.S.M. Williams Gonzalo Montaluisa Salazar, Mgtr., Director del Departamento de Ciencias Médicas, dirigido al Crnl. Edison Haro Albuja, Vicerrector de Docencia solicita se proceda a realizar el trámite correspondiente, para la equiparación de la publicación científica por la asistencia a dos cursos de actualización médica o la exposición en un congreso médico, vista la limitada oferta de profesionales de la salud con cuarto nivel que cumpla con todos los requisitos establecidos por la institución."
            },
            {
                "section": "5. Resolución de Equiparación y Disposición Transitoria",
                "text": "RESUELVE: Art. 1.- Aprobar en segundo y definitivo debate la reforma del Reglamento de Carrera y Escalafón... Incorpórese a continuación de la disposición transitoria innumerada a continuación de la Disposición Transitoria Décima Segunda, el siguiente texto: Disposición Transitoria Innumerada Segunda: Para el proceso de vinculación del personal académico en la tipología Ocasional 1 perteneciente al Departamento de Ciencias Médicas, debido a la naturaleza propia de su carrera, el requisito relacionado con la publicación de al menos una (1) obra de relevancia académica o un artículo indexado en bases de datos internacionales podrá ser sustituido, por la participación como expositor en al menos un (1) congreso, seminario, simposio u otros de carácter médico, nacional o internacional, realizado en los últimos cinco (5) años; o alternativamente, por la aprobación de un mínimo de tres (3) eventos científicos de la misma naturaleza en el mismo período, dentro de un congreso médico de mínimo 32 horas cada uno y avalado por una universidad debidamente reconocida por el ente rector correspondiente.",
                "question": {
                    "text": "PUNTO DE CONTROL: ¿Por qué se solicita la equiparación del requisito de publicación científica para el Departamento de Ciencias Médicas?",
                    "options": [
                        "Porque las publicaciones en bases indexadas ya no son necesarias para la docencia universitaria.",
                        "Debido a la limitada oferta de profesionales de la salud con cuarto nivel que cumplan con todos los requisitos institucionales.",
                        "Para permitir que personal sin grado de maestría pueda impartir clases en la Universidad de las Fuerzas Armadas."
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

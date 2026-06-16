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
    "chapter_title": "Hoja 1: Uso de Infraestructura y Servicios Tecnológicos",
    "sections": [
      {"text": "De acuerdo con el Reglamento Interno, la administración pública constituye un servicio a la colectividad que se rige por los principios de eficacia, eficiencia, calidad, jerarquía y transparencia. En este contexto, los recursos tecnológicos proporcionados por la institución son bienes públicos destinados a facilitar los fines académicos e institucionales."},
      {"text": "El uso de la infraestructura tecnológica está estrictamente reservado para actividades académicas, de investigación, vinculación con la sociedad y gestión administrativa. Queda terminantemente prohibido utilizar las redes, servidores o equipos de cómputo para fines comerciales, actividades de lucro personal, proselitismo político o cualquier acción que comprometa la seguridad de la información institucional."},
      {"text": "Las credenciales de acceso a los sistemas informáticos (usuarios, contraseñas, firmas electrónicas) son personales e intransferibles. Todo usuario es responsable civil, penal y administrativamente por cualquier acción ejecutada desde su cuenta. El préstamo de credenciales a terceros constituye una falta gravísima que será sancionada por el Honorable Consejo Universitario."}
    ],
    "quiz": {
      "question": "PUNTO DE CONTROL: ¿Para qué fines está estrictamente prohibido el uso de la infraestructura tecnológica?",
      "options": ["Gestión administrativa e investigación científica.", "Fines comerciales, lucro personal o proselitismo político.", "Desarrollo de proyectos de vinculación con la sociedad."],
      "correctIndex": 1
    }
  },
  {
    "chapter_title": "Hoja 2: Aplicación del Procedimiento Disciplinario",
    "sections": [
      {"text": "El Reglamento para la Aplicación del Procedimiento Disciplinario regula las acciones de los miembros de la comunidad universitaria. Ninguna servidora, servidor público, trabajador o estudiante estará exento de responsabilidades por los actos realizados en el ejercicio de sus funciones o durante su formación académica."},
      {"text": "Las faltas disciplinarias se clasifican rigurosamente en leves, graves y muy graves. Esta clasificación dependerá del nivel de afectación al patrimonio institucional, el daño a los derechos de terceros, y la vulneración de los principios éticos de la educación superior ecuatoriana. El debido proceso y la presunción de inocencia están garantizados durante todas las fases de investigación."},
      {"text": "Las sanciones aplicables, dependiendo de la gravedad de la falta, incluyen: amonestación verbal, amonestación escrita, suspensión temporal de actividades académicas o laborales sin derecho a remuneración, y en los casos extremos, la separación o destitución definitiva de la Universidad."}
    ],
    "quiz": {
      "question": "PUNTO DE CONTROL: ¿Cuáles son las posibles sanciones ante una infracción comprobada?",
      "options": ["Multas económicas proporcionales al salario o pensión mensual.", "Amonestación verbal, escrita, suspensión temporal o destitución definitiva.", "Pérdida inmediata de los créditos académicos del semestre en curso."],
      "correctIndex": 1
    }
  },
  {
    "chapter_title": "Hoja 3: Autonomía y Régimen del Estatuto",
    "sections": [
      {"text": "La Constitución de la República y la Ley Orgánica de Educación Superior (LOES) reconocen a las universidades y escuelas politécnicas su autonomía responsable. Esta autonomía abarca los ámbitos académico, administrativo, financiero y orgánico, permitiéndoles gobernarse a sí mismas en consonancia con los principios de alternancia, equidad de género y transparencia."},
      {"text": "El Honorable Consejo Universitario se erige como el órgano colegiado de cogobierno superior y autoridad máxima de la Universidad. Entre sus atribuciones primordiales está la aprobación, reforma y derogación de estatutos y reglamentos internos que rigen la vida institucional."},
      {"text": "A pesar de esta amplia autonomía para elaborar y ejecutar presupuestos, designar autoridades y establecer planes de estudio, la institución sigue estando sujeta a la fiscalización y auditoría de los organismos de control del Estado, garantizando así la responsabilidad social y la rendición de cuentas."}
    ],
    "quiz": {
      "question": "PUNTO DE CONTROL: ¿Qué dimensiones abarca la autonomía reconocida a la universidad?",
      "options": ["Exclusivamente académica y de investigación.", "Política, legislativa y de defensa nacional.", "Académica, administrativa, financiera y orgánica."],
      "correctIndex": 2
    }
  },
  {
    "chapter_title": "Hoja 4: Cooperación Interinstitucional",
    "sections": [
      {"text": "La Resolución ESPE-HCU-RES-2025-047 establece el marco normativo para gestionar la suscripción, ejecución, seguimiento y liquidación de instrumentos convencionales de cooperación interinstitucional. Estos acuerdos buscan potenciar el intercambio de conocimientos, recursos y tecnologías entre entidades nacionales e internacionales."},
      {"text": "Todo convenio marco o específico debe contar con un dictamen jurídico previo y una planificación financiera que asegure su viabilidad. Es obligación de los directores de departamento y gestores de proyecto presentar informes técnicos semestrales detallando el grado de cumplimiento de los objetivos pactados."}
    ],
    "quiz": {
      "question": "PUNTO DE CONTROL: ¿Qué requisito es indispensable antes de suscribir un convenio de cooperación?",
      "options": ["La firma directa del Jefe del Comando Conjunto.", "Un dictamen jurídico previo y planificación financiera viable.", "La aprobación del Ministerio de Relaciones Exteriores."],
      "correctIndex": 1
    }
  },
  {
    "chapter_title": "Hoja 5: Contratación para Investigación Científica",
    "sections": [
      {"text": "Para agilizar el desarrollo tecnológico, la Resolución ESPE-HCU-RES-2026-013 regula los Procedimientos de Régimen Especial para la adquisición de bienes, importaciones y contratación de servicios destinados exclusivamente a la Investigación Científica Responsable."},
      {"text": "Bajo este régimen, los investigadores principales de proyectos aprobados pueden solicitar la importación directa de equipos de laboratorio y reactivos que no se produzcan en el país, reduciendo los tiempos burocráticos del sistema de contratación pública ordinario. Sin embargo, todo bien adquirido debe ser inventariado como patrimonio de la Universidad una vez finalizado el proyecto."}
    ],
    "quiz": {
      "question": "PUNTO DE CONTROL: ¿Qué beneficio otorga el Régimen Especial de Contratación a los investigadores?",
      "options": ["Vender los equipos adquiridos tras publicar los resultados.", "Importar bienes directamente reduciendo tiempos burocráticos.", "Evitar el inventario y auditoría de los bienes adquiridos."],
      "correctIndex": 1
    }
  },
  {
    "chapter_title": "Hoja 6: Excepciones Transitorias del Personal Académico",
    "sections": [
      {"text": "Debido a la naturaleza específica de ciertas áreas del conocimiento y la escasez de oferta de posgrados, el Consejo Universitario puede emitir excepciones transitorias. Por ejemplo, para el personal académico Ocasional 1 del Departamento de Ciencias Médicas, el requisito de contar con un artículo indexado en bases mundiales fue temporalmente modificado."},
      {"text": "Dicha excepción permite sustituir la publicación científica por la participación como expositor en al menos un congreso médico en los últimos 5 años, o por la aprobación de 3 eventos científicos de mínimo 32 horas. Esta flexibilización busca garantizar la continuidad de la excelencia docente en la carrera de Medicina."}
    ],
    "quiz": {
      "question": "PUNTO DE CONTROL: ¿Por qué actividad se permite sustituir la publicación de un artículo en Ciencias Médicas?",
      "options": ["Participación como asistente en charlas virtuales de 10 horas.", "Dictar clases gratuitas en escuelas secundarias públicas.", "Participación como expositor en al menos un congreso médico."],
      "correctIndex": 2
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

import os
import sys
import sqlite3

# Añadir el backend al path para poder importar módulos
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.db.models import Course, Enrollment, User
from app.db.session import DATABASE_URL as SESSION_DB_URL

# Usar el URL original
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://neuro_user:neuro_password@localhost:5432/neuro_db")

def migrate():
    print("Iniciando migración experimental...")
    
    engine = create_engine(DATABASE_URL, echo=False)
    
    # 1. Modificar tabla mediante SQLAlchemy text
    try:
        with engine.begin() as conn:
            # En postgresql los booleanos son true/false
            conn.execute(text("ALTER TABLE courses ADD COLUMN is_adaptive BOOLEAN NOT NULL DEFAULT true;"))
        print("[OK] Columna is_adaptive añadida a 'courses'.")
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
            print("[WARN] La columna is_adaptive ya existe.")
        else:
            raise e

    # 2. Usar SQLAlchemy para duplicar curso y matricular
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Asumiendo que el curso original es el ID 1
        course_1 = db.query(Course).filter(Course.id == 1).first()
        if not course_1:
            print("[ERR] No se encontró el Curso 1.")
            return

        # Actualizar nombre y is_adaptive de Curso 1
        course_1.title = "Curso de Inducción (Control)"
        course_1.is_adaptive = False
        db.commit()
        print(f"[OK] Curso 1 renombrado a Control y is_adaptive=False")

        # Verificar si ya existe el curso 2
        course_2 = db.query(Course).filter(Course.title == "Curso de Inducción (Experimental)").first()
        if not course_2:
            # Crear curso 2 como copia exacta
            course_2 = Course(
                title="Curso de Inducción (Experimental)",
                description=course_1.description,
                content_data=course_1.content_data,
                is_adaptive=True
            )
            db.add(course_2)
            db.commit()
            db.refresh(course_2)
            print(f"[OK] Curso Experimental creado con ID {course_2.id}")
        else:
            print(f"[WARN] Curso Experimental ya existe con ID {course_2.id}")
            course_2.content_data = course_1.content_data # Sincronizar por si acaso
            db.commit()

        # Matricular a todos los usuarios en ambos cursos si no lo están
        users = db.query(User).all()
        for u in users:
            for c_id in [course_1.id, course_2.id]:
                enrollment = db.query(Enrollment).filter_by(user_id=u.id, course_id=c_id).first()
                if not enrollment:
                    new_env = Enrollment(user_id=u.id, course_id=c_id)
                    db.add(new_env)
                    print(f"  -> Usuario {u.email} matriculado en curso {c_id}")
        db.commit()
        print("[OK] Todos los usuarios matriculados en ambos cursos.")
        
    finally:
        db.close()

if __name__ == "__main__":
    migrate()

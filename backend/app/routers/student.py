"""Router para acciones de estudiantes.

Endpoints:
- ``GET /student/my-courses`` — Obtener cursos a los que el usuario está matriculado.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from app.db.models import Course, Enrollment, User
from app.db.session import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/student", tags=["student"])

@router.get("/my-courses")
async def get_my_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna la lista de cursos en los que está matriculado el usuario actual.
    """
    # Hacer JOIN de Enrollment con Course
    enrollments = (
        db.query(Enrollment, Course)
        .join(Course, Enrollment.course_id == Course.id)
        .filter(Enrollment.user_id == current_user.id)
        .all()
    )
    
    # Formatear la respuesta
    courses_data = []
    for enrollment, course in enrollments:
        # Calcular total de capítulos desde content_data
        total_chapters = 0
        if course.content_data:
            try:
                parsed = json.loads(course.content_data)
                if isinstance(parsed, list):
                    total_chapters = len(parsed)
            except (json.JSONDecodeError, TypeError):
                pass

        completed = len(json.loads(enrollment.completed_quizzes)) if enrollment.completed_quizzes else 0
        progress = (completed / total_chapters) * 100 if total_chapters > 0 else 0
        
        courses_data.append({
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
            "current_chapter_index": enrollment.current_chapter_index,
            "completed_quizzes": json.loads(enrollment.completed_quizzes) if enrollment.completed_quizzes else [],
            "time_spent_seconds": enrollment.time_spent_seconds,
            "total_chapters": total_chapters,
            "is_adaptive": course.is_adaptive,
            "progress": progress
        })
        
    # Calcular si algún curso Experimental debe ser bloqueado
    control_completed = True
    for c in courses_data:
        if not c["is_adaptive"] and c["progress"] < 100:
            control_completed = False
            break

    for c in courses_data:
        c["locked"] = False
        # Bloqueamos los adaptativos si el control no está 100%
        if c["is_adaptive"] and not control_completed:
            c["locked"] = True
            
    return courses_data

@router.get("/courses/{course_id}")
async def get_course_details(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene los detalles de un curso específico, incluyendo el contenido (content_data).
    Verifica que el usuario esté matriculado.
    """
    # Verificar matrícula
    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.course_id == course_id
    ).first()

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No estás matriculado en este curso o el curso no existe."
        )

    # Obtener el curso
    course = db.query(Course).filter(Course.id == course_id).first()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado."
        )

    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "content_data": course.content_data,
        "created_at": course.created_at.isoformat() if course.created_at else None,
        "current_chapter_index": enrollment.current_chapter_index,
        "completed_quizzes": json.loads(enrollment.completed_quizzes) if enrollment.completed_quizzes else [],
        "time_spent_seconds": enrollment.time_spent_seconds,
        "is_adaptive": course.is_adaptive,
    }

from pydantic import BaseModel
from app.services.llm_service import simplify_text, simplify_level_2_local

class SimplifyRequest(BaseModel):
    text: str
    level: int = 1
    course_id: int
    chapter_index: int

@router.post("/simplify")
async def simplify_course_content(
    request: SimplifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Toma un bloque de texto y utiliza el LLM (Gemini) para generar
    un resumen simplificado en viñetas amigables.
    """
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El texto a simplificar no puede estar vacío."
        )
    
    # Si es Nivel 2: usar procesamiento local (0 latencia)
    if request.level == 2:
        return {"summary": simplify_level_2_local(request.text)}
        
    # Si es Nivel 3: Aplicar Lazy Caching
    if request.level >= 3:
        # Paso A: Consulta a Base de Datos
        course = db.query(Course).filter(Course.id == request.course_id).first()
        if not course or not course.content_data:
            raise HTTPException(status_code=404, detail="Curso no encontrado.")
            
        try:
            content_data = json.loads(course.content_data)
            # Manejo de error si chapter_index está fuera de rango
            if request.chapter_index < 0 or request.chapter_index >= len(content_data):
                raise ValueError("chapter_index fuera de rango")
                
            chapter = content_data[request.chapter_index]
            
            # Paso B: Cache Hit
            if "summary" in chapter and chapter["summary"]:
                print(f"[CACHE] Hit: Devolviendo resumen almacenado para curso {request.course_id}, cap {request.chapter_index}")
                return {"summary": chapter["summary"]}
                
            # Paso C: Cache Miss - Fallback a Gemini
            print(f"[CACHE] Miss: Invocando API de Gemini para curso {request.course_id}, cap {request.chapter_index}")
            summary_html = await simplify_text(request.text, level=request.level)
            
            # Paso D: Persistencia (Guardar en caché para futuros usuarios)
            chapter["summary"] = summary_html
            course.content_data = json.dumps(content_data, ensure_ascii=False)
            
            db.commit()
            print("[CACHE] Actualizado: Resumen inyectado en Course.content_data")
            
            return {"summary": summary_html}
            
        except Exception as e:
            print(f"[CACHE] Error manejando caché: {e}")
            # Fallback de emergencia sin caché
            summary_html = await simplify_text(request.text, level=request.level)
            return {"summary": summary_html}

    return {"summary": request.text}


class UpdateProgressRequest(BaseModel):
    current_chapter_index: int | None = None
    completed_quizzes: list[int] | None = None
    time_spent_seconds: int | None = None

@router.patch("/courses/{course_id}/progress")
async def update_progress(
    course_id: int,
    body: UpdateProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualiza el progreso del usuario en un curso."""
    enrollment = db.query(Enrollment).filter(
        Enrollment.user_id == current_user.id,
        Enrollment.course_id == course_id
    ).first()

    if not enrollment:
        raise HTTPException(status_code=403, detail="No matriculado en este curso.")

    if body.current_chapter_index is not None:
        enrollment.current_chapter_index = body.current_chapter_index

    if body.completed_quizzes is not None:
        enrollment.completed_quizzes = json.dumps(body.completed_quizzes)

    if body.time_spent_seconds is not None and body.time_spent_seconds > 0:
        enrollment.time_spent_seconds += body.time_spent_seconds

    db.commit()
    db.refresh(enrollment)

    return {
        "current_chapter_index": enrollment.current_chapter_index,
        "completed_quizzes": json.loads(enrollment.completed_quizzes),
        "time_spent_seconds": enrollment.time_spent_seconds,
    }

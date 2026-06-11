"""Router para acciones de estudiantes.

Endpoints:
- ``GET /student/my-courses`` — Obtener cursos a los que el usuario está matriculado.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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
        courses_data.append({
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
        })
        
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
        "created_at": course.created_at.isoformat() if course.created_at else None
    }

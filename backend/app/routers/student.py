"""Router para acciones de estudiantes.

Endpoints:
- ``GET /student/my-courses`` — Obtener cursos a los que el usuario está matriculado.
"""

from fastapi import APIRouter, Depends
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

"""Router de administración: gestión de usuarios, cursos y matrículas.

Todas las rutas están protegidas por ``get_current_admin``.

Endpoints:
- ``GET  /admin/users``   — Listar usuarios.
- ``POST /admin/users``   — Crear estudiante.
- ``GET  /admin/courses`` — Listar cursos.
- ``POST /admin/courses`` — Crear curso.
- ``POST /admin/enroll``  — Matricular usuario en curso.
"""

from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from app.db.models import Course, Enrollment, User, UserRole
from app.db.session import get_db
from app.core.security import get_password_hash
from app.routers.auth import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Schemas de request ────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    full_name: str
    email: str          # EmailStr requires email-validator; plain str is fine
    password: str
    role: str = "student"


class CreateCourseRequest(BaseModel):
    title: str
    description: str = ""
    content_data: str = ""


class EnrollRequest(BaseModel):
    user_id: int
    course_id: int


# ── GET /admin/users ──────────────────────────────────────────────

@router.get("/users")
async def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Retorna la lista completa de usuarios registrados."""
    users = db.query(User).order_by(User.id).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "is_active": u.is_active,
            "student_id": u.student_id,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


# ── POST /admin/users ────────────────────────────────────────────

@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Crea un nuevo usuario (por defecto estudiante)."""
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El email '{body.email}' ya está registrado",
        )

    # Validar rol
    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Rol inválido: '{body.role}'. Usa 'admin' o 'student'.",
        )

    new_user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=get_password_hash(body.password),
        role=role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    print(f"[ADMIN] Usuario creado: {new_user.email} (role={new_user.role.value})")

    return {
        "id": new_user.id,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "role": new_user.role.value,
    }


# ── GET /admin/courses ───────────────────────────────────────────

@router.get("/courses")
async def list_courses(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Retorna la lista de cursos disponibles."""
    courses = db.query(Course).order_by(Course.id).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in courses
    ]


# ── POST /admin/courses ──────────────────────────────────────────

@router.post("/courses", status_code=status.HTTP_201_CREATED)
async def create_course(
    body: CreateCourseRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Crea un nuevo curso."""
    new_course = Course(
        title=body.title,
        description=body.description,
        content_data=body.content_data,
    )
    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    print(f"[ADMIN] Curso creado: '{new_course.title}' (id={new_course.id})")

    return {
        "id": new_course.id,
        "title": new_course.title,
        "description": new_course.description,
    }


# ── POST /admin/enroll ───────────────────────────────────────────

@router.post("/enroll", status_code=status.HTTP_201_CREATED)
async def enroll_user(
    body: EnrollRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Matricula un usuario en un curso."""
    # Verificar que el usuario existe
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario con id={body.user_id} no encontrado",
        )

    # Verificar que el curso existe
    course = db.query(Course).filter(Course.id == body.course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Curso con id={body.course_id} no encontrado",
        )

    # Verificar matrícula duplicada
    existing = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == body.user_id,
            Enrollment.course_id == body.course_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El usuario ya está matriculado en el curso '{course.title}'",
        )

    enrollment = Enrollment(
        user_id=body.user_id,
        course_id=body.course_id,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    print(f"[ADMIN] Matrícula: {user.email} → '{course.title}'")

    return {
        "id": enrollment.id,
        "user_id": enrollment.user_id,
        "user_email": user.email,
        "course_id": enrollment.course_id,
        "course_title": course.title,
        "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
    }


# ── GET /admin/enrollments ───────────────────────────────────────

@router.get("/enrollments")
async def list_enrollments(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Lista todas las matrículas con datos cruzados de progreso."""
    enrollments = (
        db.query(Enrollment, User, Course)
        .join(User, Enrollment.user_id == User.id)
        .join(Course, Enrollment.course_id == Course.id)
        .order_by(Enrollment.id)
        .all()
    )
    
    result = []
    for enrollment, user, course in enrollments:
        completed = json.loads(enrollment.completed_quizzes) if enrollment.completed_quizzes else []
        total_chapters = 0
        if course.content_data:
            try:
                parsed = json.loads(course.content_data)
                if isinstance(parsed, list):
                    total_chapters = len(parsed)
            except: pass
        
        progress = round((len(completed) / total_chapters) * 100) if total_chapters > 0 else 0
        
        result.append({
            "enrollment_id": enrollment.id,
            "user_id": user.id,
            "user_name": user.full_name,
            "user_email": user.email,
            "is_active": user.is_active,
            "course_id": course.id,
            "course_title": course.title,
            "current_chapter_index": enrollment.current_chapter_index,
            "total_chapters": total_chapters,
            "completed_quizzes": completed,
            "time_spent_seconds": enrollment.time_spent_seconds,
            "progress_percent": progress,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
        })
    
    return result


# ── GET /admin/pending-users ──────────────────────────────────────

@router.get("/pending-users")
async def list_pending_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Lista estudiantes con is_active=False (pendientes de aprobación)."""
    pending = (
        db.query(User)
        .filter(User.role == UserRole.student, User.is_active == False)
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "student_id": u.student_id,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in pending
    ]


# ── POST /admin/users/{user_id}/approve ──────────────────────────

@router.post("/users/{user_id}/approve")
async def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Aprueba un estudiante pendiente y lo matricula en el curso por defecto (ID 1)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if user.is_active:
        raise HTTPException(status_code=409, detail="El usuario ya está activo.")

    # Activar usuario
    user.is_active = True
    
    # Matrícula automática al curso por defecto (Course ID 1)
    course = db.query(Course).filter(Course.id == 1).first()
    if course:
        existing_enrollment = (
            db.query(Enrollment)
            .filter(Enrollment.user_id == user_id, Enrollment.course_id == 1)
            .first()
        )
        if not existing_enrollment:
            enrollment = Enrollment(user_id=user_id, course_id=1)
            db.add(enrollment)
    
    db.commit()

    print(f"[ADMIN] Usuario aprobado: {user.email} (id={user.id})")
    return {
        "message": f"Usuario '{user.full_name}' aprobado y matriculado exitosamente.",
        "user_id": user.id,
        "email": user.email,
    }

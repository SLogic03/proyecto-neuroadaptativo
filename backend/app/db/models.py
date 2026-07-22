"""Modelos ORM de SQLAlchemy para el sistema neuroadaptativo.

Tablas:
- ``users``       – Usuarios del sistema (admin / student).
- ``courses``     – Cursos disponibles en la plataforma.
- ``enrollments`` – Relación N:N entre usuarios y cursos.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


# ── Enum de roles ─────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    """Roles disponibles en la plataforma."""
    admin = "admin"
    student = "student"


# ── Modelo User ───────────────────────────────────────────────────

class User(Base):
    """Representa un usuario registrado en la plataforma.

    Atributos:
        id:              Clave primaria autoincremental.
        email:           Correo electrónico único (login).
        hashed_password: Contraseña hasheada con bcrypt.
        full_name:       Nombre completo del usuario.
        role:            'admin' o 'student'.
        is_active:       Indica si la cuenta está habilitada.
        created_at:      Fecha de creación (UTC).
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(
        Enum(UserRole, name="user_role_enum", create_constraint=True),
        nullable=False,
        default=UserRole.student,
    )
    student_id = Column(String(50), nullable=True, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relación → Enrollments
    enrollments = relationship(
        "Enrollment", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"


# ── Modelo Course ─────────────────────────────────────────────────

class Course(Base):
    """Representa un curso dentro de la plataforma neuroadaptativa.

    Atributos:
        id:           Clave primaria autoincremental.
        title:        Título del curso.
        description:  Descripción breve.
        content_data: Contenido del curso en formato libre (HTML, Markdown, JSON).
        created_at:   Fecha de creación (UTC).
    """
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    content_data = Column(Text, nullable=True)
    is_adaptive = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relación → Enrollments
    enrollments = relationship(
        "Enrollment", back_populates="course", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Course(id={self.id}, title='{self.title}')>"


# ── Modelo Enrollment (tabla intermedia N:N) ──────────────────────

class Enrollment(Base):
    """Relación muchos-a-muchos entre usuarios y cursos.

    Atributos:
        id:          Clave primaria autoincremental.
        user_id:     FK al usuario inscrito.
        course_id:   FK al curso.
        enrolled_at: Fecha de inscripción (UTC).
    """
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id = Column(
        Integer,
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
    )
    enrolled_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    current_chapter_index = Column(Integer, nullable=False, default=0)
    completed_quizzes = Column(Text, nullable=False, default="[]")
    time_spent_seconds = Column(Integer, nullable=False, default=0)

    # Restricción única: un usuario no puede inscribirse dos veces al mismo curso
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_user_course"),
    )

    # Relaciones bidireccionales
    user = relationship("User", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    def __repr__(self) -> str:
        return (
            f"<Enrollment(id={self.id}, user_id={self.user_id}, "
            f"course_id={self.course_id})>"
        )

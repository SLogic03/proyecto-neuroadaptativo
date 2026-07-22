"""Router de autenticación: login JWT y dependencias de autorización.

Endpoints:
- ``POST /login`` — Devuelve un ``access_token`` JWT.

Dependencias reutilizables:
- ``get_current_user``  — Extrae y valida el usuario del token.
- ``get_current_admin`` — Igual, pero requiere rol ``admin``.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    decode_access_token,
    verify_password,
    get_password_hash,
)
from app.db.models import User, UserRole
from app.db.session import get_db

router = APIRouter(tags=["auth"])

# ── Esquema OAuth2 (apunta al endpoint de login) ─────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# ── POST /login ───────────────────────────────────────────────────

@router.post("/login")
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Autentica al usuario y devuelve un JWT.

    Recibe ``username`` (email) y ``password`` vía form-data
    (estándar OAuth2PasswordRequestForm).
    """
    user = db.query(User).filter(User.email == form.username).first()

    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está pendiente de aprobación por el administrador.",
        )

    token = create_access_token(data={
        "sub": user.email,
        "role": user.role.value,
        "name": user.full_name,
    })

    print(f"[AUTH] Login exitoso: {user.email} (role={user.role.value})")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
        },
    }


# ── Dependencias de autorización ──────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extrae el usuario autenticado desde el JWT en el header Authorization.

    Raises:
        HTTPException 401: Si el token es inválido o el usuario no existe.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada",
        )

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Igual que ``get_current_user`` pero exige rol ``admin``.

    Raises:
        HTTPException 403: Si el usuario no es administrador.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador",
        )
    return current_user

from pydantic import BaseModel

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    student_id: str

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Registro público de un nuevo estudiante.
    
    La cuenta se crea con is_active=False y queda pendiente
    de aprobación por un administrador.
    """
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo electrónico ya está registrado.",
        )
    
    if db.query(User).filter(User.student_id == body.student_id).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El ID de estudiante ya está registrado.",
        )
    
    new_user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=get_password_hash(body.password),
        role=UserRole.student,
        is_active=False,
        student_id=body.student_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    print(f"[AUTH] Registro pendiente: {new_user.email} (student_id={new_user.student_id})")

    return {"message": "Registro exitoso. Tu cuenta será revisada por un administrador."}

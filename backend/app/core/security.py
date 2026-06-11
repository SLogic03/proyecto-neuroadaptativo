"""Utilidades de seguridad: hashing de contraseñas y generación de JWT.

Variables de entorno opcionales:
- ``SECRET_KEY``: Clave secreta para firmar tokens (se genera una por defecto).
- ``ACCESS_TOKEN_EXPIRE_MINUTES``: Duración del token en minutos (default: 60).

Nota técnica:
  passlib 1.7.4 es incompatible con bcrypt >= 4.1 (AttributeError en
  ``bcrypt.__about__``).  Por eso usamos ``bcrypt`` directamente para
  el hashing, manteniendo la interfaz limpia.
"""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

# ── Configuración ─────────────────────────────────────────────────

SECRET_KEY: str = os.getenv(
    "SECRET_KEY",
    # Valor por defecto SOLO para desarrollo local.
    # En producción DEBE configurarse vía variable de entorno.
    "dev-secret-key-CHANGE-ME-IN-PRODUCTION-neuroadaptativo-2025",
)

ALGORITHM: str = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)

# ── Hashing de contraseñas (bcrypt directo) ───────────────────────


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica que una contraseña en texto plano coincida con su hash bcrypt.

    Args:
        plain_password:  Contraseña ingresada por el usuario.
        hashed_password: Hash almacenado en la base de datos.

    Returns:
        True si coincide, False en caso contrario.
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    """Genera el hash bcrypt de una contraseña en texto plano.

    Args:
        password: Contraseña a hashear.

    Returns:
        Cadena con el hash bcrypt listo para almacenar.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


# ── Tokens JWT ────────────────────────────────────────────────────

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """Crea un JSON Web Token (JWT) firmado con HS256.

    Args:
        data:          Diccionario con los claims (ej. ``{"sub": email}``).
        expires_delta: Duración personalizada del token.
                       Si es None, se usa ``ACCESS_TOKEN_EXPIRE_MINUTES``.

    Returns:
        Token JWT codificado como string.
    """
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """Decodifica y valida un JWT.

    Args:
        token: Token JWT a decodificar.

    Returns:
        Diccionario con los claims del token.

    Raises:
        jose.JWTError: Si el token es inválido o ha expirado.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

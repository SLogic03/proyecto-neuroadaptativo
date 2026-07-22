# Proyecto Neuroadaptativo 🧠⚡

Plataforma de investigación neuroadaptativa. Este repositorio incluye un frontend web interactivo, un backend basado en FastAPI y una base de datos PostgreSQL orquestada con Docker.

## Arquitectura

- **Frontend:** HTML/CSS/JS (Vanilla), alojado de forma estática o mediante Nginx.
- **Backend:** FastAPI (Python), gestiona la telemetría, evaluación neuroadaptativa (LLM) y progresión de los cursos.
- **Base de Datos:** PostgreSQL en contenedor Docker.
- **Proxy:** Nginx (opcional, en contenedor) para redirección de peticiones.

---

## 🚀 Guía de Instalación y Ejecución

Sigue estos pasos cuidadosamente para levantar todo el entorno desde cero en tu máquina (Windows).

### 1. Iniciar la Base de Datos (Docker)

La base de datos (PostgreSQL) y el servidor Nginx están orquestados mediante Docker Compose.
Asegúrate de tener Docker Desktop iniciado.

1. Abre una terminal en la raíz del proyecto.
2. Ejecuta el siguiente comando para levantar los contenedores en segundo plano:
   ```bash
   docker-compose up -d
   ```
3. Esto iniciará el contenedor `neuro_postgres` (puerto 5432) y `neuro_nginx` (puertos 80/443).
   - *La inicialización automática creará las tablas base y un usuario administrador por defecto (vía `backend/db/init.sql`).*

### 2. Configurar y Activar el Backend (Python)

El backend requiere un entorno virtual de Python.

1. Abre una nueva terminal en la raíz del proyecto y navega a la carpeta del backend:
   ```bash
   cd backend
   ```
2. Activa el entorno virtual:
   ```powershell
   # En Windows PowerShell:
   .\venv\Scripts\Activate.ps1
   # (Si usas CMD: .\venv\Scripts\activate.bat)
   ```
   *(Si el entorno no existe, puedes crearlo con `python -m venv venv` e instalar las dependencias con `pip install -r requirements.txt`)*

3. Configura el archivo `.env` en la **raíz del proyecto** (`/proyecto-neuroadaptativo/.env`) con tu clave de Gemini:
   ```env
   GEMINI_API_KEY="AIzaSyTuClaveAca..."
   ```

4. Ejecuta el servidor FastAPI:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
   ```
   *El backend quedará escuchando en `http://localhost:8080`.*

### 3. Acceder al Sistema

- El servidor de FastAPI, por defecto, está montando los archivos estáticos del frontend directamente desde la carpeta `frontend/`.
- Abre tu navegador y visita: **[http://localhost:8080](http://localhost:8080)** (o http://localhost si estás ruteándolo todo a través del Nginx del docker).
- **Credenciales por defecto:**
  - Estudiante: `jperez@espe.edu.ec` / `estudiante123`
  - Administrador: `admin@espe.edu.ec` / `admin123`

---

## 🛠️ Scripts Útiles (Migraciones y Experimentos)

Para correr scripts especiales (como generar cursos duplicados para A/B testing), siempre usa el entorno virtual activado desde la carpeta `backend`:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python scripts\migrate_experiments.py
```

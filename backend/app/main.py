import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.routers import ws, auth, admin, student

app = FastAPI(title="API Neuroadaptativa")

# ── CORS (permite que el frontend se comunique con el backend) ────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers (API) ────────────────────────────────────────────────
app.include_router(ws.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(student.router)


# ── Redirección raíz → login ─────────────────────────────────────
@app.get("/")
async def root():
    return RedirectResponse(url="/login.html")


# ── Servir frontend estático ─────────────────────────────────────
# main.py está en backend/app/ → frontend está en ../../frontend
frontend_path = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
)
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
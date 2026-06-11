from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ws, auth, admin, student

app = FastAPI(title="API Neuroadaptativa")

# ── CORS (permite que el frontend se comunique con el backend) ────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "*",                       # Fallback desarrollo — restringir en producción
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────
app.include_router(ws.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(student.router)


@app.get("/")
async def root():
    return {"message": "El backend neuroadaptativo está corriendo"}
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ws, auth, admin

app = FastAPI(title="API Neuroadaptativa")

# ── CORS (permite que el frontend se comunique con el backend) ────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # En producción, restringir a los dominios reales
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────
app.include_router(ws.router)
app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {"message": "El backend neuroadaptativo está corriendo"}
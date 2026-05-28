from fastapi import FastAPI
from app.routers import ws

app = FastAPI(title="API Neuroadaptativa")

app.include_router(ws.router)

@app.get("/")
async def root():
    return {"message": "El backend neuroadaptativo está corriendo"}
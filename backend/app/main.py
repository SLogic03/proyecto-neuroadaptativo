from fastapi import FastAPI

app = FastAPI(title="API Neuroadaptativa")

@app.get("/")
async def root():
    return {"message": "El backend neuroadaptativo está corriendo"}
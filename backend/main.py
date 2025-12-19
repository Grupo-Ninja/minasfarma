from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models, database, auth
from routers import sangrias, pix, closings

# Create Tables (for local dev simple setup)
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Minas Farma Canaã API")

# CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(sangrias.router)
app.include_router(pix.router)
app.include_router(closings.router)

@app.get("/")
def read_root():
    return {"message": "API Minas Farma Canaã Online 🚀"}

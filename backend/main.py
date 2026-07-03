from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models, database, auth
from routers import sangrias, pix, closings, users, pdf_upload, dashboard, schedules

# Create Tables (for local dev simple setup)
# Resiliente: se faltar privilégio para criar alguma tabela (ex.: REFERENCES),
# o app ainda sobe e as funções de leitura seguem funcionando.
try:
    models.Base.metadata.create_all(bind=database.engine)
except Exception as e:
    print(f"[startup] Aviso: não foi possível criar/verificar todas as tabelas: {e}")

app = FastAPI(title="Minas Farma Canaã API")

# CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://minasfarma.plataformaninja.com",
    "http://minasfarma.plataformaninja.com"
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
app.include_router(users.router)
app.include_router(sangrias.router)
app.include_router(pix.router)
app.include_router(closings.router)
app.include_router(pdf_upload.router)
app.include_router(dashboard.router)
app.include_router(schedules.router)

@app.get("/")
def read_root():
    return {"message": "API Minas Farma Canaã Online 🚀"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models, crud, schemas

# Cria tabelas
models.Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    try:
        # Verifica se já existe admin
        admin = crud.get_user_by_login(db, "admin")
        if not admin:
            print("Criando usuário admin...")
            user_in = schemas.UserCreate(
                login="admin",
                senha="admin", # Deve ser alterado em produção
                nome="Administrador",
                cargo="admin"
            )
            crud.create_user(db, user_in)
            print("Usuário 'admin' criado com senha 'admin'.")
        else:
            print("Usuário 'admin' já existe.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()

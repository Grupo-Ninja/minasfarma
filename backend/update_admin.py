"""Script para atualizar o cargo do usuário admin para 'admin'"""
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

def update_admin_cargo():
    db = SessionLocal()
    try:
        # Busca o usuário admin
        admin = db.query(models.User).filter(models.User.login == "admin").first()
        if admin:
            if admin.cargo == "operador":
                admin.cargo = "admin"
                db.commit()
                print(f"Cargo do usuário 'admin' atualizado de 'operador' para 'admin'.")
            else:
                print(f"Usuário 'admin' já está com cargo '{admin.cargo}'.")
        else:
            print("Usuário 'admin' não encontrado.")
    finally:
        db.close()

if __name__ == "__main__":
    update_admin_cargo()

from sqlalchemy.orm import Session
import models, schemas
from auth import get_password_hash
from datetime import datetime

# --- USER CRUD ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_login(db: Session, login: str):
    return db.query(models.User).filter(models.User.login == login).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.senha)
    db_user = models.User(
        login=user.login, 
        nome=user.nome, 
        senha=hashed_password, 
        cargo=user.cargo
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- SANGRIA CRUD ---
def create_sangria(db: Session, sangria: schemas.SangriaCreate, user_id: int):
    db_sangria = models.Sangria(
        valor=sangria.valor,
        motivo=sangria.motivo,
        operador_id=user_id
    )
    db.add(db_sangria)
    db.commit()
    db.refresh(db_sangria)
    return db_sangria

def get_sangrias(db: Session, skip: int = 0, limit: int = 100):
    # TODO: Filtrar por operador se não for admin (implementar na rota)
    return db.query(models.Sangria).order_by(models.Sangria.created_at.desc()).offset(skip).limit(limit).all()

# --- PIX CRUD ---
def create_pix(db: Session, pix: schemas.PixCreate):
    db_pix = models.PixEntry(
        valor=pix.valor,
        observacao=pix.observacao,
        data_transacao=pix.data_transacao
    )
    db.add(db_pix)
    db.commit()
    db.refresh(db_pix)
    return db_pix

def get_pix_entries(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.PixEntry).order_by(models.PixEntry.data_transacao.desc()).offset(skip).limit(limit).all()

def update_pix_status(db: Session, pix_id: int, status: str):
    db_pix = db.query(models.PixEntry).filter(models.PixEntry.id == pix_id).first()
    if db_pix:
        db_pix.status = status
        db.commit()
        db.refresh(db_pix)
    return db_pix

# --- CLOSING CRUD ---
def create_closing(db: Session, closing: schemas.ClosingCreate, user_id: int):
    # 1. Create Closing Header
    db_closing = models.Closing(
        operador_id=user_id,
        data_referencia=closing.data_referencia,
        total_entradas=closing.total_entradas,
        total_saidas=closing.total_saidas,
        total_quebra=closing.total_quebra
    )
    db.add(db_closing)
    db.commit()
    db.refresh(db_closing)

    # 2. Add Movements
    for mov in closing.movimentos:
        db_mov = models.ClosingMovement(
            closing_id=db_closing.id,
            tipo=mov.tipo,
            valor=mov.valor,
            historico=mov.historico,
            moeda=mov.moeda
        )
        db.add(db_mov)
    
    # 3. Add Conferences
    for conf in closing.conferencias:
        db_conf = models.ClosingConference(
            closing_id=db_closing.id,
            forma_pagamento=conf.forma_pagamento,
            valor_informado=conf.valor_informado,
            valor_calculado=conf.valor_calculado,
            valor_oficial=conf.valor_oficial,
            diferenca=conf.diferenca,
            justificativa=conf.justificativa
        )
        db.add(db_conf)
    
    db.commit()
    db.refresh(db_closing)
    return db_closing

def get_closings(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Closing).order_by(models.Closing.created_at.desc()).offset(skip).limit(limit).all()

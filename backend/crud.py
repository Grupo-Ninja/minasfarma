from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models, schemas
from datetime import datetime

# Password hashing (definido aqui para evitar circular import com auth.py)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# --- USER CRUD ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_login(db: Session, login: str):
    return db.query(models.User).filter(models.User.login == login).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    # Filtra apenas usuários ativos (soft delete)
    return db.query(models.User).filter(models.User.active == True).offset(skip).limit(limit).all()

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

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    """Atualiza os dados de um usuário"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None
    
    update_data = user_update.model_dump(exclude_unset=True)
    
    # Se senha foi fornecida, aplica o hash
    if 'senha' in update_data and update_data['senha']:
        update_data['senha'] = get_password_hash(update_data['senha'])
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_password(db: Session, user_id: int, nova_senha: str):
    """Atualiza apenas a senha do usuário"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None
    
    db_user.senha = get_password_hash(nova_senha)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    """Deleta um usuário (ou desativa, dependendo da regra de negócio)"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None
    
    # Soft delete - apenas desativa o usuário
    db_user.active = False
    db.commit()
    db.refresh(db_user)
    return db_user

def hard_delete_user(db: Session, user_id: int):
    """Remove permanentemente um usuário do banco"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None
    
    db.delete(db_user)
    db.commit()
    return True

# --- SANGRIA CRUD ---
def create_sangria(db: Session, sangria: schemas.SangriaCreate, user_id: int):
    # Definir status e origem
    origem = sangria.origem if sangria.origem else models.SangriaOrigem.MANUAL
    
    db_sangria = models.Sangria(
        valor=sangria.valor,
        motivo=sangria.motivo,
        operador_id=user_id,
        origem=origem,
        status=models.SangriaStatus.PENDENTE
    )
    db.add(db_sangria)
    db.commit()
    db.refresh(db_sangria)
    return db_sangria

def get_sangrias(db: Session, skip: int = 0, limit: int = 100):
    # TODO: Filtrar por operador se não for admin (implementar na rota)
    return db.query(models.Sangria).order_by(models.Sangria.created_at.desc()).offset(skip).limit(limit).all()

def update_sangria_status(db: Session, sangria_id: int, status: str):
    db_sangria = db.query(models.Sangria).filter(models.Sangria.id == sangria_id).first()
    if db_sangria:
        db_sangria.status = status
        db.commit()
        db.refresh(db_sangria)
    return db_sangria

def delete_sangria(db: Session, sangria_id: int):
    """Remove uma sangria se não for de Fechamento"""
    db_sangria = db.query(models.Sangria).filter(models.Sangria.id == sangria_id).first()
    
    if not db_sangria:
        return None
        
    if db_sangria.origem == models.SangriaOrigem.FECHAMENTO:
        return False # Não pode excluir sangria gerada automaticamente
        
    db.delete(db_sangria)
    db.commit()
    return True

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

def delete_pix(db: Session, pix_id: int):
    """Remove uma entrada PIX do banco"""
    db_pix = db.query(models.PixEntry).filter(models.PixEntry.id == pix_id).first()
    if not db_pix:
        return None
    db.delete(db_pix)
    db.commit()
    return True

# --- CLOSING CRUD ---
def delete_closing(db: Session, closing_id: int):
    """Remove um fechamento e seus relacionamentos (cascade)"""
    db_closing = db.query(models.Closing).filter(models.Closing.id == closing_id).first()
    if not db_closing:
        return None
        
    db.delete(db_closing)
    db.commit()
    return True

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

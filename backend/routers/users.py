from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import crud, models, schemas, database
from auth import get_current_user, verify_password

router = APIRouter(prefix="/api/users", tags=["users"])


def require_admin(current_user: models.User = Depends(get_current_user)):
    """Dependency que verifica se o usuário é admin"""
    if current_user.cargo != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Apenas administradores podem realizar esta ação."
        )
    return current_user


@router.get("/", response_model=List[schemas.UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """Lista todos os usuários (apenas admin)"""
    users = crud.get_users(db, skip=skip, limit=limit)
    return users


@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """Obtém um usuário pelo ID (apenas admin)"""
    user = crud.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


@router.post("/", response_model=schemas.UserResponse)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """Cria um novo usuário (apenas admin)"""
    db_user = crud.get_user_by_login(db, login=user.login)
    if db_user:
        raise HTTPException(status_code=400, detail="Login já está em uso")
    return crud.create_user(db=db, user=user)


@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """Atualiza um usuário (apenas admin)"""
    # Verifica se o login já existe (se estiver sendo alterado)
    if user_update.login:
        existing = crud.get_user_by_login(db, login=user_update.login)
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Login já está em uso")
    
    user = crud.update_user(db, user_id=user_id, user_update=user_update)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


@router.delete("/{user_id}", response_model=schemas.UserResponse)
def delete_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """Desativa um usuário (soft delete) - apenas admin"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode desativar seu próprio usuário")
    
    user = crud.delete_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


@router.put("/{user_id}/password")
def update_password(
    user_id: int,
    password_data: schemas.UserPasswordUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Altera a senha do usuário (próprio usuário ou admin)"""
    # Apenas o próprio usuário ou admin pode alterar a senha
    if current_user.id != user_id and current_user.cargo != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode alterar sua própria senha"
        )
    
    # Busca o usuário
    user = crud.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Se não for admin, verifica senha atual
    if current_user.cargo != "admin":
        if not verify_password(password_data.senha_atual, user.senha):
            raise HTTPException(status_code=400, detail="Senha atual incorreta")
    
    # Atualiza a senha
    crud.update_user_password(db, user_id=user_id, nova_senha=password_data.nova_senha)
    return {"message": "Senha alterada com sucesso"}


@router.post("/{user_id}/reactivate", response_model=schemas.UserResponse)
def reactivate_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """Reativa um usuário desativado (apenas admin)"""
    user = crud.get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user.active:
        raise HTTPException(status_code=400, detail="Usuário já está ativo")
    
    user_update = schemas.UserUpdate(active=True)
    return crud.update_user(db, user_id=user_id, user_update=user_update)

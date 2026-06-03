from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import crud, models, schemas, database, auth

router = APIRouter(
    prefix="/api/sangrias",
    tags=["sangrias"],
    dependencies=[Depends(auth.get_current_user)]
)

@router.post("/", response_model=schemas.SangriaResponse)
def create_sangria_route(
    sangria: schemas.SangriaCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.create_sangria(db=db, sangria=sangria, user_id=current_user.id)

@router.get("/", response_model=List[schemas.SangriaResponse])
def read_sangrias(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Lista sangrias - Admin vê todas, Operador vê apenas as suas"""
    query = db.query(models.Sangria)
    
    # Filtrar por usuário se não for admin
    if current_user.cargo != "admin":
        query = query.filter(models.Sangria.operador_id == current_user.id)
    
    sangrias = query.order_by(models.Sangria.created_at.desc()).offset(skip).limit(limit).all()
    
    # Enrich with operator name
    for s in sangrias:
        if s.operador_rel:
            s.operador_nome = s.operador_rel.nome
    return sangrias

@router.get("/{sangria_id}", response_model=schemas.SangriaResponse)
def get_sangria(
    sangria_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Obtem uma sangria pelo ID"""
    sangria = db.query(models.Sangria).filter(models.Sangria.id == sangria_id).first()
    if not sangria:
        raise HTTPException(status_code=404, detail="Sangria not found")
    
    # Verificar permissão
    if current_user.cargo != "admin" and sangria.operador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    if sangria.operador_rel:
        sangria.operador_nome = sangria.operador_rel.nome
        
    return sangria

@router.put("/{sangria_id}/status", response_model=schemas.SangriaResponse)
def update_sangria_status_route(
    sangria_id: int, 
    status_update: schemas.SangriaUpdateStatus, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Atualizar status da Sangria (conciliar/desconciliar)"""
    # Operador pode conciliar? Geralmente sim, ou admin. Vamos deixar aberto por enquanto
    # Se precisar restringir, adicionar lógica aqui.
    
    updated = crud.update_sangria_status(db, sangria_id=sangria_id, status=status_update.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Sangria not found")
    return updated

@router.delete("/{sangria_id}")
def delete_sangria_route(
    sangria_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Remove uma sangria"""
    # Verificar permissões (apenas dono ou admin?)
    # Por enquanto, assumimos que backend verifica se é possível excluir baseada na origem
    
    # Se operador, verificar se a sangria é dele?
    if current_user.cargo != "admin":
        # Check ownership logic if needed, but crud.delete_sangria handles origin check
        pass

    result = crud.delete_sangria(db, sangria_id=sangria_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Sangria not found")
    if result is False:
        raise HTTPException(status_code=403, detail="Não é possível excluir sangria gerada automaticamente pelo fechamento")
        
    return {"success": True, "message": "Sangria deleted"}

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, Date, func
from typing import List, Optional
from datetime import datetime
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

@router.get("/", response_model=schemas.Page[schemas.SangriaResponse])
def read_sangrias(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    date: Optional[str] = None,   # YYYY-MM-DD (filtra por created_at)
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Lista sangrias paginadas - Admin vê todas, Operador vê apenas as suas.
    Filtros (search por operador/motivo, date) e soma são aplicados no servidor."""
    query = db.query(models.Sangria)

    # Filtrar por usuário se não for admin
    if current_user.cargo != "admin":
        query = query.filter(models.Sangria.operador_id == current_user.id)

    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.outerjoin(models.User, models.Sangria.operador_id == models.User.id).filter(
            or_(models.User.nome.ilike(like), models.Sangria.motivo.ilike(like))
        )

    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(cast(models.Sangria.created_at, Date) == d)
        except ValueError:
            pass

    # count + soma numa única ida ao banco (reduz latência com DB remoto)
    total, sum_valor = query.with_entities(
        func.count(models.Sangria.id),
        func.coalesce(func.sum(models.Sangria.valor), 0.0),
    ).one()

    sangrias = (query.order_by(models.Sangria.created_at.desc())
                .offset((page - 1) * page_size).limit(page_size).all())

    for s in sangrias:
        if s.operador_rel:
            s.operador_nome = s.operador_rel.nome

    pages = (total + page_size - 1) // page_size
    return schemas.Page(
        items=sangrias, total=total, page=page, page_size=page_size, pages=pages,
        summary={"sum_valor": round(float(sum_valor), 2), "count": total},
    )

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

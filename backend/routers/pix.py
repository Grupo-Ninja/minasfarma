from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import cast, Date, func
from typing import List, Optional
from datetime import datetime
import crud, models, schemas, database, auth

router = APIRouter(
    prefix="/api/pix",
    tags=["pix"],
    dependencies=[Depends(auth.get_current_user)]
)

@router.post("/", response_model=schemas.PixResponse)
def create_pix_route(pix: schemas.PixCreate, db: Session = Depends(database.get_db)):
    return crud.create_pix(db=db, pix=pix)

@router.get("/", response_model=schemas.Page[schemas.PixResponse])
def read_pix_entries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    date: Optional[str] = None,     # YYYY-MM-DD (filtra por data_transacao)
    status: Optional[str] = None,
    db: Session = Depends(database.get_db),
):
    """Lista PIX paginados, com filtro (observação, data, status) e soma no servidor."""
    query = db.query(models.PixEntry)

    if search and search.strip():
        query = query.filter(models.PixEntry.observacao.ilike(f"%{search.strip()}%"))
    if status:
        query = query.filter(models.PixEntry.status == status)
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").date()
            query = query.filter(cast(models.PixEntry.data_transacao, Date) == d)
        except ValueError:
            pass

    total, sum_valor = query.with_entities(
        func.count(models.PixEntry.id),
        func.coalesce(func.sum(models.PixEntry.valor), 0.0),
    ).one()

    rows = (query.order_by(models.PixEntry.data_transacao.desc())
            .offset((page - 1) * page_size).limit(page_size).all())

    pages = (total + page_size - 1) // page_size
    return schemas.Page(
        items=rows, total=total, page=page, page_size=page_size, pages=pages,
        summary={"sum_valor": round(float(sum_valor), 2), "count": total},
    )

@router.put("/{pix_id}/status", response_model=schemas.PixResponse)
def update_pix_status_route(
    pix_id: int, 
    status_update: schemas.PixUpdateStatus, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Atualizar status do PIX (conciliar/rejeitar) - APENAS ADMIN"""
    if current_user.cargo != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem conciliar PIX")
    
    updated = crud.update_pix_status(db, pix_id=pix_id, status=status_update.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Pix entry not found")
    return updated

@router.delete("/{pix_id}")
def delete_pix_route(
    pix_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Remove uma entrada PIX - APENAS ADMIN"""
    if current_user.cargo != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem excluir PIX")
    
    deleted = crud.delete_pix(db, pix_id=pix_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Pix entry not found")
    return {"success": True, "message": "Pix entry deleted"}

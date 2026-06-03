from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import crud, models, schemas, database, auth

router = APIRouter(
    prefix="/api/pix",
    tags=["pix"],
    dependencies=[Depends(auth.get_current_user)]
)

@router.post("/", response_model=schemas.PixResponse)
def create_pix_route(pix: schemas.PixCreate, db: Session = Depends(database.get_db)):
    return crud.create_pix(db=db, pix=pix)

@router.get("/", response_model=List[schemas.PixResponse])
def read_pix_entries(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return crud.get_pix_entries(db, skip=skip, limit=limit)

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

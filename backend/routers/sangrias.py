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
    sangrias = crud.get_sangrias(db, skip=skip, limit=limit)
    # Enrich with operator name manually for now or use ORM in response model
    # The response_model handles the relationship if configured, but let's check schemas
    # Schema has 'operador_nome' as optional. We might need to populate it if lazy loading.
    for s in sangrias:
        if s.operador_rel:
            s.operador_nome = s.operador_rel.nome
    return sangrias

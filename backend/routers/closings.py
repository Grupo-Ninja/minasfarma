from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import crud, models, schemas, database, auth

router = APIRouter(
    prefix="/api/closings",
    tags=["closings"],
    dependencies=[Depends(auth.get_current_user)]
)

@router.post("/", response_model=schemas.ClosingResponse)
def create_closing_route(
    closing: schemas.ClosingCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.create_closing(db=db, closing=closing, user_id=current_user.id)

@router.get("/", response_model=List[schemas.ClosingResponse])
def read_closings(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return crud.get_closings(db, skip=skip, limit=limit)

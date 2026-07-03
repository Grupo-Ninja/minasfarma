from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import cast, Date, func
from typing import List, Optional
from pydantic import BaseModel
import crud, models, schemas, database, auth
from datetime import datetime

router = APIRouter(
    prefix="/api/closings",
    tags=["closings"],
    dependencies=[Depends(auth.get_current_user)]
)


# --- Schemas específicos deste router ---
class ClosingFromPDFs(BaseModel):
    """Schema para criar fechamento a partir dos dados extraídos dos PDFs"""
    data_referencia: str  # Data no formato "24/11/2025" ou ISO
    operador_nome: str
    caixa: str
    movimentos: List[dict]
    conferencia: List[dict]
    total_quebra: float


class ApproveClosing(BaseModel):
    """Schema para aprovar fechamento com possíveis edições do admin"""
    conferencias: Optional[List[dict]] = None  # Admin pode ajustar valores oficiais
    observacao_gerente: Optional[str] = None


class RejectClosing(BaseModel):
    """Schema para rejeitar fechamento"""
    motivo: str


# --- Helper para verificar se é admin ---
def require_admin(current_user: models.User = Depends(auth.get_current_user)):
    if current_user.cargo != "admin":
        raise HTTPException(
            status_code=403,
            detail="Apenas administradores podem realizar esta ação"
        )
    return current_user


# --- Rotas ---
@router.post("/", response_model=schemas.ClosingResponse)
def create_closing_route(
    closing: schemas.ClosingCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Cria um novo fechamento de caixa"""
    return crud.create_closing(db=db, closing=closing, user_id=current_user.id)


@router.get("/", response_model=schemas.Page[schemas.ClosingListItem])
def read_closings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,       # busca por nome do operador
    start_date: Optional[str] = None,   # YYYY-MM-DD (data_referencia)
    end_date: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Lista fechamentos paginados (versão LEVE, sem movimentos/conferencias).
    Admin vê todos, Operador só os seus. Eager-load do operador evita N+1."""
    query = db.query(models.Closing).options(joinedload(models.Closing.operador_rel))

    if current_user.cargo != "admin":
        query = query.filter(models.Closing.operador_id == current_user.id)
    if status:
        query = query.filter(models.Closing.status == status)
    if search and search.strip():
        like = f"%{search.strip()}%"
        query = query.outerjoin(models.User, models.Closing.operador_id == models.User.id).filter(
            models.User.nome.ilike(like)
        )
    if start_date:
        try:
            d = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(cast(models.Closing.data_referencia, Date) >= d)
        except ValueError:
            pass
    if end_date:
        try:
            d = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(cast(models.Closing.data_referencia, Date) <= d)
        except ValueError:
            pass

    total, sum_quebra = query.with_entities(
        func.count(models.Closing.id),
        func.coalesce(func.sum(models.Closing.total_quebra), 0.0),
    ).one()

    closings = (query.order_by(models.Closing.created_at.desc())
                .offset((page - 1) * page_size).limit(page_size).all())

    pages = (total + page_size - 1) // page_size
    return schemas.Page(
        items=closings, total=total, page=page, page_size=page_size, pages=pages,
        summary={"sum_quebra": round(float(sum_quebra), 2), "count": total},
    )


@router.get("/{closing_id}", response_model=schemas.ClosingResponse)
def get_closing(
    closing_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Obtém um fechamento específico por ID"""
    closing = db.query(models.Closing).filter(models.Closing.id == closing_id).first()
    if not closing:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    
    # Verificar permissão - operador só pode ver seus próprios
    if current_user.cargo != "admin" and closing.operador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    return closing


@router.post("/create-from-pdfs")
def create_closing_from_pdfs(
    data: ClosingFromPDFs,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Cria um fechamento PENDENTE a partir dos dados extraídos dos PDFs.
    O operador apenas confirma, não edita valores.
    """
    try:
        # Parsear data
        date_str = data.data_referencia
        
        if "/" in date_str:
            # Formato brasileiro: 24/11/2025 ou 24/11/2025 14:38:43
            # Extrair apenas a parte da data (sem hora)
            date_part = date_str.split(" ")[0] if " " in date_str else date_str
            parts = date_part.split("/")
            
            # Validar que temos 3 partes
            if len(parts) != 3:
                raise ValueError(f"Formato de data inválido: {date_str}")
            
            day = int(parts[0])
            month = int(parts[1])
            year = int(parts[2])
            
            # Validar ano (pode ser 2025 ou 25)
            if year < 100:
                year += 2000
                
            data_ref = datetime(year, month, day)
        else:
            # Formato ISO
            data_ref = datetime.fromisoformat(date_str.replace("Z", ""))
        
        # Calcular totais
        total_entradas = sum(m.get("valor", 0) for m in data.movimentos if m.get("tipo") == "Entrada")
        total_saidas = sum(m.get("valor", 0) for m in data.movimentos if m.get("tipo") == "Saída")

        # Calcular total_quebra usando Regra de Divergência Absoluta
        # Ex: -10 e +10 = 20 de quebra, não 0
        total_quebra = sum(abs(c["diferenca"]) for c in data.conferencia)

        # Regra de Auto-Aprovação: Se quebra <= 3.00, aprova automaticamente
        status_inicial = "Pendente"
        if total_quebra <= 3.00:
            status_inicial = "Aprovado"
        
        # Criar fechamento
        closing = models.Closing(
            operador_id=current_user.id,
            data_referencia=data_ref,
            status=status_inicial,
            total_entradas=total_entradas,
            total_saidas=total_saidas,
            total_quebra=total_quebra
        )
        db.add(closing)
        db.flush()  # Para obter o ID
        
        # Adicionar movimentos
        for mov in data.movimentos:
            movement = models.ClosingMovement(
                closing_id=closing.id,
                tipo=mov.get("tipo", ""),
                valor=mov.get("valor", 0),
                historico=mov.get("obs", mov.get("historico", "")),
                moeda=mov.get("moeda", "DINHEIRO"),
                descricao=mov.get("descricao", "")
            )
            db.add(movement)
            
            historico = mov.get("obs", mov.get("historico", "")).upper()
            tipo = mov.get("tipo", "")
            valor = mov.get("valor", 0)
            descricao = mov.get("descricao", "") or historico
            
            # Auto-criar registro de Sangria para TODAS as saídas
            if tipo == "Saída" and valor > 0:
                sangria = models.Sangria(
                    operador_id=current_user.id,
                    valor=valor,
                    motivo=descricao,
                    origem=models.SangriaOrigem.FECHAMENTO,
                    status=models.SangriaStatus.PENDENTE,
                    closing_id=closing.id
                )
                db.add(sangria)
            
            # Auto-criar registro de PIX para entradas com PIX no nome
            if tipo == "Entrada" and "PIX" in historico and valor > 0:
                from datetime import datetime as dt
                pix_entry = models.PixEntry(
                    valor=valor,
                    observacao=f"{historico} - {descricao}" if descricao != historico else historico,
                    data_transacao=data_ref,
                    status="Pendente"
                )
                db.add(pix_entry)
        
        # Adicionar conferências
        for conf in data.conferencia:
            conference = models.ClosingConference(
                closing_id=closing.id,
                forma_pagamento=conf.get("forma", ""),
                valor_informado=conf.get("informado", 0),
                valor_calculado=conf.get("calculado", 0),
                valor_oficial=conf.get("oficial", conf.get("informado", 0)),
                diferenca=conf.get("diferenca", 0),
                justificativa=conf.get("justificativa", "")
            )
            db.add(conference)
        
        db.commit()
        db.refresh(closing)
        
        return {
            "success": True,
            "message": f"Fechamento criado com sucesso e status: {closing.status}",
            "closing_id": closing.id,
            "status": closing.status
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar fechamento: {str(e)}")


@router.put("/{closing_id}/approve")
def approve_closing(
    closing_id: int,
    data: ApproveClosing,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    Admin aprova um fechamento pendente.
    Pode opcionalmente ajustar valores oficiais antes de aprovar.
    """
    closing = db.query(models.Closing).filter(models.Closing.id == closing_id).first()
    if not closing:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    
    if closing.status != "Pendente":
        raise HTTPException(status_code=400, detail="Apenas fechamentos pendentes podem ser aprovados")
    
    # Se admin enviou ajustes nas conferências
    if data.conferencias:
        for conf_data in data.conferencias:
            conf = db.query(models.ClosingConference).filter(
                models.ClosingConference.closing_id == closing_id,
                models.ClosingConference.forma_pagamento == conf_data.get("forma_pagamento")
            ).first()
            if conf:
                if "valor_oficial" in conf_data:
                    conf.valor_oficial = conf_data["valor_oficial"]
                    conf.diferenca = conf.valor_oficial - conf.valor_calculado
                if "justificativa" in conf_data:
                    conf.justificativa = conf_data["justificativa"]
        
        # Recalcular total quebra (Divergência Absoluta)
        total_quebra = sum(abs(c.diferenca) for c in closing.conferencias)
        closing.total_quebra = total_quebra
    
    # Atualizar status
    closing.status = "Aprovado"
    if data.observacao_gerente:
        closing.observacao_gerente = data.observacao_gerente
    
    db.commit()
    
    return {
        "success": True,
        "message": "Fechamento aprovado com sucesso",
        "closing_id": closing.id,
        "status": closing.status
    }


@router.put("/{closing_id}/reject")
def reject_closing(
    closing_id: int,
    data: RejectClosing,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    Admin rejeita um fechamento pendente.
    """
    closing = db.query(models.Closing).filter(models.Closing.id == closing_id).first()
    if not closing:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    
    if closing.status != "Pendente":
        raise HTTPException(status_code=400, detail="Apenas fechamentos pendentes podem ser rejeitados")
    
    closing.status = "Rejeitado"
    closing.observacao_gerente = data.motivo
    
    db.commit()
    
    return {
        "success": True,
        "message": "Fechamento rejeitado",
        "closing_id": closing.id,
        "status": closing.status,
        "motivo": data.motivo
    }

@router.put("/{closing_id}/unapprove")
def unapprove_closing(
    closing_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    Admin DESAPROVA um fechamento (retorna para Pendente).
    """
    closing = db.query(models.Closing).filter(models.Closing.id == closing_id).first()
    if not closing:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
    
    # Permitir desaprovar Aprovados ou Rejeitados
    if closing.status not in ["Aprovado", "Rejeitado"]:
         raise HTTPException(status_code=400, detail="Apenas fechamentos Aprovados ou Rejeitados podem ser desaprovados")
            
    closing.status = "Pendente"
    # Não limpamos observacao_gerente propositalmente, para manter histórico se quiserem
    
    db.commit()
    
    return {
        "success": True,
        "message": "Fechamento retornado para Pendente",
        "closing_id": closing.id,
        "status": closing.status
    }

@router.delete("/{closing_id}")
def delete_closing_route(
    closing_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin)
):
    """
    Admin EXCLUI um fechamento permanentemente.
    """
    result = crud.delete_closing(db, closing_id=closing_id)
    if not result:
        raise HTTPException(status_code=404, detail="Fechamento não encontrado")
        
    return {
        "success": True,
        "message": "Fechamento excluído com sucesso"
    }

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta, date
from typing import Optional
import models, database, auth

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(auth.get_current_user)]
)

@router.get("/stats")
def get_dashboard_stats(
    data: Optional[str] = Query(None, description="Data no formato YYYY-MM-DD"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Retorna estatísticas para o dashboard.
    Admin vê dados globais, Operador vê apenas seus próprios dados.
    Por padrão, exibe dados de ONTEM (fechamentos são feitos no fim do dia).
    Aceita parâmetro ?data=YYYY-MM-DD para filtrar por data específica.
    Filtra por DATA_REFERENCIA (data do caixa), não created_at.
    """
    # Usar data do parâmetro ou ontem como padrão
    if data:
        try:
            target_date = datetime.strptime(data, "%Y-%m-%d").date()
        except ValueError:
            target_date = (datetime.utcnow() - timedelta(days=1)).date()
    else:
        target_date = (datetime.utcnow() - timedelta(days=1)).date()
    
    is_admin = current_user.cargo == "admin"
    
    # Base query para fechamentos
    def base_closing_query():
        q = db.query(models.Closing)
        if not is_admin:
            q = q.filter(models.Closing.operador_id == current_user.id)
        return q
    
    # Fechamentos do dia (filtra por data_referencia)
    closings_today = base_closing_query().filter(
        cast(models.Closing.data_referencia, Date) == target_date
    ).count()
    
    # Fechamentos pendentes
    pending_count = base_closing_query().filter(
        models.Closing.status == "Pendente"
    ).count()
    
    # Quebra acumulada do dia (filtra por data_referencia)
    quebra_query = db.query(func.sum(models.Closing.total_quebra)).filter(
        cast(models.Closing.data_referencia, Date) == target_date
    )
    if not is_admin:
        quebra_query = quebra_query.filter(models.Closing.operador_id == current_user.id)
    quebra_acumulada = quebra_query.scalar() or 0.0
    
    # Total processado (filtra por data_referencia)
    total_query = db.query(
        func.sum(models.Closing.total_entradas + models.Closing.total_saidas)
    ).filter(
        cast(models.Closing.data_referencia, Date) == target_date
    )
    if not is_admin:
        total_query = total_query.filter(models.Closing.operador_id == current_user.id)
    total_processed = total_query.scalar() or 0.0
    
    # Valores por forma de pagamento (filtra por data_referencia)
    payment_query = db.query(
        models.ClosingConference.forma_pagamento,
        func.sum(models.ClosingConference.valor_informado).label('total')
    ).join(models.Closing).filter(
        cast(models.Closing.data_referencia, Date) == target_date
    )
    if not is_admin:
        payment_query = payment_query.filter(models.Closing.operador_id == current_user.id)
    payment_volumes = payment_query.group_by(models.ClosingConference.forma_pagamento).all()
    
    chart_data = [
        {"name": p.forma_pagamento or "Outros", "value": float(p.total or 0)}
        for p in payment_volumes
    ]
    
    if not chart_data:
        chart_data = [
            {"name": "Dinheiro", "value": 0},
            {"name": "Cartão", "value": 0},
            {"name": "Pix", "value": 0},
        ]
    
    # Últimos fechamentos
    recent_query = db.query(models.Closing)
    if not is_admin:
        recent_query = recent_query.filter(models.Closing.operador_id == current_user.id)
    recent_closings = recent_query.order_by(models.Closing.created_at.desc()).limit(10).all()
    
    recent_list = []
    for c in recent_closings:
        operador_nome = c.operador_rel.nome if c.operador_rel else "Operador"
        recent_list.append({
            "id": c.id,
            "data": c.data_referencia.isoformat() if c.data_referencia else "",
            "operador": operador_nome,
            "status": c.status,
            "quebra": c.total_quebra
        })
    
    return {
        "fechamentos_hoje": closings_today,
        "quebra_acumulada": round(quebra_acumulada, 2),
        "pendentes": pending_count,
        "total_processado": round(total_processed, 2),
        "chart_data": chart_data,
        "ultimos_fechamentos": recent_list
    }


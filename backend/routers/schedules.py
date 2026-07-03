"""
Router da ESCALA DE TRABALHO.

Endpoints:
  POST /api/schedules/extract         (admin)  -> extrai o PDF via IA p/ revisão
  POST /api/schedules/                (admin)  -> salva/substitui a escala de um funcionário
  GET  /api/schedules/                (admin)  -> lista funcionários + status da escala
  GET  /api/schedules/anchor          (auth)   -> data-âncora global da Semana 1
  PUT  /api/schedules/anchor          (admin)  -> define a data-âncora global
  GET  /api/schedules/user/{user_id}  (admin)  -> escala bruta (grade) de um funcionário
  GET  /api/schedules/me              (auth)   -> escala bruta do próprio usuário
  GET  /api/schedules/journey         (auth)   -> jornada calculada (self)  ?start=&end=
  GET  /api/schedules/journey/{uid}   (admin)  -> jornada calculada de um funcionário
"""
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session, joinedload

import models, schemas, database, auth
from schedule_extractor import extract_schedule_pdf
import schedule_logic as logic

import os

router = APIRouter(prefix="/api/schedules", tags=["schedules"])

ANCHOR_KEY = "schedule_anchor_date"
OPENAI_KEY_SETTING = "openai_api_key"
OPENAI_MODEL_SETTING = "openai_model"
DEFAULT_MODEL = "gpt-4o"


def require_admin(current_user: models.User = Depends(auth.get_current_user)):
    if current_user.cargo != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Acesso negado. Apenas administradores.")
    return current_user


# ---------------------------------------------------------------- helpers
def _get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    return row.value if row else None


def _set_setting(db: Session, key: str, value: Optional[str]):
    row = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(models.AppSetting(key=key, value=value))
    db.commit()


def _resolve_openai(db: Session):
    """Chave/modelo da OpenAI: preferimos o que foi salvo pela UI; senão o env."""
    key = _get_setting(db, OPENAI_KEY_SETTING) or os.getenv("OPENAI_API_KEY")
    model = _get_setting(db, OPENAI_MODEL_SETTING) or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    return key, model


def _get_anchor(db: Session) -> Optional[date]:
    row = db.query(models.AppSetting).filter(models.AppSetting.key == ANCHOR_KEY).first()
    if not row or not row.value:
        return None
    try:
        return date.fromisoformat(row.value)
    except ValueError:
        return None


def _set_anchor(db: Session, value: Optional[date]):
    row = db.query(models.AppSetting).filter(models.AppSetting.key == ANCHOR_KEY).first()
    val = value.isoformat() if value else None
    if row:
        row.value = val
    else:
        db.add(models.AppSetting(key=ANCHOR_KEY, value=val))
    db.commit()


def _schedule_to_response(sch: models.EmployeeSchedule) -> schemas.ScheduleResponse:
    return schemas.ScheduleResponse(
        id=sch.id,
        user_id=sch.user_id,
        user_nome=sch.user.nome if sch.user else None,
        user_login=sch.user.login if sch.user else None,
        num_weeks=sch.num_weeks,
        source_filename=sch.source_filename,
        updated_at=sch.updated_at,
        days=[schemas.ScheduleDayResponse(
            week_index=d.week_index, weekday=d.weekday, is_work=d.is_work,
            shifts=d.shifts or [], note=d.note) for d in sch.days],
    )


# ---------------------------------------------------------------- extract
@router.post("/extract", response_model=schemas.ExtractResponse)
async def extract_schedule(
    pdf: UploadFile = File(..., description="PDF da escala de trabalho"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    if not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="O arquivo deve ser um PDF.")
    content = await pdf.read()
    api_key, model = _resolve_openai(db)
    try:
        result = extract_schedule_pdf(content, api_key=api_key, model=model)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao extrair escala: {e}")
    return schemas.ExtractResponse(
        success=True,
        num_weeks=result["num_weeks"],
        days=result["days"],
        warnings=result.get("warnings", []),
    )


# ---------------------------------------------------------------- save
@router.post("/", response_model=schemas.ScheduleResponse)
def save_schedule(
    payload: schemas.ScheduleSave,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado.")
    if payload.num_weeks < 1:
        raise HTTPException(status_code=400, detail="num_weeks inválido.")

    # Substitui a escala existente (uma por funcionário)
    existing = db.query(models.EmployeeSchedule).filter(
        models.EmployeeSchedule.user_id == payload.user_id).first()
    if existing:
        db.delete(existing)
        db.flush()

    sch = models.EmployeeSchedule(
        user_id=payload.user_id,
        num_weeks=payload.num_weeks,
        source_filename=payload.source_filename,
    )
    db.add(sch)
    db.flush()
    for d in payload.days:
        db.add(models.ScheduleDay(
            schedule_id=sch.id,
            week_index=d.week_index,
            weekday=d.weekday,
            is_work=d.is_work,
            shifts=[s.model_dump() for s in d.shifts],
            note=d.note,
        ))
    db.commit()
    db.refresh(sch)
    return _schedule_to_response(sch)


# ---------------------------------------------------------------- list
@router.get("/", response_model=List[schemas.ScheduleSummary])
def list_schedules(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    users = db.query(models.User).filter(models.User.active == True).all()
    out = []
    for u in users:
        sch = u.escala
        out.append(schemas.ScheduleSummary(
            user_id=u.id, nome=u.nome, login=u.login, cargo=u.cargo,
            has_schedule=sch is not None,
            num_weeks=sch.num_weeks if sch else None,
            updated_at=sch.updated_at if sch else None,
        ))
    return out


# ---------------------------------------------------------------- anchor
@router.get("/anchor", response_model=schemas.AnchorConfig)
def get_anchor(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return schemas.AnchorConfig(anchor_date=_get_anchor(db))


@router.put("/anchor", response_model=schemas.AnchorConfig)
def set_anchor(
    cfg: schemas.AnchorConfig,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    _set_anchor(db, cfg.anchor_date)
    return schemas.AnchorConfig(anchor_date=_get_anchor(db))


# ---------------------------------------------------------------- integração OpenAI
@router.get("/integration", response_model=schemas.IntegrationStatus)
def get_integration(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    key = _get_setting(db, OPENAI_KEY_SETTING) or os.getenv("OPENAI_API_KEY")
    model = _get_setting(db, OPENAI_MODEL_SETTING) or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    source = "ui" if _get_setting(db, OPENAI_KEY_SETTING) else ("env" if os.getenv("OPENAI_API_KEY") else None)
    return schemas.IntegrationStatus(
        configured=bool(key),
        model=model,
        key_last4=(key[-4:] if key else None),
        source=source,
    )


@router.put("/integration", response_model=schemas.IntegrationStatus)
def set_integration(
    cfg: schemas.IntegrationUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    # api_key: só atualiza se veio um valor (permite trocar modelo sem reenviar a key)
    if cfg.api_key is not None:
        val = cfg.api_key.strip()
        _set_setting(db, OPENAI_KEY_SETTING, val or None)
    if cfg.model is not None:
        _set_setting(db, OPENAI_MODEL_SETTING, cfg.model.strip() or None)
    return get_integration(db=db, current_user=current_user)


# ---------------------------------------------------------------- overview (admin)
@router.get("/overview", response_model=schemas.OverviewResponse)
def overview(
    start: Optional[str] = Query(None, description="Início do intervalo (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="Fim do intervalo, inclusive (YYYY-MM-DD)"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    """Escala geral: para um intervalo (semana ou mês), a jornada calculada de
    TODOS os funcionários com escala. Usado na aba 'Escala Geral' do admin.
    Sem `end`, retorna a semana (Dom->Sáb) que contém `start`."""
    anchor = _get_anchor(db)
    if not anchor:
        raise HTTPException(status_code=409,
                            detail="A data da Semana 1 ainda não foi definida.")
    base = date.fromisoformat(start) if start else date.today()
    week_start = logic.sunday_of(base)
    if end:
        range_end = date.fromisoformat(end)
        if range_end < week_start:
            range_end = week_start
        num_days = (range_end - week_start).days + 1
        num_days = min(num_days, 45)  # trava de segurança (cobre um mês em grade)
    else:
        num_days = 7
    dates = [week_start + timedelta(days=i) for i in range(num_days)]

    schedules = (db.query(models.EmployeeSchedule)
                 .options(joinedload(models.EmployeeSchedule.user),
                          joinedload(models.EmployeeSchedule.days))
                 .all())

    employees = []
    for sch in schedules:
        grid = {(d.week_index, d.weekday): d for d in sch.days}
        days_out = []
        for cur in dates:
            wk = logic.week_index_for(cur, anchor, sch.num_weeks)
            wd = logic.weekday_pdf(cur)
            day = grid.get((wk, wd))
            shifts = (day.shifts if day else []) or []
            days_out.append(schemas.JourneyDay(
                date=cur, weekday=wd, week_index=wk,
                is_work=bool(day.is_work) if day else False,
                shifts=shifts, total_horas=logic.total_hours(shifts),
                note=day.note if day else None,
            ))
        employees.append(schemas.OverviewEmployee(
            user_id=sch.user_id,
            nome=sch.user.nome if sch.user else None,
            num_weeks=sch.num_weeks, days=days_out,
        ))
    # ordena por nome
    employees.sort(key=lambda e: (e.nome or "").lower())
    return schemas.OverviewResponse(
        week_start=week_start, dates=dates, anchor_date=anchor, employees=employees,
    )


# ---------------------------------------------------------------- get raw
@router.get("/user/{user_id}", response_model=schemas.ScheduleResponse)
def get_user_schedule(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    sch = db.query(models.EmployeeSchedule).filter(
        models.EmployeeSchedule.user_id == user_id).first()
    if not sch:
        raise HTTPException(status_code=404, detail="Funcionário ainda não tem escala cadastrada.")
    return _schedule_to_response(sch)


@router.get("/me", response_model=schemas.ScheduleResponse)
def get_my_schedule(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    sch = db.query(models.EmployeeSchedule).filter(
        models.EmployeeSchedule.user_id == current_user.id).first()
    if not sch:
        raise HTTPException(status_code=404, detail="Você ainda não tem uma escala cadastrada.")
    return _schedule_to_response(sch)


# ---------------------------------------------------------------- journey
def _build_journey(db: Session, user: models.User, start: date, end: date) -> schemas.JourneyResponse:
    sch = user.escala
    if not sch:
        raise HTTPException(status_code=404, detail="Escala não cadastrada para este funcionário.")
    anchor = _get_anchor(db)
    if not anchor:
        raise HTTPException(status_code=409,
                            detail="A data da Semana 1 ainda não foi definida pelo administrador.")

    # Indexa a grade: (week_index, weekday) -> day
    grid = {(d.week_index, d.weekday): d for d in sch.days}
    days_out: List[schemas.JourneyDay] = []
    for cur in logic.daterange(start, end):
        wk = logic.week_index_for(cur, anchor, sch.num_weeks)
        wd = logic.weekday_pdf(cur)
        day = grid.get((wk, wd))
        shifts = (day.shifts if day else []) or []
        is_work = bool(day.is_work) if day else False
        days_out.append(schemas.JourneyDay(
            date=cur, weekday=wd, week_index=wk, is_work=is_work,
            shifts=shifts, total_horas=logic.total_hours(shifts),
            note=day.note if day else None,
        ))
    return schemas.JourneyResponse(
        user_id=user.id, user_nome=user.nome, num_weeks=sch.num_weeks,
        anchor_date=anchor, days=days_out,
    )


def _parse_range(start: Optional[str], end: Optional[str]):
    """Default: janela de 28 dias a partir de hoje (cobre o maior ciclo)."""
    today = date.today()
    s = date.fromisoformat(start) if start else today
    e = date.fromisoformat(end) if end else (s + timedelta(days=27))
    if e < s:
        s, e = e, s
    if (e - s).days > 120:
        raise HTTPException(status_code=400, detail="Intervalo máximo de 120 dias.")
    return s, e


@router.get("/journey", response_model=schemas.JourneyResponse)
def my_journey(
    start: Optional[str] = Query(None), end: Optional[str] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    s, e = _parse_range(start, end)
    return _build_journey(db, current_user, s, e)


@router.get("/journey/{user_id}", response_model=schemas.JourneyResponse)
def user_journey(
    user_id: int, start: Optional[str] = Query(None), end: Optional[str] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado.")
    s, e = _parse_range(start, end)
    return _build_journey(db, user, s, e)

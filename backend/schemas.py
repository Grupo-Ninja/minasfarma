from pydantic import BaseModel
from typing import Optional, List, Generic, TypeVar
from datetime import datetime, date

# --- PAGINAÇÃO (envelope genérico) ---
DataT = TypeVar("DataT")

class Page(BaseModel, Generic[DataT]):
    items: List[DataT]
    total: int          # total de registros que casam com o filtro
    page: int           # página atual (1-based)
    page_size: int
    pages: int          # total de páginas
    summary: Optional[dict] = None  # agregados do conjunto filtrado (ex.: soma)

# --- USER SCHEMAS ---
class UserBase(BaseModel):
    login: str
    nome: Optional[str] = None
    cargo: str = "operador"

class UserCreate(UserBase):
    senha: str

class UserUpdate(BaseModel):
    """Schema para atualização de usuário (campos opcionais)"""
    login: Optional[str] = None
    nome: Optional[str] = None
    cargo: Optional[str] = None
    active: Optional[bool] = None
    senha: Optional[str] = None  # Permite que o admin altere a senha

class UserPasswordUpdate(BaseModel):
    """Schema para alteração de senha"""
    senha_atual: str
    nova_senha: str

class UserResponse(UserBase):
    id: int
    active: bool

    class Config:
        from_attributes = True

# --- TOKEN SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    login: Optional[str] = None

# --- SANGRIA SCHEMAS ---
class SangriaBase(BaseModel):
    valor: float
    motivo: str

class SangriaCreate(SangriaBase):
    origem: Optional[str] = "Manual"
    pass # Operador é pego do usuário logado

class SangriaUpdateStatus(BaseModel):
    status: str

class SangriaResponse(SangriaBase):
    id: int
    created_at: datetime
    operador_id: int
    operador_nome: Optional[str] = None # Para facilitar listagem
    status: str
    origem: str
    closing_id: Optional[int] = None

    class Config:
        from_attributes = True

# --- PIX SCHEMAS ---
class PixBase(BaseModel):
    valor: float
    observacao: Optional[str] = None
    data_transacao: datetime

class PixCreate(PixBase):
    pass

class PixUpdateStatus(BaseModel):
    status: str # Pendente, Conciliado, Rejeitado

class PixResponse(PixBase):
    id: int
    created_at: datetime
    status: str

    class Config:
        from_attributes = True

# --- CLOSING SCHEMAS ---
class ClosingMovementBase(BaseModel):
    tipo: str # Entrada / Saída
    valor: float
    historico: str
    moeda: str = "BRL"
    descricao: Optional[str] = None  # Descrição/identificação do operador

class ClosingConferenceBase(BaseModel):
    forma_pagamento: str
    valor_informado: float
    valor_calculado: float
    valor_oficial: float
    diferenca: float
    justificativa: Optional[str] = None

class ClosingCreate(BaseModel):
    # O Create recebe tudo de uma vez quando o operador finaliza
    data_referencia: datetime
    movimentos: List[ClosingMovementBase]
    conferencias: List[ClosingConferenceBase]
    total_entradas: float
    total_saidas: float
    total_quebra: float

class ClosingResponse(BaseModel):
    id: int
    operador_id: int
    operador_nome: Optional[str] = None
    created_at: datetime
    data_referencia: datetime
    status: str
    total_quebra: float

    movimentos: List[ClosingMovementBase]
    conferencias: List[ClosingConferenceBase]

    class Config:
        from_attributes = True

class ClosingListItem(BaseModel):
    """Versão leve para LISTAGEM (sem movimentos/conferencias, evita N+1)."""
    id: int
    operador_id: int
    operador_nome: Optional[str] = None
    created_at: datetime
    data_referencia: datetime
    status: str
    total_quebra: float

    class Config:
        from_attributes = True


# --- ESCALA DE TRABALHO SCHEMAS ---
class Shift(BaseModel):
    entrada: str  # "07:00"
    saida: str    # "15:00"

class ScheduleDayBase(BaseModel):
    week_index: int          # 1..num_weeks
    weekday: int             # 0=Domingo .. 6=Sábado
    is_work: bool = False
    shifts: List[Shift] = []
    note: Optional[str] = None

class ScheduleDayResponse(ScheduleDayBase):
    class Config:
        from_attributes = True

class ScheduleSave(BaseModel):
    """Payload enviado pela tela de revisão do admin para salvar a escala."""
    user_id: int
    num_weeks: int
    source_filename: Optional[str] = None
    days: List[ScheduleDayBase]

class ScheduleResponse(BaseModel):
    id: int
    user_id: int
    user_nome: Optional[str] = None
    user_login: Optional[str] = None
    num_weeks: int
    source_filename: Optional[str] = None
    updated_at: Optional[datetime] = None
    days: List[ScheduleDayResponse] = []

    class Config:
        from_attributes = True

class ScheduleSummary(BaseModel):
    """Item de listagem: funcionário + se tem escala."""
    user_id: int
    nome: Optional[str] = None
    login: str
    cargo: str
    has_schedule: bool = False
    num_weeks: Optional[int] = None
    updated_at: Optional[datetime] = None

class ExtractResponse(BaseModel):
    """Resultado da extração (OpenAI) devolvido para revisão do admin."""
    success: bool
    num_weeks: int
    days: List[ScheduleDayBase]
    warnings: List[str] = []

class AnchorConfig(BaseModel):
    anchor_date: Optional[date] = None  # Data que representa a Semana 1 (global)

# --- INTEGRAÇÃO OPENAI (configurável pela UI) ---
class IntegrationStatus(BaseModel):
    configured: bool
    model: str
    key_last4: Optional[str] = None       # só os 4 últimos dígitos (nunca a key inteira)
    source: Optional[str] = None          # 'ui' | 'env' | None

class IntegrationUpdate(BaseModel):
    api_key: Optional[str] = None         # se None, mantém a atual; string vazia limpa
    model: Optional[str] = None

# --- JORNADA (visão calculada por data) ---
class JourneyDay(BaseModel):
    date: date
    weekday: int             # 0=Domingo .. 6=Sábado
    week_index: int          # Qual semana do ciclo caiu nessa data
    is_work: bool
    shifts: List[Shift] = []
    total_horas: float = 0.0
    note: Optional[str] = None

class JourneyResponse(BaseModel):
    user_id: int
    user_nome: Optional[str] = None
    num_weeks: int
    anchor_date: Optional[date] = None
    days: List[JourneyDay] = []

# --- VISÃO GERAL (semana x funcionários) ---
class OverviewEmployee(BaseModel):
    user_id: int
    nome: Optional[str] = None
    num_weeks: int
    days: List[JourneyDay] = []

class OverviewResponse(BaseModel):
    week_start: date
    dates: List[date] = []
    anchor_date: Optional[date] = None
    employees: List[OverviewEmployee] = []

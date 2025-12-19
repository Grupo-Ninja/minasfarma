from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- USER SCHEMAS ---
class UserBase(BaseModel):
    login: str
    nome: Optional[str] = None
    cargo: str = "operador"

class UserCreate(UserBase):
    senha: str

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
    pass # Operador é pego do usuário logado

class SangriaResponse(SangriaBase):
    id: int
    created_at: datetime
    operador_id: int
    operador_nome: Optional[str] = None # Para facilitar listagem

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
    created_at: datetime
    data_referencia: datetime
    status: str
    total_quebra: float
    
    movimentos: List[ClosingMovementBase]
    conferencias: List[ClosingConferenceBase]

    class Config:
        from_attributes = True

from sqlalchemy import Column, Integer, String, Boolean, Enum, Float, ForeignKey, DateTime, Text, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OPERADOR = "operador"

class PixStatus(str, enum.Enum):
    PENDENTE = "Pendente"
    CONCILIADO = "Conciliado"
    REJEITADO = "Rejeitado"

class ClosingStatus(str, enum.Enum):
    ABERTO = "Aberto"
    FECHADO = "Fechado"
    APROVADO = "Aprovado"
    REJEITADO = "Rejeitado"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    # A unicidade Ã© aplicada por migraÃ§Ã£o apenas aos usuÃ¡rios ativos.
    # Assim, registros desativados podem permanecer no histÃ³rico sem bloquear
    # o recadastro do mesmo login.
    login = Column(String, index=True, nullable=False)
    senha = Column(String, nullable=False)
    cargo = Column(String, default=UserRole.OPERADOR)
    active = Column(Boolean, default=True)

    # Relationships
    sangrias = relationship("Sangria", back_populates="operador_rel")
    fechamentos = relationship("Closing", back_populates="operador_rel")
    escala = relationship("EmployeeSchedule", back_populates="user", uselist=False, cascade="all, delete-orphan")

class SangriaStatus(str, enum.Enum):
    PENDENTE = "Pendente"
    CONCILIADO = "Conciliado"

class SangriaOrigem(str, enum.Enum):
    MANUAL = "Manual"
    FECHAMENTO = "Fechamento"

class Sangria(Base):
    __tablename__ = "sangrias"

    id = Column(Integer, primary_key=True, index=True)
    valor = Column(Float, nullable=False)
    motivo = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    operador_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default=SangriaStatus.PENDENTE)
    origem = Column(String, default=SangriaOrigem.MANUAL)
    closing_id = Column(Integer, ForeignKey("closings.id", ondelete="CASCADE"), nullable=True)

    operador_rel = relationship("User", back_populates="sangrias")
    closing_rel = relationship("Closing", back_populates="sangrias")

class PixEntry(Base):
    __tablename__ = "pix_entries"

    id = Column(Integer, primary_key=True, index=True)
    valor = Column(Float, nullable=False)
    observacao = Column(String, nullable=True)
    data_transacao = Column(DateTime, nullable=False) # Data que aconteceu a transação
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default=PixStatus.PENDENTE)

class Closing(Base):
    __tablename__ = "closings"

    id = Column(Integer, primary_key=True, index=True)
    operador_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    data_referencia = Column(DateTime, nullable=False) # Data do fechamento (geralmente hoje)
    status = Column(String, default=ClosingStatus.FECHADO)
    
    # Valores Totais (Snapshot)
    total_entradas = Column(Float, default=0.0)
    total_saidas = Column(Float, default=0.0)
    total_quebra = Column(Float, default=0.0)
    
    observacao_gerente = Column(Text, nullable=True)

    operador_rel = relationship("User", back_populates="fechamentos")
    movimentos = relationship("ClosingMovement", back_populates="closing", cascade="all, delete-orphan")
    conferencias = relationship("ClosingConference", back_populates="closing", cascade="all, delete-orphan")
    sangrias = relationship("Sangria", back_populates="closing_rel", cascade="all, delete-orphan")

    @property
    def operador_nome(self):
        return self.operador_rel.nome if self.operador_rel else None

class ClosingMovement(Base):
    __tablename__ = "closing_movements"

    id = Column(Integer, primary_key=True, index=True)
    closing_id = Column(Integer, ForeignKey("closings.id"))
    tipo = Column(String, nullable=False) # Entrada / Saída
    valor = Column(Float, nullable=False)
    historico = Column(String, nullable=False)
    moeda = Column(String, default="BRL")
    descricao = Column(String, nullable=True)  # Descrição/identificação do operador
    
    closing = relationship("Closing", back_populates="movimentos")

class ClosingConference(Base):
    __tablename__ = "closing_conferences"

    id = Column(Integer, primary_key=True, index=True)
    closing_id = Column(Integer, ForeignKey("closings.id"))
    forma_pagamento = Column(String, nullable=False) # Dinheiro, Cartão, Pix
    valor_informado = Column(Float, default=0.0) # Vindo do sistema/pdf
    valor_calculado = Column(Float, default=0.0) # Processado pelo sistema
    valor_oficial = Column(Float, default=0.0) # Contado pelo operador
    diferenca = Column(Float, default=0.0)
    justificativa = Column(String, nullable=True)

    closing = relationship("Closing", back_populates="conferencias")


# =========================================================================
#  ESCALA DE TRABALHO (rotativa por N semanas, ancorada numa data global)
# =========================================================================

class EmployeeSchedule(Base):
    """Escala de um funcionário: um ciclo rotativo de N semanas (Semana 1..N)."""
    __tablename__ = "employee_schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    num_weeks = Column(Integer, nullable=False, default=4)  # Tamanho do ciclo (2, 4, ...)
    source_filename = Column(String, nullable=True)         # PDF de origem
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="escala")
    days = relationship(
        "ScheduleDay",
        back_populates="schedule",
        cascade="all, delete-orphan",
        order_by="ScheduleDay.week_index, ScheduleDay.weekday",
    )


class ScheduleDay(Base):
    """Um dia dentro de uma semana do ciclo.

    weekday: 0=Domingo, 1=Segunda, ... 6=Sábado (padrão do PDF).
    shifts:  lista de turnos [{"entrada": "07:00", "saida": "15:00"}, ...].
    """
    __tablename__ = "schedule_days"
    __table_args__ = (UniqueConstraint("schedule_id", "week_index", "weekday", name="uq_schedule_week_day"),)

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("employee_schedules.id", ondelete="CASCADE"), nullable=False)
    week_index = Column(Integer, nullable=False)   # 1..num_weeks
    weekday = Column(Integer, nullable=False)       # 0=Domingo .. 6=Sábado
    is_work = Column(Boolean, nullable=False, default=False)
    shifts = Column(JSON, nullable=False, default=list)  # [{"entrada","saida"}]
    note = Column(String, nullable=True)

    schedule = relationship("EmployeeSchedule", back_populates="days")


class AppSetting(Base):
    """Configurações globais chave/valor (ex.: data-âncora da Semana 1)."""
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)

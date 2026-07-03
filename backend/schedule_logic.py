"""
Lógica de cálculo da jornada a partir da escala rotativa + data-âncora global.

Regras:
  - As semanas do PDF vão de Domingo (0) a Sábado (6).
  - Existe UMA data-âncora global (guardada em app_settings) que representa a
    "Semana 1" para TODOS os funcionários.
  - Para uma data qualquer, calculamos quantas semanas se passaram desde a âncora
    e aplicamos módulo pelo tamanho do ciclo de cada funcionário (2, 4, ...).
"""
from datetime import date, timedelta
from typing import Optional


def sunday_of(d: date) -> date:
    """Retorna o Domingo que inicia a semana da data (semana Domingo->Sábado)."""
    # Python: Monday=0 .. Sunday=6  =>  offset até o domingo anterior/atual
    return d - timedelta(days=(d.weekday() + 1) % 7)


def weekday_pdf(d: date) -> int:
    """Converte para o índice do PDF: Domingo=0 .. Sábado=6."""
    return (d.weekday() + 1) % 7


def week_index_for(target: date, anchor: date, num_weeks: int) -> int:
    """Índice da semana do ciclo (1..num_weeks) para a data alvo."""
    if num_weeks <= 0:
        return 1
    weeks_between = (sunday_of(target) - sunday_of(anchor)).days // 7
    return (weeks_between % num_weeks) + 1


def shift_hours(entrada: str, saida: str) -> float:
    """Duração em horas de um turno 'HH:MM' -> 'HH:MM' (trata virada de meia-noite)."""
    try:
        eh, em = (int(x) for x in entrada.split(":")[:2])
        sh, sm = (int(x) for x in saida.split(":")[:2])
    except (ValueError, AttributeError):
        return 0.0
    start = eh * 60 + em
    end = sh * 60 + sm
    if end < start:
        end += 24 * 60
    return round((end - start) / 60.0, 2)


def total_hours(shifts) -> float:
    return round(sum(shift_hours(s.get("entrada", ""), s.get("saida", "")) for s in (shifts or [])), 2)


def daterange(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)

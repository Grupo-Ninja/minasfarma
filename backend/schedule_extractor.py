"""
Extração da ESCALA DE TRABALHO a partir do PDF.

Os PDFs de escala têm a grade (dias/horários) gravada como IMAGEM (sem camada
de texto), então usamos um modelo de VISÃO da OpenAI para ler a imagem e devolver
a escala em JSON estruturado. O admin revisa/edita antes de salvar.

Fluxo:
  1. Renderiza cada página do PDF em PNG (pypdfium2, sem dependências de sistema).
  2. Envia as imagens ao modelo de visão da OpenAI pedindo JSON estrito.
  3. Normaliza para a estrutura de dias do sistema (weekday 0=Domingo..6=Sábado).
"""
import os
import io
import json
import base64
from typing import Dict, Any, List

import pypdfium2 as pdfium

# Modelo de visão configurável por env (default gpt-4o)
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

WEEKDAY_MAP = {
    "domingo": 0, "segunda": 1, "segunda-feira": 1, "terca": 2, "terça": 2,
    "terca-feira": 2, "terça-feira": 2, "quarta": 3, "quarta-feira": 3,
    "quinta": 4, "quinta-feira": 4, "sexta": 5, "sexta-feira": 5, "sabado": 6, "sábado": 6,
}

SYSTEM_PROMPT = (
    "Você é um extrator de escalas de trabalho. Recebe imagens de uma tabela de "
    "'ESCALA DE TRABALHO' de um funcionário de farmácia e devolve os dados em JSON. "
    "A tabela é dividida em blocos 'Semana 1', 'Semana 2', etc. Cada semana tem 7 "
    "linhas (Domingo a Sábado). Cada linha tem uma 'Classificação' que é 'Dia de "
    "trabalho' ou 'Dia de descanso', e colunas de horários em pares "
    "(1ª entrada / 1ª saída, 2ª entrada / 2ª saída, ...). "
    "Ignore células vazias mostradas como 'hh:mm'. Para 'Dia de descanso' não há "
    "horários. Colunas como 'Intervalo principal', 'Horário da virada' e 'Limite H' "
    "NÃO são turnos e devem ser ignoradas."
)

USER_INSTRUCTION = (
    "Extraia a escala destas imagens e responda APENAS com JSON válido, sem texto "
    "extra e sem markdown, no formato exato:\n"
    "{\n"
    '  "num_weeks": <int>,\n'
    '  "days": [\n'
    '    {"week_index": <1..num_weeks>, "weekday": <0=Domingo..6=Sábado>, '
    '"is_work": <true|false>, "shifts": [{"entrada": "HH:MM", "saida": "HH:MM"}]}\n'
    "  ]\n"
    "}\n"
    "Regras: inclua as 7 linhas de cada semana. Em 'Dia de descanso' use is_work=false "
    "e shifts=[]. Em 'Dia de trabalho' liste todos os pares entrada/saída preenchidos, "
    "na ordem. Use sempre horário 24h HH:MM."
)


def _render_pages_to_png(file_content: bytes, scale: float = 2.0) -> List[bytes]:
    """Renderiza cada página do PDF em PNG (alta resolução para leitura da grade)."""
    images: List[bytes] = []
    pdf = pdfium.PdfDocument(file_content)
    try:
        for i in range(len(pdf)):
            page = pdf[i]
            bitmap = page.render(scale=scale)
            pil_image = bitmap.to_pil()
            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")
            images.append(buf.getvalue())
    finally:
        pdf.close()
    return images


def _clean_json_text(text: str) -> str:
    """Remove cercas de markdown se o modelo devolver ```json ... ```."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1] if text.count("```") >= 2 else text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    return text.strip()


def _normalize(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Valida e normaliza a saída do modelo para a estrutura do sistema."""
    warnings: List[str] = []
    days_in = raw.get("days", []) or []
    num_weeks = int(raw.get("num_weeks") or 0)

    norm_days = []
    seen = set()
    for d in days_in:
        try:
            wk = int(d.get("week_index"))
        except (TypeError, ValueError):
            continue
        weekday = d.get("weekday")
        if isinstance(weekday, str):
            weekday = WEEKDAY_MAP.get(weekday.strip().lower())
        if weekday is None:
            continue
        weekday = int(weekday)
        if not (0 <= weekday <= 6) or wk < 1:
            continue
        is_work = bool(d.get("is_work"))
        shifts = []
        if is_work:
            for s in (d.get("shifts") or []):
                ent = (s.get("entrada") or "").strip()
                sai = (s.get("saida") or "").strip()
                if ent and sai and ent.lower() != "hh:mm" and sai.lower() != "hh:mm":
                    shifts.append({"entrada": ent, "saida": sai})
            if not shifts:
                # trabalho sem turno legível -> avisa
                warnings.append(f"Semana {wk}, dia {weekday}: dia de trabalho sem horários legíveis.")
        key = (wk, weekday)
        if key in seen:
            continue
        seen.add(key)
        norm_days.append({
            "week_index": wk,
            "weekday": weekday,
            "is_work": is_work,
            "shifts": shifts,
            "note": None,
        })

    if not num_weeks and norm_days:
        num_weeks = max(d["week_index"] for d in norm_days)

    # Preenche dias faltantes como descanso, para a grade ficar completa.
    for wk in range(1, num_weeks + 1):
        for wd in range(7):
            if (wk, wd) not in seen:
                norm_days.append({"week_index": wk, "weekday": wd, "is_work": False, "shifts": [], "note": None})
                warnings.append(f"Semana {wk}, dia {wd}: não lido, assumido como descanso (revise).")

    norm_days.sort(key=lambda d: (d["week_index"], d["weekday"]))
    return {"num_weeks": num_weeks, "days": norm_days, "warnings": warnings}


def extract_schedule_pdf(file_content: bytes, api_key: str = None, model: str = None) -> Dict[str, Any]:
    """Extrai a escala de trabalho de um PDF usando o modelo de visão da OpenAI.

    api_key/model podem vir da configuração salva pela UI (app_settings). Se não
    forem passados, caímos para as variáveis de ambiente.
    """
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    model = model or OPENAI_MODEL
    if not api_key:
        raise RuntimeError(
            "Chave da OpenAI não configurada. Configure em 'Escalas > Integração OpenAI' "
            "para habilitar a extração automática da escala por IA."
        )

    images = _render_pages_to_png(file_content)
    if not images:
        raise RuntimeError("Não foi possível renderizar o PDF.")

    # Monta o conteúdo multimodal (instrução + imagens das páginas)
    content: List[Dict[str, Any]] = [{"type": "text", "text": USER_INSTRUCTION}]
    for img in images:
        b64 = base64.b64encode(img).decode("ascii")
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{b64}"},
        })

    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )
    text = resp.choices[0].message.content or "{}"
    raw = json.loads(_clean_json_text(text))
    return _normalize(raw)

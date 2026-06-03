"""
Módulo para extração de dados dos PDFs de fechamento de caixa.
Usa pdfplumber para ler e parsear os PDFs do sistema da farmácia.
"""
import pdfplumber
import re
from typing import Dict, List, Any, Optional
from io import BytesIO
from datetime import datetime


def extract_caixa_pdf(file_content: bytes) -> Dict[str, Any]:
    """
    Extrai dados do PDF de Fechamento de Caixa (ex: CAIXA 180.pdf)
    
    Retorna:
    {
        "operador": str,
        "caixa": int,
        "data_abertura": str,
        "data_fechamento": str,
        "vendas": {
            "dinheiro": float,
            "cartao": float,
            "pix": float,
            "crediario": float,
            "cheque_vista": float,
            "total": float
        },
        "movimentos": [
            {"historico": str, "moeda": str, "obs": str, "tipo": str, "valor": float}
        ],
        "vendas_cartao_detalhe": [
            {"tipo": str, "valor": float, "qtd": int}
        ]
    }
    """
    result = {
        "operador": "",
        "caixa": 0,
        "data_abertura": "",
        "data_fechamento": "",
        "vendas": {
            "dinheiro": 0.0,
            "cartao": 0.0,
            "pix": 0.0,
            "crediario": 0.0,
            "cheque_vista": 0.0,
            "total": 0.0
        },
        "movimentos": [],
        "vendas_cartao_detalhe": []
    }
    
    try:
        with pdfplumber.open(BytesIO(file_content)) as pdf:
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() or ""
            
            # Extrair operador e caixa
            # Pattern: Caixa: 180 - TAIS MONTEIRO GUIMARAES. ABERTURA: 24/11/2025 07:19:01 | FECHAMENTO: 24/11/2025 14:38:43
            caixa_match = re.search(
                r'Caixa:\s*(\d+)\s*-\s*([^.]+)\.\s*ABERTURA:\s*(\d{2}/\d{2}/\d{4}\s*\d{2}:\d{2}:\d{2})\s*\|\s*FECHAMENTO:\s*(\d{2}/\d{2}/\d{4}\s*\d{2}:\d{2}:\d{2})',
                full_text
            )
            if caixa_match:
                result["caixa"] = int(caixa_match.group(1))
                result["operador"] = caixa_match.group(2).strip()
                result["data_abertura"] = caixa_match.group(3).strip()
                result["data_fechamento"] = caixa_match.group(4).strip()
            
            # Extrair vendas por forma de pagamento
            # VENDAS DINHEIRO: 666,77
            dinheiro_match = re.search(r'VENDAS DINHEIRO:\s*([\d.,]+)', full_text)
            if dinheiro_match:
                result["vendas"]["dinheiro"] = parse_brazilian_number(dinheiro_match.group(1))
            
            # VENDAS CARTÃO: 2.373,93
            cartao_match = re.search(r'VENDAS CARTÃO:\s*([\d.,]+)', full_text)
            if cartao_match:
                result["vendas"]["cartao"] = parse_brazilian_number(cartao_match.group(1))
            
            # VENDAS CREDIÁRIO: 7,00
            crediario_match = re.search(r'VENDAS CREDIÁRIO:\s*([\d.,]+)', full_text)
            if crediario_match:
                result["vendas"]["crediario"] = parse_brazilian_number(crediario_match.group(1))
            
            # Extrair movimentos de caixa
            # Pattern para tabela de movimentos:
            # 2 SAIDA    DINHEIRO    SANGRIA    Saída    677,00
            movimento_pattern = re.findall(
                r'(\d+)\s+(SAIDA|ENTRADA)\s+(\w+(?:\s+\w+)?)\s+([A-Z\s]+?)\s+(Saída|Entrada)\s+([\d.,]+)',
                full_text
            )
            for mov in movimento_pattern:
                result["movimentos"].append({
                    "historico": mov[1],  # SAIDA/ENTRADA
                    "moeda": mov[2],      # DINHEIRO/CHEQUE A VISTA
                    "obs": mov[3].strip(),  # SANGRIA/GASOLINA/PIX CELULAR
                    "tipo": mov[4],       # Saída/Entrada
                    "valor": parse_brazilian_number(mov[5])
                })
            
            # Se não encontrou movimentos pelo regex, tentar padrão alternativo
            if not result["movimentos"]:
                # Procurar seção de Movimento de Caixa Detalhado
                mov_lines = re.findall(
                    r'(\d+)\s+(SAIDA|ENTRADA)\s+(DINHEIRO|CHEQUE\s*A?\s*VISTA|CARTAO|PIX)\s+([\w\s]+?)\s+(Saída|Entrada)\s+([\d.,]+)',
                    full_text, re.IGNORECASE
                )
                for mov in mov_lines:
                    result["movimentos"].append({
                        "historico": mov[1].upper(),
                        "moeda": mov[2].upper().strip(),
                        "obs": mov[3].strip().upper(),
                        "tipo": "Saída" if mov[4].lower() == "saída" else "Entrada",
                        "valor": parse_brazilian_number(mov[5])
                    })
            
            # Extrair detalhamento de vendas por cartão
            # 1 CARTAO    1.212,16    42    28,86    43,35
            # 3 PIX       1.161,77    30    38,73    41,55
            cartao_pattern = re.findall(
                r'(\d+)\s+(CARTAO|PIX)\s+([\d.,]+)\s+(\d+)',
                full_text
            )
            for card in cartao_pattern:
                result["vendas_cartao_detalhe"].append({
                    "tipo": card[1],
                    "valor": parse_brazilian_number(card[2]),
                    "qtd": int(card[3])
                })
            
            # Atualizar valores de cartão e pix do detalhe
            for detalhe in result["vendas_cartao_detalhe"]:
                if detalhe["tipo"] == "PIX":
                    result["vendas"]["pix"] = detalhe["valor"]
                elif detalhe["tipo"] == "CARTAO":
                    if result["vendas"]["cartao"] == 0:
                        result["vendas"]["cartao"] = detalhe["valor"]
            
            # Calcular total
            result["vendas"]["total"] = (
                result["vendas"]["dinheiro"] +
                result["vendas"]["cartao"] +
                result["vendas"]["pix"] +
                result["vendas"]["crediario"] +
                result["vendas"]["cheque_vista"]
            )
                
    except Exception as e:
        print(f"Erro ao extrair PDF Caixa: {e}")
        raise
    
    return result


def extract_diferenca_pdf(file_content: bytes) -> Dict[str, Any]:
    """
    Extrai dados do PDF de Diferenças de Caixa (ex: 180 DIFERENÇA.pdf)
    
    Retorna:
    {
        "operador": str,
        "caixa": int,
        "data_abertura": str,
        "data_fechamento": str,
        "conferencias": [
            {
                "forma_pagamento": str,
                "valor_informado": float,
                "valor_calculado": float,
                "diferenca": float
            }
        ],
        "total_quebra": float,
        "justificativas": [
            {"forma": str, "diferenca": float, "justificativa": str}
        ]
    }
    """
    result = {
        "operador": "",
        "caixa": 0,
        "data_abertura": "",
        "data_fechamento": "",
        "conferencias": [],
        "total_quebra": 0.0,
        "justificativas": []
    }
    
    try:
        with pdfplumber.open(BytesIO(file_content)) as pdf:
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() or ""
            
            # Extrair operador
            # Operador 12 - TAIS MONTEIRO GUIMARAES
            operador_match = re.search(r'Operador\s*\d+\s*-\s*(.+)', full_text)
            if operador_match:
                result["operador"] = operador_match.group(1).strip()
            
            # Extrair caixa
            caixa_match = re.search(r'Caixa:\s*(\d+)', full_text)
            if caixa_match:
                result["caixa"] = int(caixa_match.group(1))
            
            # Extrair datas
            datas_match = re.search(r'(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})', full_text)
            if datas_match:
                result["data_abertura"] = datas_match.group(1)
                result["data_fechamento"] = datas_match.group(2)
            
            # Extrair conferências por forma de pagamento
            # DINHEIRO    R$ 0,00    R$ -0,23    R$ 0,23
            formas_pagamento = [
                "DINHEIRO", "CHEQUE A VISTA", "CHEQUE PRE-DAT", 
                "CREDIARIO", "CONVENIO", "CARTAO", "PIX", "REEMBOLSO"
            ]
            
            for forma in formas_pagamento:
                # Padrão: FORMA    R$ X,XX    R$ X,XX    R$ X,XX
                pattern = rf'{forma}\s+R\$\s*([\d.,-]+)\s+R\$\s*([\d.,-]+)\s+R\$\s*([\d.,-]+)'
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    informado = parse_brazilian_number(match.group(1))
                    calculado = parse_brazilian_number(match.group(2))
                    diferenca = parse_brazilian_number(match.group(3))
                    
                    # Só adiciona se tiver algum valor diferente de zero
                    if informado != 0 or calculado != 0 or diferenca != 0:
                        result["conferencias"].append({
                            "forma_pagamento": forma.replace(" ", "_").upper(),
                            "valor_informado": informado,
                            "valor_calculado": calculado,
                            "diferenca": diferenca
                        })
            
            # Também procurar CARTAO com valores separados de PIX
            # Padrão alternativo para linha separada
            cartao_pix_match = re.findall(
                r'(CARTAO|PIX)\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)',
                full_text, re.IGNORECASE
            )
            for item in cartao_pix_match:
                forma = item[0].upper()
                valor1 = parse_brazilian_number(item[1])
                valor2 = parse_brazilian_number(item[2])
                
                # Verifica se já existe
                exists = any(c["forma_pagamento"] == forma for c in result["conferencias"])
                if not exists and (valor1 != 0 or valor2 != 0):
                    result["conferencias"].append({
                        "forma_pagamento": forma,
                        "valor_informado": valor1,
                        "valor_calculado": valor1,  # Assume igual se só tem 2 valores
                        "diferenca": 0.0
                    })
            
            # Extrair total quebra
            # Total Valor Quebra:    R$ 0,24
            quebra_match = re.search(r'Total\s*(?:Valor\s*)?Quebra:\s*R\$\s*([\d.,-]+)', full_text, re.IGNORECASE)
            if quebra_match:
                result["total_quebra"] = parse_brazilian_number(quebra_match.group(1))
            
            # Extrair justificativas existentes
            # DINHEIRO    R$ 0,23    ok
            just_pattern = re.findall(
                r'(\w+)\s+R\$\s*([\d.,-]+)\s+(\w+)',
                full_text
            )
            for just in just_pattern:
                if just[0].upper() in formas_pagamento:
                    result["justificativas"].append({
                        "forma": just[0].upper(),
                        "diferenca": parse_brazilian_number(just[1]),
                        "justificativa": just[2]
                    })
                    
    except Exception as e:
        print(f"Erro ao extrair PDF Diferença: {e}")
        raise
    
    return result


def parse_brazilian_number(value: str) -> float:
    """
    Converte número no formato brasileiro (1.234,56) para float.
    Também lida com números negativos e formatos como -0,23
    """
    if not value:
        return 0.0
    
    # Remove espaços
    value = value.strip()
    
    # Verifica se é negativo
    is_negative = value.startswith('-') or value.startswith('(')
    value = value.replace('-', '').replace('(', '').replace(')', '')
    
    # Remove pontos de milhar e troca vírgula por ponto
    value = value.replace('.', '').replace(',', '.')
    
    try:
        result = float(value)
        return -result if is_negative else result
    except ValueError:
        return 0.0


def merge_pdf_data(caixa_data: Dict, diferenca_data: Dict) -> Dict[str, Any]:
    """
    Combina os dados dos dois PDFs em uma estrutura unificada para o frontend.
    """
    return {
        "operadorInfo": {
            "operador": caixa_data.get("operador") or diferenca_data.get("operador", ""),
            "caixa": str(caixa_data.get("caixa") or diferenca_data.get("caixa", "")),
            "data": caixa_data.get("data_fechamento", "").split()[0] if caixa_data.get("data_fechamento") else "",
            "dataAbertura": caixa_data.get("data_abertura", ""),
            "dataFechamento": caixa_data.get("data_fechamento", ""),
            "valoresIniciais": {
                "abertura": 0.0,
                "fundoTroco": 0.0
            }
        },
        "movimentos": [
            {
                "id": idx + 1,
                "historico": mov.get("historico", ""),
                "moeda": mov.get("moeda", ""),
                "obs": mov.get("obs", ""),
                "tipo": mov.get("tipo", ""),
                "valor": mov.get("valor", 0.0)
            }
            for idx, mov in enumerate(caixa_data.get("movimentos", []))
        ],
        "conferencia": [
            {
                "forma": conf.get("forma_pagamento", "").replace("_", " "),
                "informado": conf.get("valor_informado", 0.0),
                "calculado": conf.get("valor_calculado", 0.0),
                "oficial": conf.get("valor_informado", 0.0),  # Inicia igual ao informado
                "diferenca": conf.get("diferenca", 0.0),
                "justificativa": ""
            }
            for conf in diferenca_data.get("conferencias", [])
        ],
        "vendas": caixa_data.get("vendas", {}),
        "totalQuebra": diferenca_data.get("total_quebra", 0.0)
    }

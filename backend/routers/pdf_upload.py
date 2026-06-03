"""
Router para upload e processamento de PDFs de fechamento de caixa.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import models, database, auth
from pdf_extractor import extract_caixa_pdf, extract_diferenca_pdf, merge_pdf_data

router = APIRouter(
    prefix="/api/closings",
    tags=["closings-upload"],
    dependencies=[Depends(auth.get_current_user)]
)


@router.post("/upload-pdfs")
async def upload_and_extract_pdfs(
    caixa_pdf: UploadFile = File(..., description="PDF de Fechamento de Caixa"),
    diferenca_pdf: UploadFile = File(..., description="PDF de Diferenças"),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Recebe os 2 PDFs do fechamento de caixa e retorna os dados extraídos.
    O operador pode então revisar e confirmar o envio.
    """
    # Validar tipos de arquivo
    if not caixa_pdf.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="O primeiro arquivo deve ser um PDF")
    if not diferenca_pdf.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="O segundo arquivo deve ser um PDF")
    
    try:
        # Ler conteúdo dos arquivos
        caixa_content = await caixa_pdf.read()
        diferenca_content = await diferenca_pdf.read()
        
        # Extrair dados de cada PDF
        caixa_data = extract_caixa_pdf(caixa_content)
        diferenca_data = extract_diferenca_pdf(diferenca_content)
        
        # Combinar dados em estrutura unificada
        merged_data = merge_pdf_data(caixa_data, diferenca_data)
        
        return {
            "success": True,
            "message": "PDFs processados com sucesso",
            "data": merged_data,
            "raw": {
                "caixa": caixa_data,
                "diferenca": diferenca_data
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Erro ao processar PDFs: {str(e)}"
        )

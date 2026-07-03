import { LOGO_DATA_URI } from './logoData';

interface PrintOptions {
    title: string;       // Título grande (ex.: "Escala de Trabalho")
    subtitle?: string;   // Linha menor (ex.: "Julho de 2025")
    meta?: string;       // Info discreta (ex.: período / gerado em)
    orientation?: 'portrait' | 'landscape';
    body: string;        // HTML do conteúdo
}

const NAVY = '#0A1E35';
const GOLD = '#C9B68C';

/**
 * Abre uma janela de impressão com layout profissional, CSS 100% embutido
 * (sem depender de CDN) e `print-color-adjust: exact` para que as cores de
 * fundo REALMENTE saiam na impressão/PDF.
 */
export function printHTML({ title, subtitle, meta, orientation = 'landscape', body }: PrintOptions) {
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${title}${subtitle ? ' — ' + subtitle : ''}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, 'Helvetica Neue', sans-serif; color: #1e293b; background: #fff; }
  .sheet { padding: 20px 24px 28px; }

  /* Cabeçalho de marca */
  .brand { display: flex; align-items: center; justify-content: space-between; gap: 16px;
           background: ${NAVY}; color: #fff; border-radius: 10px; padding: 14px 20px; }
  .brand .logo { height: 46px; width: auto; display: block; background: #fff; border-radius: 8px; padding: 5px 8px; }
  .brand .center { text-align: center; flex: 1; }
  .brand h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: #fff; }
  .brand .sub { margin-top: 2px; font-size: 13px; font-weight: 600; color: ${GOLD}; letter-spacing: 1px; }
  .brand .right { text-align: right; min-width: 120px; font-size: 12px; color: #cbd5e1; }
  .brand .right b { color: #fff; font-size: 14px; }

  .meta { margin: 10px 2px 16px; font-size: 11.5px; color: #64748b; }

  /* Legenda de cores */
  .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0 0 14px; }
  .legend .item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #334155; }
  .legend .dot { width: 13px; height: 13px; border-radius: 4px; display: inline-block; }

  /* Tabelas genéricas */
  table { width: 100%; border-collapse: collapse; }
  .cal { table-layout: fixed; }
  .cal th { background: ${NAVY}; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 1px;
            text-transform: uppercase; padding: 8px 4px; border: 1px solid ${NAVY}; }
  .cal td { border: 1px solid #cbd5e1; vertical-align: top; height: 96px; padding: 5px 6px; }
  .cal td.out { background: #f1f5f9; }
  .daynum { font-size: 14px; font-weight: 800; color: ${NAVY}; margin-bottom: 4px; }
  .cal td.out .daynum { color: #94a3b8; }
  .today .daynum { background: ${NAVY}; color: #fff; width: 22px; height: 22px; border-radius: 50%;
                   display: inline-flex; align-items: center; justify-content: center; }
  .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #64748b; margin: 3px 0 2px; }
  .chips { display: flex; flex-wrap: wrap; gap: 3px; }
  .chip { display: inline-block; color: #fff; font-size: 10px; font-weight: 700; line-height: 1.2;
          border-radius: 4px; padding: 2px 6px; }
  .folga { font-size: 9.5px; color: #94a3b8; margin-top: 3px; line-height: 1.3; }

  /* Grade semanal / individual */
  .grid th { background: ${NAVY}; color: #fff; font-size: 11px; padding: 8px 6px; border: 1px solid ${NAVY}; }
  .grid td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 12px; }
  .grid tr:nth-child(even) td { background: #f8fafc; }
  .name-cell { font-weight: 700; color: ${NAVY}; }
  .work { background: #e9f9f0 !important; color: #047857; font-weight: 700; text-align: center; }
  .off  { color: #94a3b8; text-align: center; }
  .hours { text-align: right; font-variant-numeric: tabular-nums; }
  .shifts { color: #475569; font-variant-numeric: tabular-nums; }

  .footer { margin-top: 18px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }

  @media print { @page { margin: 8mm; size: A4 ${orientation}; } .sheet { padding: 0; } }
</style></head>
<body><div class="sheet">
  <div class="brand">
    <img class="logo" src="${LOGO_DATA_URI}" alt="Minas Farma" />
    <div class="center">
      <h1>${title}</h1>
      ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
    </div>
    <div class="right">Minas Farma<br><b>Canaã</b></div>
  </div>
  ${meta ? `<div class="meta">${meta}</div>` : ''}
  ${body}
  <div class="footer">Documento gerado pelo sistema Minas Farma · ${new Date().toLocaleString('pt-BR')}</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
}

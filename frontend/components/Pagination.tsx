import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    pages: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ page, pages, total, pageSize, onPageChange }) => {
    if (total === 0) return null;

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    // Janela de páginas (máx 5 botões)
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(pages, start + windowSize - 1);
    start = Math.max(1, Math.min(start, end - windowSize + 1));
    const nums: number[] = [];
    for (let i = start; i <= end; i++) nums.push(i);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-white">
            <span className="text-xs text-slate-500">
                Mostrando <b className="text-slate-700">{from}</b>–<b className="text-slate-700">{to}</b> de <b className="text-slate-700">{total}</b>
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Página anterior"
                >
                    <ChevronLeft size={16} />
                </button>
                {start > 1 && (
                    <>
                        <PageBtn n={1} active={page === 1} onClick={onPageChange} />
                        {start > 2 && <span className="px-1 text-slate-400">…</span>}
                    </>
                )}
                {nums.map(n => <PageBtn key={n} n={n} active={n === page} onClick={onPageChange} />)}
                {end < pages && (
                    <>
                        {end < pages - 1 && <span className="px-1 text-slate-400">…</span>}
                        <PageBtn n={pages} active={page === pages} onClick={onPageChange} />
                    </>
                )}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= pages}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Próxima página"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

const PageBtn: React.FC<{ n: number; active: boolean; onClick: (n: number) => void }> = ({ n, active, onClick }) => (
    <button
        onClick={() => onClick(n)}
        className={`min-w-[34px] h-[34px] px-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-[#0A1E35] text-[#D4C4A8]' : 'text-slate-600 hover:bg-slate-100'}`}
    >
        {n}
    </button>
);

export default Pagination;

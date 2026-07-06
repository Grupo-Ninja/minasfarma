import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, CheckCircle2, X, Info, XCircle } from 'lucide-react';

type ConfirmOptions = {
    title?: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
};

type ToastType = 'success' | 'error' | 'info';
type Toast = { id: number; type: ToastType; message: string };

interface FeedbackApi {
    confirm: (opts: ConfirmOptions) => Promise<boolean>;
    notify: (message: string, type?: ToastType) => void;
}

const FeedbackContext = createContext<FeedbackApi>({
    confirm: async () => false,
    notify: () => { },
});

export const useFeedback = () => useContext(FeedbackContext);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [confirmState, setConfirmState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idRef = useRef(1);

    const confirm = useCallback((opts: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => setConfirmState({ opts, resolve }));
    }, []);

    const close = (value: boolean) => {
        setConfirmState((cur) => { cur?.resolve(value); return null; });
    };

    const notify = useCallback((message: string, type: ToastType = 'success') => {
        const id = idRef.current++;
        setToasts((t) => [...t, { id, type, message }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
    }, []);

    const opts = confirmState?.opts;
    const danger = opts?.danger;

    return (
        <FeedbackContext.Provider value={{ confirm, notify }}>
            {children}

            {/* Modal de confirmação */}
            {opts && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={() => close(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 text-center">
                            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${danger ? 'bg-rose-100 text-rose-600' : 'bg-[#0A1E35]/10 text-[#0A1E35]'}`}>
                                {danger ? <AlertTriangle size={28} /> : <Info size={28} />}
                            </div>
                            {opts.title && <h3 className="text-lg font-bold text-[#0A1E35] mb-1">{opts.title}</h3>}
                            <p className="text-sm text-slate-500">{opts.message}</p>
                        </div>
                        <div className="flex gap-3 p-4 bg-slate-50 border-t border-slate-100">
                            <button onClick={() => close(false)}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-white transition-colors">
                                {opts.cancelText || 'Cancelar'}
                            </button>
                            <button onClick={() => close(true)}
                                className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-white transition-colors ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#0A1E35] hover:bg-[#162F4D] !text-[#D4C4A8]'}`}>
                                {opts.confirmText || 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[110] flex flex-col gap-2 pointer-events-none">
                {toasts.map((t) => {
                    const tone = t.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : t.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800'
                            : 'border-blue-200 bg-blue-50 text-blue-800';
                    const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? XCircle : Info;
                    return (
                        <div key={t.id} className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-fade-in ${tone}`}>
                            <Icon size={18} className="shrink-0" />
                            <span className="max-w-xs">{t.message}</span>
                            <button onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))} className="ml-1 opacity-60 hover:opacity-100">
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </FeedbackContext.Provider>
    );
};

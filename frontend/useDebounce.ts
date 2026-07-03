import { useState, useEffect } from 'react';

/** Retorna o valor após `delay` ms sem mudanças (evita disparar fetch a cada tecla). */
export function useDebounce<T>(value: T, delay = 400): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Snackbar, type SnackbarConfig } from '../components/Snackbar';

type SnackbarContextValue = {
  show: (config: SnackbarConfig) => void;
  hide: () => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SnackbarConfig | null>(null);

  const show = useCallback((next: SnackbarConfig) => {
    // Limpia y difiere al siguiente tick para que el componente remonte y re-anime la entrada.
    setConfig(null);
    setTimeout(() => setConfig(next), 0);
  }, []);

  const hide = useCallback(() => setConfig(null), []);

  return (
    <SnackbarContext.Provider value={{ show, hide }}>
      {children}
      <Snackbar config={config} onHide={hide} />
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}

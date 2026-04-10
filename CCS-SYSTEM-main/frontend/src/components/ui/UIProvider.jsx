import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../constants';
import { ModalShell } from './ModalShell';

const UIContext = createContext(null);

const toastStyles = {
  success: {
    icon: CheckCircle2,
    card: 'border-emerald-200 bg-emerald-50/90 text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  error: {
    icon: AlertTriangle,
    card: 'border-red-200 bg-red-50/90 text-red-900',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    icon: TriangleAlert,
    card: 'border-amber-200 bg-amber-50/90 text-amber-900',
    badge: 'bg-amber-100 text-amber-700',
  },
  info: {
    icon: Info,
    card: 'border-sky-200 bg-sky-50/90 text-sky-900',
    badge: 'bg-sky-100 text-sky-700',
  },
};

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const timeoutRefs = useRef(new Map());

  const dismissToast = (id) => {
    const timer = timeoutRefs.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timeoutRefs.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const showToast = (config) => {
    const payload =
      typeof config === 'string'
        ? { title: config, variant: 'info' }
        : {
            title: config?.title || 'Notice',
            description: config?.description || '',
            variant: config?.variant || 'info',
          };

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, ...payload }]);

    const timer = window.setTimeout(() => {
      dismissToast(id);
    }, 4200);
    timeoutRefs.current.set(id, timer);
  };

  const confirm = (config) =>
    new Promise((resolve) => {
      setConfirmState({
        title: config?.title || 'Confirm action',
        description: config?.description || 'Please confirm to continue.',
        confirmText: config?.confirmText || 'Continue',
        cancelText: config?.cancelText || 'Cancel',
        tone: config?.tone || 'default',
        resolve,
      });
    });

  const resolveConfirm = (result) => {
    if (confirmState?.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState(null);
  };

  const value = useMemo(
    () => ({
      showToast,
      confirm,
      showSuccess: (title, description) => showToast({ title, description, variant: 'success' }),
      showError: (title, description) => showToast({ title, description, variant: 'error' }),
      showInfo: (title, description) => showToast({ title, description, variant: 'info' }),
    }),
    [],
  );

  return (
    <UIContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const style = toastStyles[toast.variant] || toastStyles.info;
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto animate-in slide-in-from-top-4 rounded-3xl border px-4 py-4 shadow-lg backdrop-blur',
                style.card,
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('rounded-2xl p-2', style.badge)}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-sm opacity-80">{toast.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full p-1 opacity-50 transition-opacity hover:opacity-100"
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ModalShell
        open={Boolean(confirmState)}
        onClose={() => resolveConfirm(false)}
        title={confirmState?.title}
        description={confirmState?.description}
        size="max-w-lg"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => resolveConfirm(false)}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              {confirmState?.cancelText || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => resolveConfirm(true)}
              className={cn(
                'rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition-colors',
                confirmState?.tone === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700',
              )}
            >
              {confirmState?.confirmText || 'Continue'}
            </button>
          </div>
        }
      >
        <div className="rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
          This action affects your current data. Continue only if the details above are correct.
        </div>
      </ModalShell>
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}


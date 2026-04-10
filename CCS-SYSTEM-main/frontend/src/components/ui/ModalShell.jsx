import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../constants';

export function ModalShell({
  open = true,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'max-w-3xl',
  panelClassName = '',
  bodyClassName = '',
  closeLabel = 'Close modal',
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]',
          size,
          panelClassName,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
            <div>
              {title ? <h2 className="text-xl font-bold text-slate-900">{title}</h2> : null}
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 p-2 text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
                aria-label={closeLabel}
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        )}

        <div className={cn('max-h-[78vh] overflow-y-auto px-6 py-5 sm:px-8', bodyClassName)}>
          {children}
        </div>

        {footer ? <div className="border-t border-slate-100 px-6 py-5 sm:px-8">{footer}</div> : null}
      </div>
    </div>
  );
}


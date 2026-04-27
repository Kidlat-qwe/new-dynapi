import { useEffect, useRef, useState } from 'react';

const EVENT_NAME = 'funtalk:confirm';

function normalizeMessage(input) {
  if (input == null) return '';
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

/**
 * Global confirm modal that replaces the browser confirm dialog.
 * Usage:
 *   const ok = await window.appConfirm("Are you sure?");
 */
export default function GlobalConfirm() {
  const [active, setActive] = useState(null);
  const resolverRef = useRef(null);
  const cancelBtnRef = useRef(null);

  const resolve = (value) => {
    try {
      resolverRef.current?.(value);
    } finally {
      resolverRef.current = null;
      setActive(null);
    }
  };

  useEffect(() => {
    const onEvent = (e) => {
      const msg = normalizeMessage(e?.detail?.message);
      if (!msg) return;
      if (active) return; // simple: one confirm at a time
      resolverRef.current = e?.detail?.resolve;
      setActive({
        message: msg,
        confirmText: e?.detail?.confirmText || 'OK',
        cancelText: e?.detail?.cancelText || 'Cancel',
      });
    };
    window.addEventListener(EVENT_NAME, onEvent);
    return () => window.removeEventListener(EVENT_NAME, onEvent);
  }, [active]);

  useEffect(() => {
    const fn = (message, opts = {}) =>
      new Promise((resolvePromise) => {
        window.dispatchEvent(
          new CustomEvent(EVENT_NAME, {
            detail: {
              message,
              resolve: resolvePromise,
              confirmText: opts.confirmText,
              cancelText: opts.cancelText,
            },
          })
        );
      });
    window.appConfirm = fn;
  }, []);

  useEffect(() => {
    if (!active) return;
    cancelBtnRef.current?.focus?.();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') resolve(false);
      if (e.key === 'Enter') resolve(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[20000] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="presentation"
      onClick={() => resolve(false)}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-confirm-title"
        aria-describedby="global-confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200">
          <p id="global-confirm-title" className="text-sm font-semibold text-gray-900">
            Confirm
          </p>
        </div>

        <div className="px-5 py-4">
          <p id="global-confirm-message" className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {active.message}
          </p>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onClick={() => resolve(false)}
          >
            {active.cancelText}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onClick={() => resolve(true)}
          >
            {active.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}


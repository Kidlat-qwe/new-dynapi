import { useEffect, useMemo, useRef, useState } from 'react';

const EVENT_NAME = 'funtalk:alert';

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
 * Global alert modal that replaces the browser alert dialog.
 * - Any `window.alert(message)` will open this modal.
 * - Also exposes `window.appAlert(message)` for explicit usage.
 */
export default function GlobalAlert() {
  const [queue, setQueue] = useState([]);
  const active = queue[0] || null;
  const okBtnRef = useRef(null);

  const title = useMemo(() => {
    // Keep it professional and minimal; no per-alert title changes needed for now.
    return 'Notice';
  }, []);

  const close = () => {
    setQueue((q) => q.slice(1));
  };

  useEffect(() => {
    const onEvent = (e) => {
      const msg = normalizeMessage(e?.detail?.message);
      if (!msg) return;
      setQueue((q) => [...q, { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, message: msg }]);
    };

    window.addEventListener(EVENT_NAME, onEvent);
    return () => window.removeEventListener(EVENT_NAME, onEvent);
  }, []);

  useEffect(() => {
    // Replace native alert with our modal dispatcher.
    const original = window.alert;
    const dispatch = (message) => {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { message } }));
    };

    window.appAlert = dispatch;
    window.alert = dispatch;

    return () => {
      window.alert = original;
      // leave appAlert in place; safe no-op if someone used it
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    // Focus OK for keyboard users.
    okBtnRef.current?.focus?.();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[20000] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="presentation"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="global-alert-title"
        aria-describedby="global-alert-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200">
          <p id="global-alert-title" className="text-sm font-semibold text-gray-900">
            {title}
          </p>
        </div>

        <div className="px-5 py-4">
          <p id="global-alert-message" className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {active.message}
          </p>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            ref={okBtnRef}
            type="button"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onClick={close}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}


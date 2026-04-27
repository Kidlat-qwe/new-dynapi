import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';

function useIsMobile(maxWidthPx = 1023) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const sync = () => setIsMobile(Boolean(mq.matches));
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, [maxWidthPx]);

  return isMobile;
}

function extractOptions(children) {
  const opts = [];
  const visit = (node, groupLabel = '') => {
    Children.forEach(node, (child) => {
      if (!child) return;
      if (!isValidElement(child)) return;

      if (child.type === 'option') {
        opts.push({
          value: child.props?.value ?? '',
          label: `${groupLabel ? `${groupLabel} — ` : ''}${String(child.props?.children ?? '').trim()}`,
          disabled: Boolean(child.props?.disabled),
        });
        return;
      }

      if (child.type === 'optgroup') {
        const nextGroup = String(child.props?.label ?? '').trim();
        visit(child.props?.children, nextGroup);
        return;
      }

      // Support fragments/conditional wrappers by recursing into children.
      if (child.props?.children) {
        visit(child.props.children, groupLabel);
      }
    });
  };

  visit(children);
  return opts;
}

export default function ResponsiveSelect({
  id,
  name,
  value,
  onChange,
  disabled,
  className = '',
  children,
  'aria-label': ariaLabel,
  ...rest
}) {
  const isMobile = useIsMobile(1023);
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [popover, setPopover] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });

  const options = useMemo(() => extractOptions(children), [children]);
  const selected = useMemo(() => {
    const v = value ?? '';
    return options.find((o) => String(o.value) === String(v)) || options[0] || null;
  }, [options, value]);

  const fireChange = (nextValue) => {
    if (typeof onChange === 'function') {
      onChange({ target: { value: nextValue, name, id } });
    }
  };

  const close = () => setOpen(false);

  const openPopover = () => {
    if (!isMobile) return;
    const el = btnRef.current;
    if (!el) {
      setOpen(true);
      return;
    }
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const viewportH = window.innerHeight || 0;
    const maxH = Math.max(160, Math.min(360, viewportH - rect.bottom - gap - 12));
    setPopover({
      top: rect.bottom + gap,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      maxHeight: maxH,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!isMobile || !open) return undefined;
    const onResizeOrScroll = () => openPopover();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, open]);

  // Desktop: keep native select unchanged.
  if (!isMobile) {
    return (
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={className}
        aria-label={ariaLabel}
        {...rest}
      >
        {children}
      </select>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
        disabled={disabled}
        onClick={() => openPopover()}
        className={`${className} flex items-center justify-between gap-3`}
      >
        <span className="truncate">{selected?.label || 'Select…'}</span>
        <svg className="h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* click-catcher (no dim) */}
          <button
            type="button"
            className="fixed inset-0 z-[20040] bg-transparent"
            aria-label="Close dropdown"
            onClick={close}
          />

          <div
            className="fixed z-[20050] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
            style={{
              top: `${popover.top}px`,
              left: `${popover.left}px`,
              width: `${popover.width}px`,
              maxHeight: `${popover.maxHeight}px`,
            }}
            role="listbox"
            aria-label={ariaLabel || 'Select'}
          >
            <div className="max-h-full overflow-y-auto">
              <ul className="divide-y divide-gray-100">
                {options.map((o) => {
                  const isSelected = String(o.value) === String(value ?? '');
                  return (
                    <li key={`${o.value}-${o.label}`}>
                      <button
                        type="button"
                        disabled={o.disabled}
                        onClick={() => {
                          fireChange(o.value);
                          close();
                        }}
                        className={`w-full px-4 py-3 text-left text-sm flex items-center justify-between gap-3 ${
                          isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span className="min-w-0 truncate text-gray-900">{o.label}</span>
                        {isSelected && (
                          <svg className="h-5 w-5 text-primary-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}
    </>
  );
}


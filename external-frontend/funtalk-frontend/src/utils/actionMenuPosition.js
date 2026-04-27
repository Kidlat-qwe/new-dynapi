/**
 * Compute a `position: fixed` menu position from a trigger's DOMRect.
 * Returns `{ top, right }` for inline style usage.
 *
 * Notes:
 * - DOMRect from getBoundingClientRect() is already viewport-relative.
 * - We clamp horizontally so menus stay within the viewport.
 * - We flip vertically if there isn't enough space below.
 */
export function computeFixedActionMenuPosition({
  rect,
  menuWidth = 192,
  menuHeight = 220,
  gap = 6,
  padding = 8,
}) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

  // Right-based alignment (menu's right edge aligns to trigger right edge by default)
  const preferredRight = vw - rect.right;
  const maxRight = Math.max(padding, vw - menuWidth - padding);
  const right = Math.max(padding, Math.min(preferredRight, maxRight));

  let top = rect.bottom + gap;
  const maxBottom = vh - padding;
  if (top + menuHeight > maxBottom) {
    top = rect.top - gap - menuHeight;
  }
  top = Math.max(padding, Math.min(top, Math.max(padding, vh - menuHeight - padding)));

  return { top, right };
}


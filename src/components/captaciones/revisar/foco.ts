const FOCUSABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab y Shift+Tab no salen del contenedor (diálogos modales). */
export function atraparFoco(e: KeyboardEvent, contenedor: HTMLElement) {
  if (e.key !== 'Tab') return;
  const items = Array.from(contenedor.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0
  );
  if (items.length === 0) {
    e.preventDefault();
    contenedor.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const activo = document.activeElement;
  if (e.shiftKey && (activo === first || !contenedor.contains(activo))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (activo === last || !contenedor.contains(activo))) {
    e.preventDefault();
    first.focus();
  }
}

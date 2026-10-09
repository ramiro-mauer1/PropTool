"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BottomNavItem {
  href: string;
  /** Nombre completo: es el aria-label (contiene al corto, WCAG 2.5.3). */
  label: string;
  /** Lo que se lee dentro de la píldora cuando el ítem está activo. */
  shortLabel: string;
  icon: LucideIcon;
  /** Pendientes de la sección (fotos en el lote, en la cola…). */
  count?: number;
}

interface BottomNavBarProps {
  items: readonly BottomNavItem[];
  /** Último ítem: no es una ruta, abre la hoja de la cuenta. */
  account: {
    icon: ReactNode;
    expanded: boolean;
    controls: string;
    onOpen: () => void;
  };
  className?: string;
}

const PILL_SPRING: Transition = { type: "spring", stiffness: 380, damping: 32 };
const INSTANT: Transition = { duration: 0 };

function isActive(href: string, pathname: string | null) {
  return !!pathname && (pathname === href || pathname.startsWith(`${href}/`));
}

/**
 * Navegación principal en celular (< md). La sección activa sale de la URL y
 * se marca con una píldora lima que se estira hasta el ancho de su nombre.
 * Se monta en el layout compartido, así la entrada se anima una sola vez y la
 * píldora viaja entre ítems en lugar de reaparecer en cada página.
 */
export function BottomNavBar({ items, account, className }: BottomNavBarProps) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <motion.nav
      data-bottom-nav
      aria-label="Navegación principal"
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={cn(
        "md:hidden fixed inset-x-0 mx-auto z-40 w-fit max-w-[calc(100vw-1.5rem)]",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
        "h-14 flex items-center gap-1 p-1.5 rounded-full",
        "bg-[#0f1115]/95 backdrop-blur-md border border-white/[0.08] shadow-2xl shadow-black/60 ring-1 ring-white/5",
        className,
      )}
    >
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        const Icon = item.icon;
        const pending = (item.count ?? 0) > 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={pending ? `${item.label} (${item.count})` : item.label}
            className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#d4ff32]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1115]"
          >
            <motion.span
              whileTap={reduce ? undefined : { scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "relative flex items-center h-11 min-w-11 justify-center rounded-full transition-colors duration-200",
                active ? "pl-3 pr-3.5 text-[#08090a]" : "px-3 text-[#8f96a3] hover:text-white",
              )}
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  transition={reduce ? INSTANT : PILL_SPRING}
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[#d4ff32] shadow-[0_4px_16px_rgba(212,255,50,0.25)]"
                />
              )}

              <span className="relative">
                <Icon aria-hidden className="w-5 h-5" strokeWidth={active ? 2.25 : 2} />
                {pending && !active && (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#d4ff32] ring-2 ring-[#0f1115]"
                  />
                )}
              </span>

              {/* El ancho va a "auto": la píldora mide lo que mide la palabra,
                  sin cortar "Captaciones" ni dejar aire en "Fotos". */}
              <motion.span
                aria-hidden
                initial={false}
                animate={{
                  width: active ? "auto" : 0,
                  opacity: active ? 1 : 0,
                  marginLeft: active ? 6 : 0,
                }}
                transition={
                  reduce
                    ? INSTANT
                    : { width: PILL_SPRING, marginLeft: PILL_SPRING, opacity: { duration: 0.18 } }
                }
                className="relative overflow-hidden whitespace-nowrap text-[13px] font-semibold leading-none"
              >
                {item.shortLabel}
              </motion.span>
            </motion.span>
          </Link>
        );
      })}

      <motion.button
        type="button"
        onClick={account.onOpen}
        aria-label="Cuenta"
        aria-haspopup="dialog"
        aria-expanded={account.expanded}
        aria-controls={account.controls}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "shrink-0 flex items-center justify-center h-11 w-11 rounded-full transition-colors duration-200 outline-none",
          "focus-visible:ring-2 focus-visible:ring-[#d4ff32]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1115]",
          account.expanded ? "bg-white/[0.08]" : "hover:bg-white/[0.05]",
        )}
      >
        {account.icon}
      </motion.button>
    </motion.nav>
  );
}

export default BottomNavBar;

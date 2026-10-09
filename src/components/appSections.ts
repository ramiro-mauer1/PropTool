import { Maximize2, Radar, Users, Wand2, type LucideIcon } from 'lucide-react';
import type { StartModule } from '@/lib/userPreferences';

/**
 * Secciones de la app, en el orden del menú. Cada una es una ruta real: la
 * sección activa sale de la URL, así que recargar o entrar directo a un
 * enlace marca la correcta en la barra lateral y en la barra inferior.
 */
export interface AppSection {
  module: StartModule;
  href: string;
  /** Nombre completo (barra lateral, lectores de pantalla). */
  label: string;
  /** Nombre corto para la píldora de la barra inferior en celular. */
  shortLabel: string;
  icon: LucideIcon;
}

export const APP_SECTIONS: readonly AppSection[] = [
  { module: 'captaciones', href: '/captaciones', label: 'Captaciones', shortLabel: 'Captaciones', icon: Radar },
  { module: 'crm', href: '/cartera', label: 'Cartera Inteligente', shortLabel: 'Cartera', icon: Users },
  { module: 'inpainting', href: '/limpieza', label: 'Limpieza Inteligente', shortLabel: 'Limpieza', icon: Wand2 },
  { module: 'enhance', href: '/fotos', label: 'Mejora de Fotos', shortLabel: 'Fotos', icon: Maximize2 },
];

const DEFAULT_SECTION = APP_SECTIONS[2]; // Limpieza Inteligente, como antes de las rutas

export function isSectionActive(section: AppSection, pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

/** Ruta del módulo de inicio que eligió el agente (o la de siempre). */
export function startHref(module: StartModule | null | undefined): string {
  return (APP_SECTIONS.find((s) => s.module === module) ?? DEFAULT_SECTION).href;
}

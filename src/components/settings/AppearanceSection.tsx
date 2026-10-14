'use client';

import { Monitor, Moon, PlayCircle, Sun } from 'lucide-react';
import { REPLAY_WELCOME_EVENT } from '@/components/auth/WelcomeFlow';
import { useDeviceSettings, type ThemePreference } from '@/lib/settings';
import { SectionHeader, Segmented, secondaryButtonClass } from './ui';

export function AppearanceSection() {
  const { settings, update } = useDeviceSettings();

  return (
    <div className="space-y-4">
      <SectionHeader title="Tema" description="Se guarda en este dispositivo." />
      <Segmented<ThemePreference>
        label="Tema"
        value={settings.theme}
        onChange={(theme) => update({ theme })}
        options={[
          { value: 'light', label: 'Claro', icon: <Sun className="w-3.5 h-3.5" /> },
          { value: 'dark', label: 'Oscuro', icon: <Moon className="w-3.5 h-3.5" /> },
          { value: 'system', label: 'Sistema', icon: <Monitor className="w-3.5 h-3.5" /> },
        ]}
      />

      <div className="pt-2 space-y-3">
        <SectionHeader title="Bienvenida" description="El recorrido corto por lo que hace Plinth." />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(REPLAY_WELCOME_EVENT))}
          className={secondaryButtonClass}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          Ver la bienvenida de nuevo
        </button>
      </div>
    </div>
  );
}

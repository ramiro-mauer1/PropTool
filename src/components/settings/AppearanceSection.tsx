'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useDeviceSettings, type ThemePreference } from '@/lib/settings';
import { SectionHeader, Segmented } from './ui';

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
    </div>
  );
}

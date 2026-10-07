'use client';

import { useDeviceSettings, type ExportFormat } from '@/lib/settings';
import { Field, SectionHeader, Segmented } from './ui';

const FORMAT_HINT: Record<ExportFormat, string> = {
  png: 'Sin pérdida de calidad. Archivos más pesados.',
  jpeg: 'Compatible con todos los portales. Archivos livianos.',
  webp: 'Lo más liviano con buena calidad. Algunos portales no lo aceptan.',
};

export function ExportSection() {
  const { settings, update } = useDeviceSettings();
  const lossy = settings.exportFormat !== 'png';

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Exportación"
        description="Formato con el que se descargan las fotos limpias y mejoradas (individuales y ZIP)."
      />
      <Field label="Formato" hint={FORMAT_HINT[settings.exportFormat]}>
        <Segmented<ExportFormat>
          label="Formato de exportación"
          value={settings.exportFormat}
          onChange={(exportFormat) => update({ exportFormat })}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPG' },
            { value: 'webp', label: 'WebP' },
          ]}
        />
      </Field>

      {lossy && (
        <Field label={`Calidad · ${Math.round(settings.exportQuality * 100)}%`} hint="Entre 85% y 95% la diferencia es casi invisible.">
          <input
            type="range"
            min={50}
            max={100}
            step={1}
            value={Math.round(settings.exportQuality * 100)}
            onChange={(e) => update({ exportQuality: Number(e.target.value) / 100 })}
            className="w-full accent-accent"
          />
        </Field>
      )}
    </div>
  );
}

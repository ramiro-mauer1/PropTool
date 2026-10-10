import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CaptacionDTO } from '@/types/captaciones';
import { CaptacionCard } from './CaptacionCard';

const base: CaptacionDTO = {
  id: 'cap-1',
  clave: 'zonaprop:1',
  portal: 'zonaprop',
  url: 'https://www.zonaprop.com.ar/propiedades/1.html',
  operacion: 'venta',
  tipo: 'casa',
  precio: 120000,
  moneda: 'USD',
  m2Cubiertos: 90,
  m2Total: 300,
  ambientes: 4,
  direccion: null,
  localidad: 'Castelar',
  partido: 'Morón',
  anunciante: 'Claudia',
  telefono: null,
  tieneWhatsappEnPortal: false,
  fotoUrl: null,
  score: 42,
  motivo: '60 días publicado (+8)',
  senales: [],
  barrioPrivado: false,
  problemasAviso: [],
  borradorMensaje: null,
  diasPublicado: 60,
  visitas: null,
  fechaPublicacion: null,
  senalesFuertes: [],
  rechazaInmobiliarias: null,
  abiertoACorredores: null,
  republicado: null,
  otrosPortales: [],
  estado: 'nuevo',
  notas: null,
  estadoActualizadoEn: '2026-10-05T12:00:00.000Z',
  telefonoAdquiridoEn: null,
  telefonoIntentadoEn: null,
  primeraVezVista: '2026-10-05T12:00:00.000Z',
  ultimaVezVista: '2026-10-05T12:00:00.000Z',
  contactId: null,
  propertyId: null,
};

function render(c: Partial<CaptacionDTO>) {
  return renderToStaticMarkup(
    <CaptacionCard
      captacion={{ ...base, ...c }}
      agentName="Ramita"
      comprando={false}
      onCambiarEstado={() => {}}
      onAdquirirTelefono={async () => ({ ok: true, telefono: null, motivo: null })}
      contactoAbiertoInicial
    />
  );
}

// Server-rendered with "Contactar" open, so the contact block is in the markup.
// ("Por qué tiene N puntos" stays collapsed, so the quote is checked through
// the shared helpers in motivo.test.ts.)
describe('CaptacionCard', () => {
  it('sin intento de compra ofrece "Adquirir teléfono"', () => {
    expect(render({})).toContain('Adquirir teléfono');
  });

  it('compra sin número: aviso fijo, alternativa por el aviso y sin botón de compra', () => {
    const html = render({ telefonoIntentadoEn: '2026-10-08T15:00:00.000Z' });
    expect(html).toContain('Pediste el teléfono el 8 de octubre y Zonaprop no lo tenía. Se cobró menos de USD 0,01.');
    expect(html).toContain('Ver aviso');
    expect(html).not.toContain('WhatsApp desde el aviso');
    expect(html).not.toContain('Adquirir teléfono');
  });

  it('compra sin número con WhatsApp en el portal: ofrece "WhatsApp desde el aviso"', () => {
    const html = render({ telefonoIntentadoEn: '2026-10-08T15:00:00.000Z', tieneWhatsappEnPortal: true });
    expect(html).toContain('WhatsApp desde el aviso');
    expect(html).not.toContain('Adquirir teléfono');
    // No duplica el botón de WhatsApp del aviso arriba.
    expect(html).not.toContain('WhatsApp en el aviso');
  });

  it('muestra las etiquetas discretas y el aviso de precio a revisar', () => {
    const html = render({
      rechazaInmobiliarias: true,
      abiertoACorredores: true,
      motivo: '60 días publicado (+8); precio mal cargado en el portal (revisar)',
    });
    expect(html).toContain('Pidió no contactar inmobiliarias');
    expect(html).toContain('Acepta corredores');
    expect(html).toContain('aria-label="Precio posiblemente mal cargado en el portal"');
    expect(render({})).not.toContain('Precio posiblemente mal cargado');
  });
});

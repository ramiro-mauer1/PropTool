import { describe, expect, it } from 'vitest';
import { elegirAngulos, nombreDelDueno, pideSinInmobiliarias, type DatosAviso } from './angulos';
import { asegurarFirma, plantilla, validarMensaje, type Agente } from './redactar';

const base: DatosAviso = {
  operacion: 'venta',
  tipo: 'casa',
  localidad: 'Morón',
  motivo: '',
  senales: [],
  problemasAviso: [],
  diasPublicado: 20,
  barrioPrivado: false,
  descripcion: null,
};

const vos: Agente = { nombre: 'Ramita Miranda', tono: 'cercano' };
const usted: Agente = { nombre: 'Ramita Miranda', tono: 'formal' };

describe('elegirAngulos', () => {
  it('prioriza las señales del dueño y el precio por encima de comparables', () => {
    const ids = elegirAngulos({
      ...base,
      motivo: '258 días publicado (+19); precio/m² 63% sobre similares de su barrio (+14); solo 0.6 visitas/día (+13)',
      senales: ['Escucho ofertas'],
    }).map((a) => a.id);
    expect(ids.slice(0, 3)).toEqual(['senal', 'precio', 'visibilidad']);
    expect(ids.at(-1)).toBe('mercado');
  });

  it('usa el porcentaje real del motivo, sin inventar', () => {
    const precio = elegirAngulos({ ...base, motivo: 'precio/m² 84% sobre similares de su barrio (+14)' }).find((a) => a.id === 'precio');
    expect(precio?.hecho).toContain('84%');
  });

  it('no usa el ángulo de precio en alquileres ni con diferencias chicas', () => {
    expect(elegirAngulos({ ...base, motivo: 'precio/m² 11% sobre similares de su partido (+5)' }).map((a) => a.id)).not.toContain('precio');
    const alquiler = elegirAngulos({ ...base, operacion: 'alquiler', motivo: 'precio/m² 40% sobre similares de su partido (+5)' });
    expect(alquiler.map((a) => a.id)).toEqual(expect.arrayContaining(['alquiler']));
    expect(alquiler.map((a) => a.id)).not.toContain('precio');
  });

  it('detecta avisos recién publicados y con fotos flojas', () => {
    const ids = elegirAngulos({ ...base, diasPublicado: 1, problemasAviso: ['pocas fotos'] }).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['presentacion', 'recien']));
  });
});

describe('nombreDelDueno', () => {
  it('toma el primer nombre de una persona', () => {
    expect(nombreDelDueno('CLAUDIA gomez')).toBe('Claudia');
  });
  it('descarta anunciantes que no son personas', () => {
    expect(nombreDelDueno('Dueño directo')).toBeNull();
    expect(nombreDelDueno('Inmobiliaria Sur SRL')).toBeNull();
    expect(nombreDelDueno(null)).toBeNull();
  });
});

describe('pideSinInmobiliarias', () => {
  it('detecta el pedido explícito del dueño', () => {
    expect(pideSinInmobiliarias('Hermosa casa. ABSTENERSE INMOBILIARIAS.')).toBe(true);
    expect(pideSinInmobiliarias('Casa con pileta, apto crédito')).toBe(false);
  });
});

describe('validarMensaje', () => {
  const ok =
    'Hola Claudia. Vi el aviso de tu casa en Las Cabañas, la de la pileta y el parque. Comparando con avisos parecidos, el precio por m² quedó un poco arriba del promedio. Te puedo pasar sin cargo un comparativo de lo que se vendió en la zona. ¿Te sirve que te lo mande? Ramita.';

  it('acepta un mensaje que cumple las reglas', () => {
    expect(validarMensaje(ok, vos)).toBeNull();
  });
  it('rechaza más de una pregunta, aperturas de vendedor y compradores inventados', () => {
    expect(validarMensaje(`¿Cómo estás? ${ok}`, vos)).toMatch(/pregunta/);
    expect(validarMensaje(ok.replace('Hola Claudia.', 'Hola, soy corredor inmobiliario.'), vos)).toMatch(/prohibida/);
    expect(validarMensaje(ok.replace('Te puedo pasar', 'Tengo un comprador y te puedo pasar'), vos)).toMatch(/prohibida/);
    expect(validarMensaje(`${ok} {nombre_broker}`, vos)).toMatch(/prohibida/);
  });
  it('rechaza prometer trabajo como ya hecho o atribuirse credenciales', () => {
    expect(validarMensaje(ok.replace('Te puedo pasar', 'Te armé'), vos)).toMatch(/prohibida/);
    expect(validarMensaje(ok.replace('Te puedo pasar sin cargo', 'Justo edité una foto y te paso'), vos)).toMatch(/prohibida/);
    expect(validarMensaje(ok.replace('Hola Claudia.', 'Hola Claudia, como especialista en la zona.'), vos)).toMatch(/prohibida/);
  });
  it('rechaza demanda inventada', () => {
    expect(validarMensaje(ok.replace('Comparando con avisos parecidos', 'Muchos compradores consultan hoy por la zona y comparando con avisos parecidos'), vos)).toMatch(/prohibida/);
  });
  it('rechaza datos de mercado que no tenemos (cierres, escrituras)', () => {
    expect(validarMensaje(ok.replace('del promedio', 'de lo que se está escriturando'), vos)).toMatch(/prohibida/);
    expect(validarMensaje(ok.replace('Comparando con avisos parecidos', 'Saqué cuentas con valores reales de cierre'), vos)).toMatch(/prohibida/);
  });
  it('rechaza mezclar el trato elegido', () => {
    expect(validarMensaje(ok, usted)).toMatch(/tono/);
    expect(validarMensaje('Buenas tardes, Claudia. Vi el aviso de su casa en Morón y mirá, el precio por m² quedó arriba de lo que se vende en la zona. Puedo enviarle sin cargo un comparativo. ¿Le sirve que se lo envíe? Saludos, Ramita.', usted)).toMatch(/tono/);
  });
});

describe('plantilla', () => {
  it('toda plantilla de respaldo cumple las mismas reglas que la IA, en ambos tonos', () => {
    const datos: DatosAviso = {
      ...base,
      motivo: '258 días publicado (+19); precio/m² 63% sobre similares de su barrio (+14); solo 0.6 visitas/día (+13)',
      senales: ['Escucho ofertas'],
      problemasAviso: ['pocas fotos'],
    };
    for (const d of [datos, { ...datos, operacion: 'alquiler', diasPublicado: 2 }]) {
      for (const angulo of elegirAngulos(d)) {
        for (const agente of [vos, usted, { nombre: null, tono: 'cercano' as const }]) {
          for (const dueno of ['Claudia', null]) {
            const msg = plantilla(angulo, d, dueno, agente);
            expect(validarMensaje(msg, agente), `${angulo.id}/${agente.tono}: ${msg}`).toBeNull();
          }
        }
      }
    }
  });
});

describe('asegurarFirma', () => {
  it('agrega la firma si falta y junta los saltos de línea', () => {
    expect(asegurarFirma('Hola Nicolas. ¿Te sirve?', vos)).toBe('Hola Nicolas. ¿Te sirve? Ramita.');
    expect(asegurarFirma('Hola. ¿Te sirve?\n\nRamita Miranda', vos)).toBe('Hola. ¿Te sirve? Ramita Miranda');
    expect(asegurarFirma('Buenas tardes. ¿Le sirve?', usted)).toBe('Buenas tardes. ¿Le sirve? Saludos, Ramita Miranda.');
  });
});

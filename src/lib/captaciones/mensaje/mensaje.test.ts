import { describe, expect, it } from 'vitest';
import { anguloPrecioSeguimiento, elegirAngulos, nombreDelDueno, pideSinInmobiliarias, type DatosAviso } from './angulos';
import { asegurarFirma, normalizarCitasEnTexto, plantilla, validarMensaje, type Agente } from './redactar';

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
  it('prioriza las señales del dueño y nunca usa el precio en el primer mensaje', () => {
    const ids = elegirAngulos({
      ...base,
      motivo: '258 días publicado (+19); precio/m² 63% sobre similares de su barrio (+14); solo 0.6 visitas/día (+13)',
      senales: ['Escucho ofertas'],
    }).map((a) => a.id);
    expect(ids.slice(0, 2)).toEqual(['senal', 'visibilidad']);
    expect(ids).not.toContain('precio');
    expect(ids.at(-1)).toBe('mercado');
  });

  it('el ángulo de precio queda solo para el seguimiento, con el porcentaje real', () => {
    const d = { ...base, motivo: 'precio/m² 84% sobre similares de su barrio (+14)' };
    expect(elegirAngulos(d).map((a) => a.id)).not.toContain('precio');
    expect(anguloPrecioSeguimiento(d)?.hecho).toContain('84%');
    expect(anguloPrecioSeguimiento({ ...base, motivo: 'precio/m² 11% sobre similares de su partido (+5)' })).toBeNull();
    expect(anguloPrecioSeguimiento({ ...d, operacion: 'alquiler' })).toBeNull();
  });

  it('cita primero la señal fuerte, textual', () => {
    const [primero] = elegirAngulos({ ...base, senales: ['Escucho ofertas'], senalesFuertes: ['PRIMERA OFERTA URGENTE POR VIAJE'] });
    expect(primero.id).toBe('senal');
    expect(primero.hecho).toContain('"Primera oferta urgente por viaje"');
    expect(primero.frase).toContain('"Primera oferta urgente por viaje"');
  });

  it('respeta las citas que no vienen en mayúsculas', () => {
    const [primero] = elegirAngulos({ ...base, senalesFuertes: ['Venta por viaje'] });
    expect(primero.frase).toContain('"Venta por viaje"');
  });

  it('no usa visibilidad en avisos que pueden estar desactualizados', () => {
    const motivo = '296 días publicado (puede estar desactualizado) (+12); solo 0.4 visitas/día (+8); paga aviso destacado (+5)';
    expect(elegirAngulos({ ...base, motivo, diasPublicado: 296 }).map((a) => a.id)).not.toContain('visibilidad');
    expect(elegirAngulos({ ...base, motivo: motivo.replace(' (puede estar desactualizado)', ''), diasPublicado: 296 }).map((a) => a.id)).toContain(
      'visibilidad'
    );
  });

  it('si acepta corredores, ese ángulo va primero y ofrece trabajar sin exclusividad', () => {
    const angulos = elegirAngulos({ ...base, abiertoACorredores: true, senalesFuertes: ['Venta por viaje'] });
    expect(angulos.map((a) => a.id).slice(0, 2)).toEqual(['corredores', 'senal']);
    expect(angulos[0].oferta).toMatch(/en conjunto, sin exclusividad/);
  });

  it('no usa el ángulo de precio en alquileres', () => {
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
  it('usa el dato del buscador aunque la descripción no lo diga', () => {
    expect(pideSinInmobiliarias('Casa con pileta', true)).toBe(true);
    expect(pideSinInmobiliarias(null, false)).toBe(false);
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
  it('deja citar frases textuales del dueño aunque digan "urgente"', () => {
    const msg = 'Hola Claudia. Vi el aviso de tu casa en Morón. Me llamó la atención que dice "venta urgente". Te puedo pasar sin cargo un resumen de qué se publicó parecido en la zona. ¿Te sirve que te lo mande? Ramita.';
    expect(validarMensaje(msg, vos)).toMatch(/prohibida/);
    expect(validarMensaje(msg, vos, { citas: ['VENTA URGENTE'] })).toBeNull();
  });
  it('si el dueño rechaza inmobiliarias, exige reconocerlo y prohíbe pedir exclusividad', () => {
    expect(validarMensaje(ok, vos, { rechazaInmobiliarias: true })).toMatch(/inmobiliarias/);
    expect(validarMensaje(ok.replace('Te puedo pasar', 'Firmemos la exclusividad y te paso'), vos)).toMatch(/prohibida/);
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
    const variantes: DatosAviso[] = [
      datos,
      { ...datos, operacion: 'alquiler', diasPublicado: 2 },
      { ...datos, senalesFuertes: ['PRIMERA OFERTA URGENTE POR VIAJE'], abiertoACorredores: true },
      { ...datos, rechazaInmobiliarias: true, senalesFuertes: ['VENTA URGENTE'] },
    ];
    for (const d of variantes) {
      const reglas = { citas: [...(d.senalesFuertes ?? []), ...d.senales], rechazaInmobiliarias: !!d.rechazaInmobiliarias };
      for (const angulo of elegirAngulos(d)) {
        for (const agente of [vos, usted, { nombre: null, tono: 'cercano' as const }]) {
          for (const dueno of ['Claudia', null]) {
            const msg = plantilla(angulo, d, dueno, agente);
            expect(validarMensaje(msg, agente, reglas), `${angulo.id}/${agente.tono}: ${msg}`).toBeNull();
          }
        }
      }
    }
  });
});

describe('plantilla con rechazo a inmobiliarias', () => {
  it('lo reconoce con respeto y no pide exclusividad', () => {
    const d: DatosAviso = { ...base, rechazaInmobiliarias: true };
    for (const agente of [vos, usted]) {
      const msg = plantilla(elegirAngulos(d)[0], d, 'Claudia', agente);
      expect(msg).toMatch(/(pidió|pediste) no recibir mensajes de inmobiliarias/);
      expect(msg).toMatch(/sin pedir(te|le) exclusividad/);
    }
  });
});

describe('normalizarCitasEnTexto', () => {
  it('baja las mayúsculas de una cita que la IA copió tal cual', () => {
    expect(normalizarCitasEnTexto('Vi que dice "VENTA URGENTE" en el aviso.', ['VENTA URGENTE', 'Escucho ofertas'])).toBe(
      'Vi que dice "Venta urgente" en el aviso.'
    );
  });
});

describe('asegurarFirma', () => {
  it('agrega la firma si falta y junta los saltos de línea', () => {
    expect(asegurarFirma('Hola Nicolas. ¿Te sirve?', vos)).toBe('Hola Nicolas. ¿Te sirve? Ramita.');
    expect(asegurarFirma('Hola. ¿Te sirve?\n\nRamita Miranda', vos)).toBe('Hola. ¿Te sirve? Ramita Miranda');
    expect(asegurarFirma('Buenas tardes. ¿Le sirve?', usted)).toBe('Buenas tardes. ¿Le sirve? Saludos, Ramita Miranda.');
  });
});

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The broker's list. Volume is a few hundred per weekly run, so the UI gets
// everything at once and filters client-side. Heavy fields the cards don't
// show (descripcion, lat/lon) are left out.
export async function GET() {
  // Owners' names and phones: never rely on the middleware matcher alone.
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const captaciones = await prisma.captacion.findMany({
    orderBy: [{ score: 'desc' }, { ultimaVezVista: 'desc' }],
    select: {
      id: true,
      clave: true,
      portal: true,
      url: true,
      operacion: true,
      tipo: true,
      precio: true,
      moneda: true,
      m2Cubiertos: true,
      m2Total: true,
      ambientes: true,
      direccion: true,
      localidad: true,
      partido: true,
      anunciante: true,
      telefono: true,
      tieneWhatsappEnPortal: true,
      fotoUrl: true,
      score: true,
      motivo: true,
      senales: true,
      barrioPrivado: true,
      problemasAviso: true,
      borradorMensaje: true,
      diasPublicado: true,
      visitas: true,
      fechaPublicacion: true,
      senalesFuertes: true,
      rechazaInmobiliarias: true,
      abiertoACorredores: true,
      republicado: true,
      otrosPortales: true,
      estado: true,
      notas: true,
      estadoActualizadoEn: true,
      telefonoAdquiridoEn: true,
      telefonoIntentadoEn: true,
      primeraVezVista: true,
      ultimaVezVista: true,
      contactId: true,
      propertyId: true,
    },
  });

  return NextResponse.json({ captaciones });
}

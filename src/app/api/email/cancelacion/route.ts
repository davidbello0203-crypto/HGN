import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { resend, FROM, ADMIN_EMAIL, emailAdminCancelacion } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { reservaId } = await req.json();
    if (!ADMIN_EMAIL) return NextResponse.json({ ok: true, skipped: 'no admin email' });

    const supabase = createAdminClient();
    const { data: reserva, error } = await supabase
      .from('reservas')
      .select('*, profiles(nombre, apellido, email, telefono)')
      .eq('id', reservaId)
      .single();

    if (error || !reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const nombre = reserva.guest_name
      ? reserva.guest_name
      : `${reserva.profiles?.nombre ?? ''} ${reserva.profiles?.apellido ?? ''}`.trim();
    const email = reserva.guest_name ? '' : (reserva.profiles?.email ?? '');
    const telefono = reserva.guest_name ? reserva.guest_phone : reserva.profiles?.telefono;

    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `Cita cancelada — ${nombre}`,
      html: emailAdminCancelacion({
        nombre,
        email,
        telefono,
        servicio: reserva.servicio,
        dia: reserva.dia,
        horario: reserva.horario,
        fecha: reserva.fecha,
      }),
    });

    if (sendError) {
      console.error('Resend error (cancelacion):', sendError);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Email cancelacion exception:', err);
    return NextResponse.json({ error: 'Error enviando email' }, { status: 500 });
  }
}

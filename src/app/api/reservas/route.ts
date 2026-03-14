import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { resend, FROM, ADMIN_EMAIL, emailClienteNuevaReserva, emailAdminNuevaReserva } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { servicio, tipo, dia, horario, objetivo, notas, guest_name, guest_phone, fecha } = body;

    // Guest booking: only admin can create guest reservations
    const isGuest = !!guest_name;
    if (isGuest) {
      const adminDb = createAdminClient();
      const { data: profile } = await adminDb.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Solo el admin puede crear citas de invitados' }, { status: 403 });
      }
    }

    if (!servicio || !dia || !horario) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // For regular bookings, objetivo is required; for guest bookings, it's optional
    if (!isGuest && !objetivo) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const tipoFinal = tipo === 'entrenamiento' ? 'entrenamiento' : 'nutricion';

    const insertData: Record<string, unknown> = {
      user_id: user.id,
      servicio,
      tipo: tipoFinal,
      dia,
      horario,
      objetivo: objetivo || '',
      notas: notas || '',
      ...(fecha ? { fecha } : {}),
    };

    // Add guest fields if present
    if (isGuest) {
      insertData.guest_name = guest_name;
      insertData.guest_phone = guest_phone || '';
    }

    const { data, error } = await supabase
      .from('reservas')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Enviar emails en background (no bloquear la respuesta)
    const profile = isGuest ? null : await (async () => {
      const adminDb = createAdminClient();
      const { data } = await adminDb.from('profiles').select('nombre, apellido, email, telefono').eq('id', user.id).single();
      return data;
    })();

    const nombreCliente = isGuest ? guest_name : `${profile?.nombre ?? ''} ${profile?.apellido ?? ''}`.trim();
    const emailCliente = isGuest ? null : profile?.email;
    const telefonoCliente = isGuest ? guest_phone : profile?.telefono;

    const emailSends: Promise<unknown>[] = [];

    if (emailCliente && !isGuest) {
      emailSends.push(resend.emails.send({
        from: FROM,
        to: emailCliente,
        subject: 'Solicitud recibida — Good Nutrition Habits',
        html: emailClienteNuevaReserva({ nombre: nombreCliente, servicio, dia, horario, fecha }),
      }));
    }

    if (ADMIN_EMAIL) {
      emailSends.push(resend.emails.send({
        from: FROM,
        to: ADMIN_EMAIL,
        subject: `Nueva reserva — ${nombreCliente}`,
        html: emailAdminNuevaReserva({
          nombre: nombreCliente,
          email: emailCliente ?? '',
          telefono: telefonoCliente ?? '',
          servicio, dia, horario,
          objetivo: objetivo || '',
          notas: notas || '',
          fecha,
          esInvitado: isGuest,
        }),
      }));
    }

    Promise.allSettled(emailSends).catch(console.error);

    return NextResponse.json({ ok: true, reserva: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al guardar la reserva' }, { status: 500 });
  }
}

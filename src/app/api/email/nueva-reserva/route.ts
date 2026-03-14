import { NextRequest, NextResponse } from 'next/server';
import { resend, FROM, ADMIN_EMAIL, emailClienteNuevaReserva, emailAdminNuevaReserva } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, telefono, servicio, dia, horario, objetivo, notas, fecha, esInvitado } = body;

    const sends: Promise<unknown>[] = [];

    // Email al cliente (solo si tiene email)
    if (email && !esInvitado) {
      sends.push(
        resend.emails.send({
          from: FROM,
          to: email,
          subject: 'Solicitud recibida — Good Nutrition Habits',
          html: emailClienteNuevaReserva({ nombre, servicio, dia, horario, fecha }),
        })
      );
    }

    // Email a Bryan
    if (ADMIN_EMAIL) {
      sends.push(
        resend.emails.send({
          from: FROM,
          to: ADMIN_EMAIL,
          subject: `Nueva reserva — ${nombre}`,
          html: emailAdminNuevaReserva({ nombre, email: email ?? '', telefono, servicio, dia, horario, objetivo, notas, fecha, esInvitado }),
        })
      );
    }

    const results = await Promise.allSettled(sends);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error('Email nueva-reserva errors:', failed);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Email nueva-reserva exception:', err);
    return NextResponse.json({ error: 'Error enviando email' }, { status: 500 });
  }
}

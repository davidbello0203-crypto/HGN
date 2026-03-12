import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { servicio, tipo, dia, horario, objetivo, notas, guest_name, guest_phone } = body;

    // Guest booking: only admin can create guest reservations
    const isGuest = !!guest_name;
    if (isGuest) {
      const adminDb = await createAdminClient();
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

    return NextResponse.json({ ok: true, reserva: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al guardar la reserva' }, { status: 500 });
  }
}

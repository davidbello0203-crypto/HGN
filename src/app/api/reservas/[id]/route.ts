import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getAdminRole(userId: string) {
  const admin = await createAdminClient();
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single();
  return data?.role ?? 'user';
}

// PATCH — archivar cita (admin o dueño de la cita, solo canceladas)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const { archived } = await req.json();
    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'Campo archived requerido (boolean)' }, { status: 400 });
    }

    const role = await getAdminRole(user.id);
    const adminClient = await createAdminClient();

    const { data: reserva, error: fetchErr } = await adminClient
      .from('reservas')
      .select('id, user_id, estado')
      .eq('id', id)
      .single();

    if (fetchErr || !reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    if (reserva.estado !== 'cancelada') {
      return NextResponse.json({ error: 'Solo se pueden ocultar citas canceladas' }, { status: 400 });
    }

    if (role !== 'admin' && reserva.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { error: updateErr } = await adminClient
      .from('reservas')
      .update({ archived })
      .eq('id', id);

    if (updateErr) throw updateErr;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH reserva error:', err);
    return NextResponse.json({ error: 'Error al actualizar la reserva' }, { status: 500 });
  }
}

// DELETE — eliminar permanentemente (solo admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const role = await getAdminRole(user.id);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Solo el administrador puede eliminar citas' }, { status: 403 });
    }

    const { id } = await params;
    const adminClient = await createAdminClient();
    const { error } = await adminClient.from('reservas').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE reserva error:', err);
    return NextResponse.json({ error: 'Error al eliminar la reserva' }, { status: 500 });
  }
}

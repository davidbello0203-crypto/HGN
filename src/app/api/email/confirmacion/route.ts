import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { reservaId } = await req.json();
    const supabase = await createAdminClient();

    const { data: reserva } = await supabase
      .from('reservas')
      .select('*, profiles(nombre, apellido, email, telefono)')
      .eq('id', reservaId)
      .single();

    if (!reserva) return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });

    const { nombre, apellido, email } = reserva.profiles;

    await resend.emails.send({
      from: 'GNH <noreply@goodnutritionhabits.com>',
      to: email,
      subject: '✅ Tu cita ha sido confirmada — Good Nutrition Habits',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#080808;font-family:system-ui,sans-serif;">
          <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
            <div style="text-align:center;margin-bottom:32px;">
              <p style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#F07820;margin:0 0 8px">Good Nutrition Habits</p>
              <h1 style="font-size:28px;font-weight:700;color:#F0F0F0;margin:0;line-height:1.2">Tu cita está<br><span style="color:#28B44A">confirmada</span></h1>
            </div>

            <div style="background:#090C08;border:1px solid #1A2418;padding:28px;margin-bottom:24px;">
              <p style="color:rgba(240,240,240,0.6);font-size:14px;margin:0 0 20px;line-height:1.7">
                Hola <strong style="color:#F0F0F0">${nombre} ${apellido}</strong>, tu cita ha sido confirmada por Bryan. ¡Te esperamos!
              </p>
              ${[
                ['Servicio', reserva.servicio],
                ['Día', reserva.dia],
                ['Horario', reserva.horario],
                ['Objetivo', reserva.objetivo],
              ].map(([label, val]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1A2418;">
                  <span style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(240,240,240,0.4)">${label}</span>
                  <span style="font-size:13px;color:#F0F0F0;font-weight:500">${val}</span>
                </div>
              `).join('')}
            </div>

            <div style="background:rgba(40,180,74,0.08);border:1px solid rgba(40,180,74,0.2);padding:16px 20px;margin-bottom:24px;">
              <p style="color:rgba(240,240,240,0.7);font-size:13px;margin:0;line-height:1.6">
                💡 <strong style="color:#F0F0F0">Recuerda:</strong> Confirma tu asistencia cada domingo para la semana. Si necesitas cancelar, escríbele a Bryan con anticipación.
              </p>
            </div>

            <div style="text-align:center;">
              <a href="https://wa.me/527451105266" style="display:inline-block;padding:14px 32px;background:#F07820;color:#F0F0F0;text-decoration:none;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">
                Contactar a Bryan
              </a>
            </div>

            <p style="text-align:center;color:rgba(240,240,240,0.25);font-size:12px;margin-top:32px;">
              © ${new Date().getFullYear()} Good Nutrition Habits — L.N. Bryan Yaudiel Gil Tlatempa<br>Tixtla de Guerrero, México
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error enviando email' }, { status: 500 });
  }
}

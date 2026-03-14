import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);
export const FROM = process.env.EMAIL_FROM ?? 'GNH <onboarding@resend.dev>';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://goodnutritionhabits.com';

// ─── Helpers de formato ────────────────────────────────────────────────────
export function formatFecha(fecha?: string | null, dia?: string): string {
  if (fecha) {
    // fecha = 'YYYY-MM-DD' — parse as local date to avoid timezone shift
    const [y, m, d] = fecha.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  return dia ?? '';
}

function row(label: string, value: string) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1A2418;">
      <span style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:rgba(240,240,240,0.4)">${label}</span>
      <span style="font-size:13px;color:#F0F0F0;font-weight:500">${value}</span>
    </div>`;
}

function baseLayout(content: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:system-ui,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#F07820;margin:0 0 8px">Good Nutrition Habits</p>
    </div>
    ${content}
    <p style="text-align:center;color:rgba(240,240,240,0.25);font-size:12px;margin-top:32px;">
      © ${new Date().getFullYear()} Good Nutrition Habits — L.N. Bryan Yaudiel Gil Tlatempa<br>Tixtla de Guerrero, México
    </p>
  </div>
</body>
</html>`;
}

// ─── Templates ─────────────────────────────────────────────────────────────

// 1. Al cliente cuando agenda (pendiente)
export function emailClienteNuevaReserva(opts: {
  nombre: string;
  servicio: string;
  dia: string;
  horario: string;
  fecha?: string | null;
}) {
  const fechaStr = formatFecha(opts.fecha, opts.dia);
  return baseLayout(`
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="font-size:26px;font-weight:700;color:#F0F0F0;margin:0;line-height:1.2">
        Solicitud <span style="color:#F07820">recibida</span>
      </h1>
      <p style="color:rgba(240,240,240,0.5);font-size:14px;margin:10px 0 0">Bryan la revisará y confirmará pronto.</p>
    </div>
    <div style="background:#090C08;border:1px solid #1A2418;padding:28px;margin-bottom:24px;">
      <p style="color:rgba(240,240,240,0.6);font-size:14px;margin:0 0 20px;line-height:1.7">
        Hola <strong style="color:#F0F0F0">${opts.nombre}</strong>, recibimos tu solicitud de cita. Te avisaremos cuando Bryan la confirme.
      </p>
      ${row('Servicio', opts.servicio)}
      ${row('Fecha', fechaStr)}
      ${row('Horario', opts.horario)}
    </div>
    <div style="background:rgba(240,120,32,0.08);border:1px solid rgba(240,120,32,0.2);padding:16px 20px;margin-bottom:24px;">
      <p style="color:rgba(240,240,240,0.7);font-size:13px;margin:0;line-height:1.6">
        ⏳ Tu cita está <strong style="color:#F07820">en espera de confirmación</strong>. Bryan te contactará si necesita más información.
      </p>
    </div>
    <div style="text-align:center;">
      <a href="${SITE}/dashboard" style="display:inline-block;padding:14px 32px;background:#F07820;color:#F0F0F0;text-decoration:none;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">
        Ver mis citas
      </a>
    </div>
  `);
}

// 2. A Bryan cuando alguien agenda
export function emailAdminNuevaReserva(opts: {
  nombre: string;
  email: string;
  telefono?: string;
  servicio: string;
  dia: string;
  horario: string;
  objetivo: string;
  notas?: string;
  fecha?: string | null;
  esInvitado?: boolean;
}) {
  const fechaStr = formatFecha(opts.fecha, opts.dia);
  return baseLayout(`
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="font-size:26px;font-weight:700;color:#F0F0F0;margin:0;line-height:1.2">
        Nueva <span style="color:#28B44A">reserva</span>
      </h1>
      ${opts.esInvitado ? '<p style="color:#F07820;font-size:12px;margin:8px 0 0;letter-spacing:0.1em;text-transform:uppercase">Walk-in / Invitado</p>' : ''}
    </div>
    <div style="background:#090C08;border:1px solid #1A2418;padding:28px;margin-bottom:24px;">
      ${row('Cliente', opts.nombre)}
      ${opts.email ? row('Email', opts.email) : ''}
      ${opts.telefono ? row('Teléfono', opts.telefono) : ''}
      ${row('Servicio', opts.servicio)}
      ${row('Fecha', fechaStr)}
      ${row('Horario', opts.horario)}
      ${row('Objetivo', opts.objetivo)}
      ${opts.notas ? row('Notas', opts.notas) : ''}
    </div>
    <div style="text-align:center;">
      <a href="${SITE}/admin" style="display:inline-block;padding:14px 32px;background:#28B44A;color:#080808;text-decoration:none;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">
        Ir al panel admin
      </a>
    </div>
  `);
}

// 3. Al cliente cuando Bryan confirma
export function emailClienteConfirmada(opts: {
  nombre: string;
  servicio: string;
  dia: string;
  horario: string;
  objetivo: string;
  fecha?: string | null;
}) {
  const fechaStr = formatFecha(opts.fecha, opts.dia);
  return baseLayout(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="width:60px;height:60px;border-radius:50%;background:rgba(40,180,74,0.12);border:1px solid rgba(40,180,74,0.35);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;">✅</div>
      <h1 style="font-size:26px;font-weight:700;color:#F0F0F0;margin:0;line-height:1.2">
        Tu cita está <span style="color:#28B44A">confirmada</span>
      </h1>
    </div>
    <div style="background:#090C08;border:1px solid #1A2418;padding:28px;margin-bottom:24px;">
      <p style="color:rgba(240,240,240,0.6);font-size:14px;margin:0 0 20px;line-height:1.7">
        Hola <strong style="color:#F0F0F0">${opts.nombre}</strong>, Bryan confirmó tu cita. ¡Te esperamos!
      </p>
      ${row('Servicio', opts.servicio)}
      ${row('Fecha', fechaStr)}
      ${row('Horario', opts.horario)}
      ${row('Objetivo', opts.objetivo)}
    </div>
    <div style="background:rgba(40,180,74,0.08);border:1px solid rgba(40,180,74,0.2);padding:16px 20px;margin-bottom:24px;">
      <p style="color:rgba(240,240,240,0.7);font-size:13px;margin:0;line-height:1.6">
        💡 <strong style="color:#F0F0F0">Recuerda:</strong> Si necesitas cancelar o reagendar, contáctale a Bryan con anticipación.
      </p>
    </div>
    <div style="text-align:center;">
      <a href="https://wa.me/527451105266" style="display:inline-block;padding:14px 32px;background:#F07820;color:#F0F0F0;text-decoration:none;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">
        Contactar a Bryan
      </a>
    </div>
  `);
}

// 4. A Bryan cuando un cliente cancela
export function emailAdminCancelacion(opts: {
  nombre: string;
  email: string;
  telefono?: string;
  servicio: string;
  dia: string;
  horario: string;
  fecha?: string | null;
}) {
  const fechaStr = formatFecha(opts.fecha, opts.dia);
  return baseLayout(`
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="font-size:26px;font-weight:700;color:#F0F0F0;margin:0;line-height:1.2">
        Cita <span style="color:#FF6B6B">cancelada</span>
      </h1>
      <p style="color:rgba(240,240,240,0.5);font-size:14px;margin:10px 0 0">El cliente canceló su reserva.</p>
    </div>
    <div style="background:#090C08;border:1px solid #1A2418;padding:28px;margin-bottom:24px;">
      ${row('Cliente', opts.nombre)}
      ${opts.email ? row('Email', opts.email) : ''}
      ${opts.telefono ? row('Teléfono', opts.telefono) : ''}
      ${row('Servicio', opts.servicio)}
      ${row('Fecha', fechaStr)}
      ${row('Horario', opts.horario)}
    </div>
    <div style="background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.2);padding:16px 20px;">
      <p style="color:rgba(240,240,240,0.7);font-size:13px;margin:0;line-height:1.6">
        El cupo quedó libre. Puedes ofrecérselo a otro cliente.
      </p>
    </div>
  `);
}

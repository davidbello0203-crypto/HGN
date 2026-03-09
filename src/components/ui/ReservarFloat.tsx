'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

type FormData = {
  nombre: string;
  servicio: string;
  dia: string;
  horario: string;
  objetivo: string;
  notas: string;
};

const SERVICIOS = ['Consulta de Nutrición', 'Entrenamiento Presencial', 'Ambos (Nutrición + Entrenamiento)'];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORARIOS = ['6:00 – 7:00 am', '7:00 – 8:00 am', '8:00 – 9:00 am', '9:00 – 10:00 am', '10:00 – 11:00 am', '4:00 – 5:00 pm', '5:00 – 6:00 pm'];
const OBJETIVOS = ['Bajar de peso', 'Ganar masa muscular', 'Mejorar hábitos alimenticios', 'Rendimiento deportivo', 'Salud general'];
const STEPS = ['Servicio', 'Horario', 'Objetivo'];

const EMPTY: FormData = { nombre: '', servicio: '', dia: '', horario: '', objetivo: '', notas: '' };

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#111610',
  border: '1px solid #1E2A1C',
  color: '#F0F0F0',
  fontFamily: 'var(--font-inter), system-ui, sans-serif',
  fontSize: '15px',
  padding: '14px 16px',
  outline: 'none',
  transition: 'border-color 0.3s ease',
  borderRadius: 0,
};

function OptionButton({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', textAlign: 'left', padding: '14px 18px',
        backgroundColor: selected ? 'rgba(240,120,32,0.12)' : '#111610',
        border: `1px solid ${selected ? '#F07820' : '#1E2A1C'}`,
        color: selected ? '#F0F0F0' : 'rgba(240,240,240,0.65)',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(240,120,32,0.5)'; e.currentTarget.style.color = '#F0F0F0'; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = '#1E2A1C'; e.currentTarget.style.color = 'rgba(240,240,240,0.65)'; } }}
    >
      {label}
      {selected && <Check size={15} color="#F07820" />}
    </button>
  );
}

function DayButton({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        padding: '10px 18px',
        backgroundColor: selected ? 'rgba(240,120,32,0.12)' : '#111610',
        border: `1px solid ${selected ? '#F07820' : '#1E2A1C'}`,
        color: selected ? '#F0F0F0' : 'rgba(240,240,240,0.65)',
        fontFamily: 'var(--font-inter)', fontSize: '13px',
        cursor: 'pointer', transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(240,120,32,0.5)'; e.currentTarget.style.color = '#F0F0F0'; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = '#1E2A1C'; e.currentTarget.style.color = 'rgba(240,240,240,0.65)'; } }}
    >
      {label}
    </button>
  );
}

async function checkAuthAndOpen(onSuccess: (nombre: string) => void) {
  const supabase = createClient();
  // getSession lee localStorage — sin red, instantáneo
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = '/login?from=reservar';
    return;
  }
  const meta = session.user.user_metadata ?? {};
  const fromMeta = `${meta.nombre ?? ''} ${meta.apellido ?? ''}`.trim();
  if (fromMeta) { onSuccess(fromMeta); return; }
  // Fallback: consultar profiles
  try {
    const { data: prof } = await supabase.from('profiles').select('nombre, apellido').eq('id', session.user.id).maybeSingle();
    const fromProfile = prof ? `${prof.nombre ?? ''} ${prof.apellido ?? ''}`.trim() : '';
    onSuccess(fromProfile || session.user.email?.split('@')[0] || '');
  } catch {
    onSuccess(session.user.email?.split('@')[0] || '');
  }
}

export default function ReservarFloat() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const handler = () => {
      checkAuthAndOpen((nombre) => {
        setForm({ ...EMPTY, nombre });
        setStep(0);
        setDone(false);
        setOpen(true);
      });
    };
    window.addEventListener('open-reservar', handler);

    // Auto-abrir si viene de login con ?open=reservar
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('open') === 'reservar') {
      const url = new URL(window.location.href);
      url.searchParams.delete('open');
      window.history.replaceState({}, '', url.toString());
      handler();
    }

    return () => window.removeEventListener('open-reservar', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const selectAndAdvance = (field: keyof FormData, value: string, nextStep: number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setTimeout(() => setStep(nextStep), 320);
  };

  const selectDay = (value: string) => {
    setForm((prev) => {
      const updated = { ...prev, dia: value };
      if (updated.horario !== '') setTimeout(() => setStep(2), 320);
      return updated;
    });
  };

  const selectHorario = (value: string) => {
    setForm((prev) => {
      const updated = { ...prev, horario: value };
      if (updated.dia !== '') setTimeout(() => setStep(2), 320);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!form.objetivo || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicio: form.servicio,
          dia: form.dia,
          horario: form.horario,
          objetivo: form.objetivo,
          notas: form.notas,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) {
          window.location.href = '/login?from=reservar';
          return;
        }
        setSubmitError(json.error || 'Error al guardar la reserva. Intenta de nuevo.');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setSubmitError('Sin conexión. Revisa tu internet e intenta de nuevo.');
    }
    setSubmitting(false);
  };

  const reset = () => { setStep(0); setForm(EMPTY); setDone(false); setOpen(false); setSubmitError(''); };
  const canFinish = form.objetivo !== '' && !submitting;
  const firstName = form.nombre.split(' ')[0];

  return (
    <>
      {/* Floating button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2, duration: 0.6, ease: 'easeOut' }}
        style={{ position: 'fixed', bottom: '28px', right: '24px', zIndex: 50 }}
      >
        <button
          onClick={() => checkAuthAndOpen((nombre) => { setForm({ ...EMPTY, nombre }); setStep(0); setDone(false); setOpen(true); })}
          style={{
            width: '58px', height: '58px', borderRadius: '50%',
            backgroundColor: '#F07820', border: 'none', color: '#F0F0F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'transform 0.3s ease, background-color 0.3s ease',
            boxShadow: '0 4px 28px rgba(240,120,32,0.40)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.backgroundColor = '#FF8C35'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = '#F07820'; }}
          aria-label="Reservar cita"
        >
          <CalendarCheck size={24} />
        </button>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={reset}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(8px)', zIndex: 100 }}
            />

            <div key="modal-wrap" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101, pointerEvents: 'none', padding: '24px' }}>
              <motion.div key="modal"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.97 }}
                transition={{ duration: 0.45, ease: EXPO_OUT }}
                style={{
                  pointerEvents: 'auto',
                  width: '100%', maxWidth: '540px',
                  maxHeight: 'calc(100vh - 48px)',
                  backgroundColor: '#090C08',
                  border: '1px solid #1A2418',
                  boxShadow: '0 40px 100px rgba(0,0,0,0.75)',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div className="reservar-header" style={{ padding: '28px 32px 22px', borderBottom: '1px solid #1A2418', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#F07820', marginBottom: '6px' }}>
                      {done ? 'Solicitud enviada' : `Paso ${step + 1} de ${STEPS.length} — ${STEPS[step]}`}
                    </p>
                    <h3 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#F0F0F0', lineHeight: 1.1 }}>
                      {done ? '¡Todo listo!' : 'Reserva tu cita'}
                    </h3>
                    {!done && firstName && (
                      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.35)', marginTop: '4px' }}>
                        Hola, {firstName} 👋
                      </p>
                    )}
                  </div>
                  <button onClick={reset}
                    style={{ background: 'none', border: 'none', color: 'rgba(240,240,240,0.35)', cursor: 'pointer', padding: '4px', marginLeft: '16px', flexShrink: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F0F0')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,240,240,0.35)')}>
                    <X size={20} />
                  </button>
                </div>

                {/* Progress bar */}
                {!done && (
                  <div style={{ height: '2px', backgroundColor: '#1A2418', flexShrink: 0 }}>
                    <motion.div
                      animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      style={{ height: '100%', backgroundColor: '#F07820' }}
                    />
                  </div>
                )}

                {/* Content */}
                <div className="reservar-content" style={{ padding: '28px 32px', overflowY: 'auto', flex: 1 }}>
                  <AnimatePresence mode="wait">

                    {/* Done */}
                    {done && (
                      <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
                        style={{ textAlign: 'center', paddingBottom: '8px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(40,180,74,0.12)', border: '1px solid rgba(40,180,74,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto 20px' }}>
                          <Check size={26} color="#28B44A" />
                        </div>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '15px', color: 'rgba(240,240,240,0.65)', lineHeight: 1.8, maxWidth: '360px', margin: '0 auto 28px' }}>
                          Tu cita fue registrada exitosamente. Bryan la revisará y te confirmará pronto.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <a href="/dashboard"
                            style={{ padding: '13px 28px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', transition: 'background-color 0.3s ease' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FF8C35')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F07820')}>
                            Ver mis citas
                          </a>
                          <button onClick={reset}
                            style={{ padding: '13px 28px', backgroundColor: 'transparent', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.55)', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer' }}>
                            Cerrar
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 0 — Servicio */}
                    {!done && step === 0 && (
                      <motion.div key="s0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>
                          ¿Qué servicio necesitas?
                        </label>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', marginBottom: '16px' }}>
                          Selecciona una opción para continuar automáticamente
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {SERVICIOS.map((s) => (
                            <OptionButton key={s} label={s} selected={form.servicio === s}
                              onSelect={() => selectAndAdvance('servicio', s, 1)} />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 1 — Día + Horario */}
                    {!done && step === 1 && (
                      <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '12px' }}>
                          Día preferido
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
                          {DIAS.map((d) => (
                            <DayButton key={d} label={d} selected={form.dia === d} onSelect={() => selectDay(d)} />
                          ))}
                        </div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>
                          Horario preferido
                        </label>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', marginBottom: '12px' }}>
                          Al seleccionar horario avanzará automáticamente
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {HORARIOS.map((h) => (
                            <OptionButton key={h} label={h} selected={form.horario === h}
                              onSelect={() => selectHorario(h)} />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2 — Objetivo + Notas */}
                    {!done && step === 2 && (
                      <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>
                          ¿Cuál es tu objetivo?
                        </label>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', marginBottom: '16px' }}>
                          Selecciona una opción para habilitar el envío
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                          {OBJETIVOS.map((o) => (
                            <OptionButton key={o} label={o} selected={form.objetivo === o}
                              onSelect={() => setForm((prev) => ({ ...prev, objetivo: o }))} />
                          ))}
                        </div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '10px' }}>
                          Notas adicionales <span style={{ color: 'rgba(240,240,240,0.25)', textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                        </label>
                        <textarea placeholder="Lesiones, condiciones médicas, preferencias…" value={form.notas} rows={3}
                          onChange={(e) => setForm({ ...form, notas: e.target.value })}
                          style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }}
                          onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                          onBlur={(e) => (e.target.style.borderColor = '#1E2A1C')}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                {!done && (
                  <div className="reservar-footer" style={{ borderTop: '1px solid #1A2418', flexShrink: 0 }}>
                  {submitError && (
                    <div style={{ padding: '12px 32px 0', fontFamily: 'var(--font-inter)', fontSize: '12px', color: '#FF6B6B' }}>
                      {submitError}
                    </div>
                  )}
                  <div style={{ padding: '20px 32px 28px', display: 'flex', gap: '12px' }}>
                    {step > 0 && (
                      <button onClick={() => setStep(step - 1)} style={{
                        flex: 1, padding: '14px', backgroundColor: 'transparent',
                        border: '1px solid #1E2A1C', color: 'rgba(240,240,240,0.6)',
                        fontFamily: 'var(--font-inter)', fontSize: '11px',
                        letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.3s ease',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F0F0F0'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1E2A1C'; e.currentTarget.style.color = 'rgba(240,240,240,0.6)'; }}>
                        <ChevronLeft size={14} /> Atrás
                      </button>
                    )}

                    {/* Steps 0 y 1: selección avanza sola */}
                    {(step === 0 || step === 1) && (
                      <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', letterSpacing: '0.05em' }}>
                          Selecciona una opción arriba
                        </p>
                      </div>
                    )}

                    {/* Step 2: botón Confirmar */}
                    {step === 2 && (
                      <button onClick={() => canFinish && handleSubmit()} style={{
                        flex: 2, padding: '14px',
                        backgroundColor: canFinish ? '#F07820' : 'transparent',
                        border: `1px solid ${canFinish ? '#F07820' : '#1E2A1C'}`,
                        color: canFinish ? '#F0F0F0' : 'rgba(240,240,240,0.35)',
                        fontFamily: 'var(--font-inter)', fontSize: '11px',
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                        cursor: canFinish ? 'pointer' : 'default',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 0.3s ease',
                      }}
                        onMouseEnter={(e) => { if (canFinish) e.currentTarget.style.backgroundColor = '#FF8C35'; }}
                        onMouseLeave={(e) => { if (canFinish) e.currentTarget.style.backgroundColor = '#F07820'; }}>
                        {submitting ? 'Enviando...' : 'Confirmar cita'} <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      <style>{`
        @media (max-width: 480px) {
          .reservar-header { padding: 20px 20px 16px !important; }
          .reservar-content { padding: 20px !important; }
          .reservar-footer { padding: 16px 20px 20px !important; }
        }
      `}</style>
    </>
  );
}

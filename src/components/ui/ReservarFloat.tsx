'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, X, ChevronRight, ChevronLeft, Check, Dumbbell, Sparkles, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import WeeklyCalendar, { type CalSlot } from '@/components/ui/WeeklyCalendar';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

type FormData = {
  nombre: string;
  servicio: string;
  tipo: 'nutricion' | 'entrenamiento' | 'ambos' | '';
  // Cita 1 (nutricion o servicio único)
  dia: string;
  horario: string;
  objetivo: string;
  notas: string;
  // Cita 2 (entrenamiento — solo cuando ambos)
  dia2: string;
  horario2: string;
  objetivo2: string;
  notas2: string;
};

const SERVICIOS = ['Consulta de Nutrición', 'Entrenamiento Presencial', 'Ambos (Nutrición + Entrenamiento)'];
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORARIOS = ['6:00 – 7:00 am', '7:00 – 8:00 am', '8:00 – 9:00 am', '9:00 – 10:00 am', '10:00 – 11:00 am', '4:00 – 5:00 pm', '5:00 – 6:00 pm'];
const OBJETIVOS = ['Bajar de peso', 'Ganar masa muscular', 'Mejorar hábitos alimenticios', 'Rendimiento deportivo', 'Salud general'];

const EMPTY: FormData = {
  nombre: '', servicio: '', tipo: '',
  dia: '', horario: '', objetivo: '', notas: '',
  dia2: '', horario2: '', objetivo2: '', notas2: '',
};

const inputStyle: React.CSSProperties = {
  width: '100%', backgroundColor: '#111610', border: '1px solid #1E2A1C',
  color: '#F0F0F0', fontFamily: 'var(--font-inter), system-ui, sans-serif',
  fontSize: '15px', padding: '14px 16px', outline: 'none',
  transition: 'border-color 0.3s ease', borderRadius: 0,
};

function OptionButton({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} style={{
      width: '100%', textAlign: 'left', padding: '14px 18px',
      backgroundColor: selected ? 'rgba(240,120,32,0.12)' : '#111610',
      border: `1px solid ${selected ? '#F07820' : '#1E2A1C'}`,
      color: selected ? '#F0F0F0' : 'rgba(240,240,240,0.65)',
      fontFamily: 'var(--font-inter), system-ui, sans-serif',
      fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(240,120,32,0.5)'; e.currentTarget.style.color = '#F0F0F0'; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = '#1E2A1C'; e.currentTarget.style.color = 'rgba(240,240,240,0.65)'; } }}>
      {label}
      {selected && <Check size={15} color="#F07820" />}
    </button>
  );
}

function DayButton({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} style={{
      padding: '10px 18px',
      backgroundColor: selected ? 'rgba(240,120,32,0.12)' : '#111610',
      border: `1px solid ${selected ? '#F07820' : '#1E2A1C'}`,
      color: selected ? '#F0F0F0' : 'rgba(240,240,240,0.65)',
      fontFamily: 'var(--font-inter)', fontSize: '13px',
      cursor: 'pointer', transition: 'all 0.2s ease',
    }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'rgba(240,120,32,0.5)'; e.currentTarget.style.color = '#F0F0F0'; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = '#1E2A1C'; e.currentTarget.style.color = 'rgba(240,240,240,0.65)'; } }}>
      {label}
    </button>
  );
}

async function fetchNombre(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';
    const meta = user.user_metadata ?? {};
    const fromMeta = `${meta.nombre ?? ''} ${meta.apellido ?? ''}`.trim();
    if (fromMeta) return fromMeta;
    const { data: prof } = await supabase.from('profiles').select('nombre, apellido').eq('id', user.id).maybeSingle();
    return prof ? `${prof.nombre ?? ''} ${prof.apellido ?? ''}`.trim() : (user.email?.split('@')[0] || '');
  } catch { return ''; }
}

export default function ReservarFloat() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [calSlots, setCalSlots] = useState<CalSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('reservas')
        .select('dia, horario, tipo, estado')
        .in('estado', ['pendiente', 'confirmada']);
      setCalSlots(
        (data || []).map((r: { dia: string; horario: string; tipo: 'nutricion' | 'entrenamiento'; estado: string }) => ({
          dia: r.dia,
          horario: r.horario,
          tipo: r.tipo ?? 'nutricion',
          estado: r.estado,
        }))
      );
    } catch {
      setCalSlots([]);
    }
    setLoadingSlots(false);
  };

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session?.user));
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_e, session) => setIsLoggedIn(!!session?.user));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = () => {
      setForm(EMPTY);
      setStep(0);
      setDone(false);
      setSubmitError('');
      setOpen(true);
      fetchNombre().then((nombre) => { if (nombre) setForm((prev) => ({ ...prev, nombre })); });
      fetchSlots();
    };
    window.addEventListener('open-reservar', handler);
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

  const isAmbos = form.tipo === 'ambos';
  // Pasos: 0=Servicio, 1=Horario(cita1), 2=Objetivo(cita1), [3=Horario(cita2), 4=Objetivo(cita2)] si ambos
  const totalSteps = isAmbos ? 5 : 3;

  const getStepLabel = () => {
    if (step === 0) return 'Servicio';
    if (!isAmbos) return step === 1 ? 'Horario' : 'Objetivo';
    if (step === 1) return 'Nutrición · Horario';
    if (step === 2) return 'Nutrición · Objetivo';
    if (step === 3) return 'Entrenamiento · Horario';
    return 'Entrenamiento · Objetivo';
  };

  // Badge de contexto para pasos ambos
  const getContextBadge = () => {
    if (!isAmbos || step === 0) return null;
    const isNutri = step <= 2;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.16em',
          textTransform: 'uppercase', fontWeight: 600,
          padding: '3px 10px',
          backgroundColor: isNutri ? 'rgba(240,120,32,0.1)' : 'rgba(40,180,74,0.1)',
          border: `1px solid ${isNutri ? 'rgba(240,120,32,0.3)' : 'rgba(40,180,74,0.3)'}`,
          color: isNutri ? '#F07820' : '#28B44A',
        }}>
          {isNutri ? <Sparkles size={10} /> : <Dumbbell size={10} />}
          {isNutri ? 'Cita 1 · Nutrición' : 'Cita 2 · Entrenamiento'}
        </span>
      </div>
    );
  };

  const selectDay = (value: string, field: 'dia' | 'dia2') => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      const horarioField = field === 'dia' ? 'horario' : 'horario2';
      if (updated[horarioField]) setTimeout(() => setStep(s => s + 1), 320);
      return updated;
    });
  };

  const selectHorario = (value: string, field: 'horario' | 'horario2') => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      const diaField = field === 'horario' ? 'dia' : 'dia2';
      if (updated[diaField]) setTimeout(() => setStep(s => s + 1), 320);
      return updated;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      if (isAmbos) {
        const [r1, r2] = await Promise.all([
          fetch('/api/reservas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicio: 'Consulta de Nutrición', tipo: 'nutricion', dia: form.dia, horario: form.horario, objetivo: form.objetivo, notas: form.notas }),
          }),
          fetch('/api/reservas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ servicio: 'Entrenamiento Presencial', tipo: 'entrenamiento', dia: form.dia2, horario: form.horario2, objetivo: form.objetivo2, notas: form.notas2 }),
          }),
        ]);
        if (!r1.ok || !r2.ok) {
          const bad = !r1.ok ? r1 : r2;
          if (bad.status === 401) { window.location.href = '/login?from=reservar'; return; }
          const json = await bad.json().catch(() => ({}));
          setSubmitError(json.error || 'Error al guardar. Intenta de nuevo.');
          setSubmitting(false);
          return;
        }
      } else {
        const res = await fetch('/api/reservas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ servicio: form.servicio, tipo: form.tipo, dia: form.dia, horario: form.horario, objetivo: form.objetivo, notas: form.notas }),
        });
        if (!res.ok) {
          if (res.status === 401) { window.location.href = '/login?from=reservar'; return; }
          const json = await res.json().catch(() => ({}));
          setSubmitError(json.error || 'Error al guardar la reserva. Intenta de nuevo.');
          setSubmitting(false);
          return;
        }
      }
      setDone(true);
    } catch {
      setSubmitError('Sin conexión. Revisa tu internet e intenta de nuevo.');
    }
    setSubmitting(false);
  };

  const reset = () => { setStep(0); setForm(EMPTY); setDone(false); setOpen(false); setSubmitError(''); };

  // canFinish: para el paso de objetivo actual
  const canFinish = step === 2
    ? (form.objetivo !== '' && !submitting)
    : step === 4
    ? (form.objetivo2 !== '' && !submitting)
    : false;

  // En ambos, step 2 no envía — avanza a step 3
  const isLastStep = isAmbos ? step === 4 : step === 2;
  const firstName = form.nombre.split(' ')[0];

  const currentDia     = step <= 2 ? form.dia     : form.dia2;
  const currentHorario = step <= 2 ? form.horario  : form.horario2;
  const currentObjetivo = step <= 2 ? form.objetivo : form.objetivo2;
  const currentNotas   = step <= 2 ? form.notas    : form.notas2;
  const diaField       = step <= 2 ? 'dia'    : 'dia2'    as 'dia' | 'dia2';
  const horarioField   = step <= 2 ? 'horario' : 'horario2' as 'horario' | 'horario2';
  const objetivoField  = step <= 2 ? 'objetivo' : 'objetivo2';
  const notasField     = step <= 2 ? 'notas'    : 'notas2';

  return (
    <>
      {/* Floating button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2, duration: 0.6, ease: 'easeOut' }}
        style={{ position: 'fixed', bottom: '28px', right: '24px', zIndex: 50 }}>
        <button
          onClick={() => {
            if (isLoggedIn) window.dispatchEvent(new CustomEvent('open-reservar'));
            else window.location.href = '/login?from=reservar';
          }}
          style={{
            width: '58px', height: '58px', borderRadius: '50%',
            backgroundColor: '#F07820', border: 'none', color: '#F0F0F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'transform 0.3s ease, background-color 0.3s ease',
            boxShadow: '0 4px 28px rgba(240,120,32,0.40)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.backgroundColor = '#FF8C35'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = '#F07820'; }}
          aria-label="Reservar cita">
          <CalendarCheck size={24} />
        </button>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }} onClick={reset}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(8px)', zIndex: 100 }} />

            <div key="modal-wrap" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101, pointerEvents: 'none', padding: '24px' }}>
              <motion.div key="modal"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.97 }}
                transition={{ duration: 0.45, ease: EXPO_OUT }}
                style={{
                  pointerEvents: 'auto', width: '100%', maxWidth: '680px',
                  maxHeight: 'calc(100vh - 48px)', backgroundColor: '#090C08',
                  border: '1px solid #1A2418', boxShadow: '0 40px 100px rgba(0,0,0,0.75)',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>

                {/* Header */}
                <div className="reservar-header" style={{ padding: '28px 32px 22px', borderBottom: '1px solid #1A2418', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#F07820', marginBottom: '6px' }}>
                      {done ? 'Solicitud enviada' : `Paso ${step + 1} de ${totalSteps} — ${getStepLabel()}`}
                    </p>
                    <h3 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#F0F0F0', lineHeight: 1.1 }}>
                      {done ? '¡Todo listo!' : 'Reserva tu cita'}
                    </h3>
                    {!done && firstName && (
                      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.35)', marginTop: '4px' }}>
                        Hola, {firstName} 👋
                      </p>
                    )}
                    {!done && getContextBadge()}
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
                      animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      style={{ height: '100%', backgroundColor: (isAmbos && step >= 3) ? '#28B44A' : '#F07820' }} />
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
                          {isAmbos
                            ? 'Tus 2 citas fueron registradas: Consulta de Nutrición y Entrenamiento Presencial. Bryan las revisará y te confirmará pronto.'
                            : 'Tu cita fue registrada exitosamente. Bryan la revisará y te confirmará pronto.'}
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
                              onSelect={() => {
                                const tipo: FormData['tipo'] = s.toLowerCase().includes('ambos')
                                  ? 'ambos'
                                  : s.toLowerCase().includes('entrena')
                                  ? 'entrenamiento'
                                  : 'nutricion';
                                setForm(prev => ({ ...prev, servicio: s, tipo }));
                                setTimeout(() => setStep(1), 320);
                              }} />
                          ))}
                        </div>
                        {/* Nota explicativa para Ambos */}
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,240,240,0.25)', marginTop: '16px', lineHeight: 1.6 }}>
                          Al elegir <em style={{ color: 'rgba(240,240,240,0.4)' }}>Ambos</em> podrás elegir horarios distintos para cada servicio.
                        </p>
                      </motion.div>
                    )}

                    {/* Step 1 — Horario cita 1 (nutricion o servicio único) — Calendario semanal */}
                    {!done && step === 1 && (
                      <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '6px' }}>
                          Selecciona un horario disponible
                        </label>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', marginBottom: '16px' }}>
                          Toca una celda libre para elegir dia y hora. Avanzara automaticamente.
                        </p>
                        {loadingSlots ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px' }}>
                            <Loader2 size={18} color="#F07820" style={{ animation: 'spin 0.8s linear infinite' }} />
                            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.4)' }}>Cargando disponibilidad...</span>
                          </div>
                        ) : (
                          <WeeklyCalendar
                            slots={calSlots}
                            mode="select"
                            selectedDia={currentDia}
                            selectedHorario={currentHorario}
                            onSelectSlot={(dia, horario) => {
                              setForm(prev => ({ ...prev, [diaField]: dia, [horarioField]: horario }));
                              setTimeout(() => setStep(s => s + 1), 350);
                            }}
                          />
                        )}
                      </motion.div>
                    )}

                    {/* Step 2 — Objetivo cita 1 */}
                    {!done && step === 2 && (
                      <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>
                          ¿Cuál es tu objetivo?
                        </label>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', marginBottom: '16px' }}>
                          {isAmbos ? 'Para tu consulta de nutrición' : 'Selecciona una opción para habilitar el envío'}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                          {OBJETIVOS.map((o) => (
                            <OptionButton key={o} label={o} selected={currentObjetivo === o}
                              onSelect={() => setForm((prev) => ({ ...prev, [objetivoField]: o }))} />
                          ))}
                        </div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '10px' }}>
                          Notas adicionales <span style={{ color: 'rgba(240,240,240,0.25)', textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                        </label>
                        <textarea placeholder="Condiciones médicas, preferencias…" value={currentNotas} rows={3}
                          onChange={(e) => setForm(prev => ({ ...prev, [notasField]: e.target.value }))}
                          style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }}
                          onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                          onBlur={(e) => (e.target.style.borderColor = '#1E2A1C')} />
                      </motion.div>
                    )}

                    {/* Step 3 — Horario cita 2 (entrenamiento) — solo ambos — Calendario semanal */}
                    {!done && step === 3 && isAmbos && (
                      <motion.div key="s3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '6px' }}>
                          Selecciona horario para entrenamiento
                        </label>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', marginBottom: '16px' }}>
                          Elige un horario distinto al de tu consulta de nutricion.
                        </p>
                        {loadingSlots ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px' }}>
                            <Loader2 size={18} color="#28B44A" style={{ animation: 'spin 0.8s linear infinite' }} />
                            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.4)' }}>Cargando disponibilidad...</span>
                          </div>
                        ) : (
                          <WeeklyCalendar
                            slots={calSlots}
                            mode="select"
                            selectedDia={form.dia2}
                            selectedHorario={form.horario2}
                            onSelectSlot={(dia, horario) => {
                              setForm(prev => ({ ...prev, dia2: dia, horario2: horario }));
                              setTimeout(() => setStep(s => s + 1), 350);
                            }}
                          />
                        )}
                      </motion.div>
                    )}

                    {/* Step 4 — Objetivo cita 2 (entrenamiento) — solo ambos */}
                    {!done && step === 4 && isAmbos && (
                      <motion.div key="s4" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>
                          ¿Cuál es tu objetivo?
                        </label>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', marginBottom: '16px' }}>
                          Para tu entrenamiento presencial
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                          {OBJETIVOS.map((o) => (
                            <OptionButton key={o} label={o} selected={form.objetivo2 === o}
                              onSelect={() => setForm((prev) => ({ ...prev, objetivo2: o }))} />
                          ))}
                        </div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '10px' }}>
                          Notas adicionales <span style={{ color: 'rgba(240,240,240,0.25)', textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                        </label>
                        <textarea placeholder="Lesiones, nivel de condición física…" value={form.notas2} rows={3}
                          onChange={(e) => setForm(prev => ({ ...prev, notas2: e.target.value }))}
                          style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }}
                          onFocus={(e) => (e.target.style.borderColor = '#28B44A')}
                          onBlur={(e) => (e.target.style.borderColor = '#1E2A1C')} />
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

                      {/* Pasos de horario — selección avanza sola */}
                      {(step === 0 || step === 1 || step === 3) && (
                        <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.30)', letterSpacing: '0.05em' }}>
                            Selecciona una opción arriba
                          </p>
                        </div>
                      )}

                      {/* Step 2 en modo ambos: avanza a entrenamiento */}
                      {step === 2 && isAmbos && (
                        <button onClick={() => form.objetivo && setStep(3)} style={{
                          flex: 2, padding: '14px',
                          backgroundColor: form.objetivo ? '#28B44A' : 'transparent',
                          border: `1px solid ${form.objetivo ? '#28B44A' : '#1E2A1C'}`,
                          color: form.objetivo ? '#080808' : 'rgba(240,240,240,0.35)',
                          fontFamily: 'var(--font-inter)', fontSize: '11px',
                          letterSpacing: '0.15em', textTransform: 'uppercase',
                          cursor: form.objetivo ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          transition: 'all 0.3s ease', fontWeight: form.objetivo ? 700 : 400,
                        }}
                          onMouseEnter={(e) => { if (form.objetivo) e.currentTarget.style.backgroundColor = '#32D458'; }}
                          onMouseLeave={(e) => { if (form.objetivo) e.currentTarget.style.backgroundColor = '#28B44A'; }}>
                          Continuar con Entrenamiento <ChevronRight size={14} />
                        </button>
                      )}

                      {/* Step 2 en modo único O step 4 en ambos: confirmar */}
                      {((step === 2 && !isAmbos) || step === 4) && (
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
                          {submitting ? 'Enviando...' : isLastStep && isAmbos ? 'Confirmar 2 citas' : 'Confirmar cita'} <ChevronRight size={14} />
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
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) {
          .reservar-header { padding: 20px 20px 16px !important; }
          .reservar-content { padding: 20px !important; }
          .reservar-footer { padding: 16px 20px 20px !important; }
        }
      `}</style>
    </>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import {
  CalendarCheck, Clock, CheckCircle, XCircle, LogOut, Plus,
  User, Phone, Mail, Edit2, Save, X, ArrowLeft, Dumbbell, Sparkles, Camera, CalendarDays, Loader2, Trash2,
} from 'lucide-react';
import WeeklyCalendar, { type CalSlot } from '@/components/ui/WeeklyCalendar';
import AvatarCrop from '@/components/ui/AvatarCrop';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

type Reserva = {
  id: string;
  servicio: string;
  tipo: 'nutricion' | 'entrenamiento';
  dia: string;
  horario: string;
  objetivo: string;
  notas: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  created_at: string;
  archived?: boolean;
};

type Profile = {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  avatar_url?: string;
};

const ESTADO = {
  pendiente:  { bg: 'rgba(240,120,32,0.12)',  border: 'rgba(240,120,32,0.35)',  text: '#F07820', label: 'Pendiente',  bar: '#F07820' },
  confirmada: { bg: 'rgba(40,180,74,0.12)',   border: 'rgba(40,180,74,0.35)',   text: '#28B44A', label: 'Confirmada', bar: '#28B44A' },
  cancelada:  { bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.25)', text: '#FF6B6B', label: 'Cancelada',  bar: '#FF6B6B' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', backgroundColor: '#0F1208', border: '1px solid #1A2418',
  color: '#F0F0F0', fontFamily: 'var(--font-inter), system-ui, sans-serif',
  fontSize: '14px', padding: '12px 14px', outline: 'none', borderRadius: 0,
  transition: 'border-color 0.3s ease',
};

const TIPS = [
  'Recuerda hidratarte bien antes de tu sesión.',
  'La consistencia supera a la intensidad.',
  'Cada cita es un paso hacia tu mejor versión.',
  'Dormir bien es parte del entrenamiento.',
  'La nutrición es el 70% del resultado.',
];

type Tab = 'proximas' | 'historial' | 'calendario' | 'perfil';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('proximas');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Profile>({ nombre: '', apellido: '', email: '', telefono: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [allSlots, setAllSlots] = useState<CalSlot[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calDashFilter, setCalDashFilter] = useState<'todas' | 'nutricion' | 'entrenamiento'>('todas');
  // Feature: Limpiar canceladas
  const [cleanMode, setCleanMode] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const tip = TIPS[new Date().getDay() % TIPS.length];

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      // getSession lee desde localStorage — sin red, instantáneo
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push('/login'); return; }

      const user = session.user;
      setUserId(user.id);

      // Mostrar UI de inmediato con metadata (sin esperar BD)
      const meta = user.user_metadata ?? {};
      const optimistic: Profile = {
        nombre:   meta.nombre   || meta.full_name?.split(' ')[0] || '',
        apellido: meta.apellido || meta.full_name?.split(' ').slice(1).join(' ') || '',
        email:    user.email    || '',
        telefono: meta.telefono || '',
      };
      setProfile(optimistic);
      setProfileForm(optimistic);
      setLoading(false); // spinner desaparece aquí

      // Cargar BD en paralelo (background)
      const [{ data: prof }, { data: reservasData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('reservas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      setReservas(reservasData || []);

      if (prof) {
        const merged: Profile = {
          nombre:    prof.nombre    || optimistic.nombre,
          apellido:  prof.apellido  || optimistic.apellido,
          email:     prof.email     || optimistic.email,
          telefono:  prof.telefono  || optimistic.telefono,
          avatar_url: prof.avatar_url,
        };
        setProfile(merged);
        setProfileForm(merged);
        // Upsert solo si el perfil estaba vacío
        if (!prof.nombre) {
          supabase.from('profiles').upsert({ id: user.id, ...merged }, { onConflict: 'id' });
        }
      }
    };
    load();
  }, [router]);

  const reload = async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase.from('reservas').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    setReservas(data || []);
  };

  const loadCalendarSlots = async () => {
    if (!userId) return;
    setLoadingCalendar(true);
    try {
      const supabase = createClient();
      // Get all active reservas (only public data: dia, horario, tipo, estado, user_id)
      const { data } = await supabase
        .from('reservas')
        .select('dia, horario, tipo, estado, user_id')
        .in('estado', ['pendiente', 'confirmada']);
      setAllSlots(
        (data || []).map((r: { dia: string; horario: string; tipo: string; estado: string; user_id: string }) => ({
          dia: r.dia,
          horario: r.horario,
          tipo: (r.tipo ?? 'nutricion') as 'nutricion' | 'entrenamiento',
          estado: r.estado,
          isMine: r.user_id === userId,
        }))
      );
    } catch {
      setAllSlots([]);
    }
    setLoadingCalendar(false);
  };

  const handleCancelar = async (id: string) => {
    setCancelingId(id);
    const supabase = createClient();
    await supabase.from('reservas').update({ estado: 'cancelada' }).eq('id', id);
    await reload();
    setCancelingId(null);
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    const supabase = createClient();
    await supabase.from('profiles').update(profileForm).eq('id', userId);
    setProfile((prev) => prev ? { ...profileForm, avatar_url: prev.avatar_url } : profileForm);
    setEditingProfile(false);
    setSavingProfile(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Solo se aceptan imágenes JPG, PNG o WebP.'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('La imagen no debe superar 10 MB.'); return;
    }
    setAvatarError('');
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!userId) return;
    setCropSrc(null);
    setUploadingAvatar(true);
    setAvatarError('');
    const supabase = createClient();
    const path = `${userId}/avatar.jpg`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (upErr) { setAvatarError(`Error al subir: ${upErr.message}`); setUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    // Guardamos sin cache-bust para que persista igual en BD
    const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
    if (dbErr) { setAvatarError(`Error al guardar: ${dbErr.message}`); setUploadingAvatar(false); return; }
    // Cache-bust solo en el estado local para forzar recarga de imagen
    setProfile((prev) => prev ? { ...prev, avatar_url: `${publicUrl}?t=${Date.now()}` } : prev);
    setUploadingAvatar(false);
  };

  // Archive a cancelled cita (hide from user view)
  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      const res = await fetch(`/api/reservas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      if (res.ok) {
        await reload();
      }
    } catch {
      // silently fail
    }
    setArchivingId(null);
  };

  // Load calendar slots when tab changes to calendario
  useEffect(() => {
    if (tab === 'calendario' && allSlots.length === 0) loadCalendarSlots();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const proximas = reservas.filter(r => r.estado !== 'cancelada' && !r.archived);
  const historial = reservas.filter(r => r.estado === 'cancelada' && !r.archived);
  const hasNonArchivedCancelled = historial.length > 0;
  const proximasNutricion = proximas.filter(r => (r.tipo ?? 'nutricion') === 'nutricion');
  const proximasEntrenamiento = proximas.filter(r => r.tipo === 'entrenamiento');
  const nextCita = reservas.find(r => r.estado === 'confirmada') || reservas.find(r => r.estado === 'pendiente');
  const firstName = profile?.nombre?.split(' ')[0] || '';
  const initials = `${profile?.nombre?.[0] || ''}${profile?.apellido?.[0] || ''}`.toUpperCase() || '?';

  if (loading) return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EXPO_OUT }}
        style={{ width: '44px', height: '44px', border: '2px solid #1A2418', borderTopColor: '#F07820', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: EXPO_OUT }}
        style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', letterSpacing: '0.15em', color: 'rgba(240,240,240,0.3)', textTransform: 'uppercase' }}>Cargando tu panel</motion.p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808' }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid #1A2418', backgroundColor: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container-gnh" style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>

          {/* Left: logo + back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Image src="/emblema-gnh.svg" alt="GNH" width={100} height={40} style={{ objectFit: 'contain', height: '36px', width: 'auto' }} />
            </Link>
            <Link href="/"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.4)', textDecoration: 'none', transition: 'color 0.2s ease', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#28B44A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,240,240,0.4)')}>
              <ArrowLeft size={13} /> <span className="dash-back-label">Página de inicio</span>
            </Link>
          </div>

          {/* Right: avatar + name + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setTab('perfil')}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', transition: 'background 0.2s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(240,120,32,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(240,120,32,0.4) 0%, rgba(240,120,32,0.15) 100%)', border: '1px solid rgba(240,120,32,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 700, color: '#F07820', flexShrink: 0, overflow: 'hidden' }}>
                {profile?.avatar_url
                  ? <Image src={profile.avatar_url} alt="Avatar" width={72} height={72} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials}
              </div>
              <span className="dash-username" style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.75)', fontWeight: 500 }}>
                {profile?.nombre} {profile?.apellido}
              </span>
            </button>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#1A2418' }} />
            <button onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.45)', padding: '7px 14px', cursor: 'pointer', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', transition: 'all 0.3s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,107,107,0.4)'; e.currentTarget.style.color = '#FF6B6B'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.45)'; }}>
              <LogOut size={12} /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="container-gnh" style={{ paddingTop: '44px', paddingBottom: '100px' }}>

        {/* ── Bienvenida ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EXPO_OUT }}
          style={{ marginBottom: '40px' }}>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#F07820', marginBottom: '10px' }}>
            Tu panel
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 700, color: '#F0F0F0', lineHeight: 1.1, marginBottom: '12px' }}>
            {firstName ? `Bienvenido, ${firstName}.` : 'Tu panel de salud.'}
          </h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EXPO_OUT }}
            style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(240,240,240,0.4)', fontStyle: 'italic', lineHeight: 1.6 }}>
            {tip}
          </motion.p>
        </motion.div>

        {/* ── Proxima cita destacada ── */}
        <AnimatePresence>
          {nextCita && (
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.7, ease: EXPO_OUT }}
              style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(240,120,32,0.1) 0%, rgba(40,180,74,0.07) 100%)', border: `1px solid ${nextCita.estado === 'confirmada' ? 'rgba(40,180,74,0.35)' : 'rgba(240,120,32,0.3)'}`, padding: '28px 32px', marginBottom: '36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', boxShadow: nextCita.estado === 'confirmada' ? '0 4px 32px rgba(40,180,74,0.08)' : '0 4px 32px rgba(240,120,32,0.08)', transition: 'box-shadow 0.4s ease, transform 0.3s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: nextCita.estado === 'confirmada' ? '#28B44A' : '#F07820' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.15, ease: EXPO_OUT }}
                  style={{ width: '56px', height: '56px', borderRadius: '50%', background: nextCita.estado === 'confirmada' ? 'radial-gradient(circle at 30% 30%, rgba(40,180,74,0.25) 0%, rgba(40,180,74,0.08) 100%)' : 'radial-gradient(circle at 30% 30%, rgba(240,120,32,0.25) 0%, rgba(240,120,32,0.08) 100%)', border: `1px solid ${nextCita.estado === 'confirmada' ? 'rgba(40,180,74,0.35)' : 'rgba(240,120,32,0.35)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {nextCita.servicio.toLowerCase().includes('entrena') ? <Dumbbell size={24} color={nextCita.estado === 'confirmada' ? '#28B44A' : '#F07820'} /> : <Sparkles size={24} color={nextCita.estado === 'confirmada' ? '#28B44A' : '#F07820'} />}
                </motion.div>
                <div>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: nextCita.estado === 'confirmada' ? '#28B44A' : '#F07820', marginBottom: '6px' }}>
                    {nextCita.estado === 'confirmada' ? 'Proxima cita confirmada' : 'Proxima cita -- pendiente'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#F0F0F0', marginBottom: '6px' }}>
                    {nextCita.servicio}
                  </p>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(240,240,240,0.55)' }}>
                    {nextCita.dia} · {nextCita.horario}
                  </p>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: ESTADO[nextCita.estado].text, backgroundColor: ESTADO[nextCita.estado].bg, border: `1px solid ${ESTADO[nextCita.estado].border}`, padding: '8px 18px', fontWeight: 600 }}>
                {ESTADO[nextCita.estado].label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats ── */}
        <div className="dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '40px' }}>
          {[
            { label: 'Total', value: reservas.length, icon: CalendarCheck, color: '#F07820', sub: 'citas registradas' },
            { label: 'Confirmadas', value: reservas.filter(r => r.estado === 'confirmada').length, icon: CheckCircle, color: '#28B44A', sub: 'listas para asistir' },
            { label: 'Pendientes', value: reservas.filter(r => r.estado === 'pendiente').length, icon: Clock, color: '#F07820', sub: 'en espera de confirm.' },
            { label: 'Canceladas', value: reservas.filter(r => r.estado === 'cancelada').length, icon: XCircle, color: '#FF6B6B', sub: 'no se realizaron' },
          ].map(({ label, value, icon: Icon, color, sub }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: EXPO_OUT }}
              style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '28px 24px', position: 'relative', overflow: 'hidden', transition: 'border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease', boxShadow: '0 4px 24px rgba(40,180,74,0.04)' }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = color; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = `0 8px 32px ${color}18`; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = '#1A2418'; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 4px 24px rgba(40,180,74,0.04)'; }}>
              {/* Radial gradient background glow */}
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: color, opacity: value > 0 ? 0.8 : 0.2 }} />
              <Icon size={20} color={color} style={{ marginBottom: '14px', opacity: value > 0 ? 1 : 0.4 }} />
              <div style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '40px', fontWeight: 700, color: value > 0 ? '#F0F0F0' : 'rgba(240,240,240,0.3)', lineHeight: 1, marginBottom: '6px', letterSpacing: '-0.02em' }}>{value}</div>
              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: value > 0 ? color : 'rgba(240,240,240,0.25)', marginBottom: '6px', fontWeight: 600 }}>{label}</div>
              <div className="stat-sub" style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,240,240,0.3)', lineHeight: 1.5 }}>{sub}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs + boton ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
          <div className="dash-tabs-bar" style={{ display: 'flex', gap: '6px', padding: '4px', backgroundColor: 'rgba(15,18,8,0.8)', border: '1px solid #1A2418', borderRadius: '8px' }}>
            {([['proximas', 'Mis citas'], ['calendario', 'Calendario'], ['historial', 'Canceladas'], ['perfil', 'Mi perfil']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: tab === t ? 'rgba(240,120,32,0.15)' : 'transparent',
                  color: tab === t ? '#F07820' : 'rgba(240,240,240,0.4)',
                  fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase',
                  cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', whiteSpace: 'nowrap',
                  fontWeight: tab === t ? 600 : 400,
                  boxShadow: tab === t ? '0 2px 8px rgba(240,120,32,0.15)' : 'none',
                }}
                onMouseEnter={(e) => { if (tab !== t) e.currentTarget.style.backgroundColor = 'rgba(240,240,240,0.04)'; }}
                onMouseLeave={(e) => { if (tab !== t) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Limpiar canceladas button - only show in historial tab when there are cancelled citas */}
            {tab === 'historial' && hasNonArchivedCancelled && (
              <button onClick={() => setCleanMode(!cleanMode)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 18px', border: `1px solid ${cleanMode ? 'rgba(245,180,50,0.5)' : '#1A2418'}`, backgroundColor: cleanMode ? 'rgba(245,180,50,0.1)' : 'transparent', color: cleanMode ? '#F5B432' : 'rgba(240,240,240,0.45)', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}>
                <Trash2 size={12} /> Limpiar
              </button>
            )}
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-reservar'))}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 24px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background-color 0.3s ease', fontWeight: 600 }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FF8C35')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F07820')}>
              <Plus size={14} /> Nueva cita
            </button>
          </div>
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">

          {/* Citas */}
          {(tab === 'proximas' || tab === 'historial') && (
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {(tab === 'proximas' ? proximas : historial).length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EXPO_OUT }}
                  style={{ textAlign: 'center', padding: '80px 32px', border: '1px solid #1A2418', backgroundColor: '#090C08', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 24px rgba(40,180,74,0.04)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 50% at 50% 80%, rgba(240,120,32,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: EXPO_OUT }}
                    style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, rgba(240,120,32,0.12) 0%, rgba(240,120,32,0.04) 100%)', border: '1px solid rgba(240,120,32,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <CalendarCheck size={32} color="rgba(240,120,32,0.45)" />
                  </motion.div>
                  <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#F0F0F0', marginBottom: '12px' }}>
                    {tab === 'proximas' ? 'Sin citas activas' : 'Sin cancelaciones'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(240,240,240,0.35)', marginBottom: '32px', maxWidth: '340px', margin: '0 auto 32px', lineHeight: 1.7 }}>
                    {tab === 'proximas'
                      ? 'Aun no tienes citas agendadas. Da el primer paso hacia tu transformacion.'
                      : 'No tienes citas canceladas. Excelente constancia!'}
                  </p>
                  {tab === 'proximas' && (
                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.3, ease: EXPO_OUT }}
                      onClick={() => window.dispatchEvent(new CustomEvent('open-reservar'))}
                      style={{ padding: '14px 36px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, transition: 'background-color 0.3s ease, transform 0.2s ease', borderRadius: '4px' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FF8C35'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F07820'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                      Agendar mi primera cita
                    </motion.button>
                  )}
                </motion.div>
              ) : tab === 'historial' ? (
                // Historial de canceladas
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Clean mode notice */}
                  <AnimatePresence>
                    {cleanMode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ padding: '12px 18px', backgroundColor: 'rgba(245,180,50,0.06)', border: '1px solid rgba(245,180,50,0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Trash2 size={14} color="#F5B432" />
                        <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: '#F5B432' }}>
                          Modo limpiar activo -- Oculta las citas canceladas que ya no necesitas ver
                        </span>
                        <button onClick={() => setCleanMode(false)}
                          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(245,180,50,0.6)', cursor: 'pointer', padding: '2px' }}>
                          <X size={14} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {historial.map((r, i) => {
                    const est = ESTADO[r.estado];
                    return (
                      <motion.div key={r.id}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: i * 0.07, ease: EXPO_OUT }}
                        style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#090C08', border: `1px solid ${cleanMode ? 'rgba(245,180,50,0.25)' : '#1A2418'}`, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', transition: 'border-color 0.3s ease, transform 0.3s ease', boxShadow: '0 2px 16px rgba(0,0,0,0.1)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: est.bar, opacity: 0.6 }} />
                        <div className="dash-cita-fields" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', flex: 1, paddingLeft: '10px' }}>
                          {[['Servicio', r.servicio, true], ['Dia', r.dia, false], ['Horario', r.horario, false]].map(([label, val, bold]) => (
                            <div key={String(label)}>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '6px' }}>{label}</div>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: '#F0F0F0', fontWeight: bold ? 600 : 400 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: est.text, backgroundColor: est.bg, border: `1px solid ${est.border}`, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                            {est.label}
                          </span>
                          {cleanMode && (
                            <button
                              onClick={() => handleArchive(r.id)}
                              disabled={archivingId === r.id}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', backgroundColor: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.35)', color: '#FF6B6B', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: archivingId === r.id ? 'default' : 'pointer', transition: 'all 0.2s ease', fontWeight: 600, whiteSpace: 'nowrap' }}
                              onMouseEnter={(e) => { if (archivingId !== r.id) e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.22)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.12)'; }}>
                              {archivingId === r.id ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <X size={11} />}
                              {archivingId === r.id ? '...' : 'Ocultar'}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                // Próximas — agrupadas por tipo
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {[
                    { tipoKey: 'nutricion',     label: '🥗 Nutrición',     color: '#F07820', bgColor: 'rgba(240,120,32,0.08)', borderColor: 'rgba(240,120,32,0.2)', citas: proximasNutricion },
                    { tipoKey: 'entrenamiento', label: '🏋️ Entrenamiento', color: '#28B44A', bgColor: 'rgba(40,180,74,0.08)',  borderColor: 'rgba(40,180,74,0.2)',  citas: proximasEntrenamiento },
                  ].filter(g => g.citas.length > 0).map((grupo) => (
                    <div key={grupo.tipoKey}>
                      {/* Encabezado de sección */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${grupo.borderColor}` }}>
                        <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: grupo.color, fontWeight: 600 }}>
                          {grupo.label}
                        </span>
                        <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(240,240,240,0.3)', backgroundColor: grupo.bgColor, border: `1px solid ${grupo.borderColor}`, padding: '2px 8px' }}>
                          {grupo.citas.length} cita{grupo.citas.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {grupo.citas.map((r, i) => {
                          const est = ESTADO[r.estado];
                          return (
                            <motion.div key={r.id}
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.45, delay: i * 0.07, ease: EXPO_OUT }}
                              style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', transition: 'border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease', boxShadow: '0 2px 16px rgba(40,180,74,0.03)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = est.bar + '55'; e.currentTarget.style.boxShadow = `0 4px 24px ${est.bar}12`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(40,180,74,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: est.bar, opacity: 0.7 }} />
                              <div className="dash-cita-fields" style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', flex: 1, paddingLeft: '10px' }}>
                                {[
                                  ['Servicio', r.servicio, true],
                                  ['Dia', r.dia, false],
                                  ['Horario', r.horario, false],
                                  ['Objetivo', r.objetivo, false],
                                ].map(([label, val, bold]) => (
                                  <div key={String(label)}>
                                    <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '6px' }}>{label}</div>
                                    <div style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: '#F0F0F0', fontWeight: bold ? 600 : 400, lineHeight: 1.4 }}>{val}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: est.text, backgroundColor: est.bg, border: `1px solid ${est.border}`, padding: '6px 14px', whiteSpace: 'nowrap', fontWeight: 600, borderRadius: '4px' }}>
                                  {est.label}
                                </span>
                                {(r.estado === 'pendiente' || r.estado === 'confirmada') && (
                                  confirmCancel === r.id ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', backgroundColor: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)' }}>
                                      <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(240,240,240,0.6)' }}>¿Cancelar cita?</span>
                                      <button onClick={() => { setConfirmCancel(null); handleCancelar(r.id); }} disabled={cancelingId === r.id}
                                        style={{ padding: '4px 10px', backgroundColor: '#FF6B6B', border: 'none', color: '#080808', fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                        {cancelingId === r.id ? '...' : 'Sí'}
                                      </button>
                                      <button onClick={() => setConfirmCancel(null)}
                                        style={{ padding: '4px 10px', backgroundColor: 'transparent', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.5)', fontFamily: 'var(--font-inter)', fontSize: '10px', cursor: 'pointer' }}>
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setConfirmCancel(r.id)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.08)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                                      <X size={11} /> Cancelar
                                    </button>
                                  )
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Calendario */}
          {tab === 'calendario' && (
            <motion.div key="calendario" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#F0F0F0', marginBottom: '4px' }}>
                    Disponibilidad semanal
                  </h2>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.35)' }}>
                    Consulta los horarios ocupados y tus citas agendadas
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0' }}>
                  {([
                    ['todas', 'Todas'],
                    ['nutricion', 'Nutricion'],
                    ['entrenamiento', 'Entrenamiento'],
                  ] as ['todas' | 'nutricion' | 'entrenamiento', string][]).map(([t, label], i) => (
                    <button key={t} onClick={() => setCalDashFilter(t)}
                      style={{
                        padding: '8px 16px',
                        border: `1px solid ${calDashFilter === t ? '#28B44A' : '#1A2418'}`,
                        marginLeft: i > 0 ? '-1px' : 0,
                        position: 'relative', zIndex: calDashFilter === t ? 1 : 0,
                        backgroundColor: calDashFilter === t ? 'rgba(40,180,74,0.1)' : '#090C08',
                        color: calDashFilter === t ? '#28B44A' : 'rgba(240,240,240,0.45)',
                        fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
                        cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingCalendar ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '10px' }}>
                  <Loader2 size={20} color="#F07820" style={{ animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.4)' }}>Cargando calendario...</span>
                </div>
              ) : (
                <WeeklyCalendar
                  slots={allSlots}
                  mode="view"
                  tipoFilter={calDashFilter}
                  onSelectSlot={(dia, horario) => {
                    // If clicking on an empty slot, open reservar modal
                    const taken = allSlots.some(s => s.dia === dia && s.horario === horario);
                    if (!taken) {
                      window.dispatchEvent(new CustomEvent('open-reservar'));
                    }
                  }}
                />
              )}

              <div style={{ marginTop: '16px', padding: '14px 20px', backgroundColor: '#090C08', border: '1px solid #1A2418', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarDays size={15} color="rgba(240,240,240,0.3)" />
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.35)' }}>
                  Haz clic en un horario libre para reservar una nueva cita.
                </p>
              </div>
            </motion.div>
          )}

          {/* Perfil */}
          {tab === 'perfil' && (
            <motion.div key="perfil" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className="dash-profile-card" style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', maxWidth: '620px', overflow: 'hidden', boxShadow: '0 4px 32px rgba(40,180,74,0.05)' }}>

                {/* Profile hero */}
                <div style={{ background: 'linear-gradient(135deg, rgba(240,120,32,0.12) 0%, rgba(40,180,74,0.06) 100%)', borderBottom: '1px solid #1A2418', padding: '32px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <label htmlFor="avatar-upload" style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0, cursor: 'pointer' }}
                      title="Cambiar foto de perfil">
                      <div className="avatar-ring" style={{ width: '72px', height: '72px', borderRadius: '50%', background: profile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, rgba(240,120,32,0.5) 0%, rgba(240,120,32,0.2) 100%)', border: '2px solid rgba(240,120,32,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'border-color 0.2s ease' }}>
                        {uploadingAvatar ? (
                          <div style={{ width: '22px', height: '22px', border: '2px solid rgba(240,120,32,0.3)', borderTopColor: '#F07820', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        ) : profile?.avatar_url ? (
                          <Image src={profile.avatar_url} alt="Avatar" width={72} height={72} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#F07820' }}>{initials}</span>
                        )}
                      </div>
                      {/* Overlay cámara */}
                      {!uploadingAvatar && (
                        <div className="avatar-overlay" style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: 'rgba(8,8,8,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s ease' }}>
                          <Camera size={18} color="#F0F0F0" />
                        </div>
                      )}
                      <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
                    </label>
                    <div>
                      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.35)', marginBottom: '4px' }}>Perfil del usuario</p>
                      <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#F0F0F0', lineHeight: 1.1 }}>
                        {profile?.nombre} {profile?.apellido}
                      </p>
                      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.4)', marginTop: '2px' }}>{profile?.email}</p>
                      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,120,32,0.6)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Camera size={11} /> Toca el avatar para cambiar la foto
                      </p>
                      {avatarError && <p style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: '#FF6B6B', marginTop: '4px' }}>{avatarError}</p>}
                    </div>
                  </div>
                  {!editingProfile ? (
                    <button onClick={() => setEditingProfile(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', border: '1px solid rgba(240,120,32,0.3)', background: 'rgba(240,120,32,0.08)', color: '#F07820', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(240,120,32,0.15)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(240,120,32,0.08)'; }}>
                      <Edit2 size={12} /> Editar perfil
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setEditingProfile(false); setProfileForm(profile!); }}
                        style={{ padding: '9px 14px', border: '1px solid #1A2418', background: 'transparent', color: 'rgba(240,240,240,0.45)', fontFamily: 'var(--font-inter)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <X size={12} /> Cancelar
                      </button>
                      <button onClick={handleSaveProfile} disabled={savingProfile}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', border: 'none', backgroundColor: '#28B44A', color: '#080808', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700 }}>
                        <Save size={12} /> {savingProfile ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Fields */}
                <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Nombre + Apellido */}
                  <div>
                    <p style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '12px' }}>Información personal</p>
                    <div className="dash-name-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {([['nombre', 'Nombre', 'text', User], ['apellido', 'Apellido', 'text', User]] as [keyof Profile, string, string, React.ElementType][]).map(([field, label, type, Icon]) => (
                        <div key={field}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.38)', marginBottom: '7px' }}>
                            <Icon size={10} /> {label}
                          </label>
                          {editingProfile ? (
                            <input type={type} value={profileForm[field]}
                              onChange={(e) => setProfileForm({ ...profileForm, [field]: e.target.value })}
                              style={inputStyle}
                              onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                              onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
                          ) : (
                            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: '#F0F0F0', padding: '10px 0', borderBottom: '1px solid #1A2418' }}>{profile?.[field] || '—'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: '1px', backgroundColor: '#1A2418' }} />

                  {/* Contacto */}
                  <div>
                    <p style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '12px' }}>Contacto</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {([
                        ['email', 'Correo electrónico', 'email', Mail, true],
                        ['telefono', 'WhatsApp / Teléfono', 'tel', Phone, false],
                      ] as [keyof Profile, string, string, React.ElementType, boolean][]).map(([field, label, type, Icon, readOnly]) => (
                        <div key={field}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.38)', marginBottom: '7px' }}>
                            <Icon size={10} /> {label}
                          </label>
                          {editingProfile && !readOnly ? (
                            <input type={type} value={profileForm[field]}
                              onChange={(e) => setProfileForm({ ...profileForm, [field]: e.target.value })}
                              style={inputStyle}
                              onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                              onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: readOnly ? 'rgba(240,240,240,0.38)' : '#F0F0F0', padding: '10px 0', borderBottom: '1px solid #1A2418', flex: 1 }}>
                                {profile?.[field] || '—'}
                              </p>
                              {readOnly && <span style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.1em', color: 'rgba(240,240,240,0.2)', textTransform: 'uppercase', marginLeft: '10px' }}>No editable</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Crop modal */}
      {cropSrc && (
        <AvatarCrop
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        label[for="avatar-upload"]:hover .avatar-overlay { opacity: 1 !important; }
        label[for="avatar-upload"]:hover .avatar-ring { border-color: #F07820 !important; }
        @media (max-width: 768px) {
          .dash-stats { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .dash-cita-fields { gap: 18px !important; }
        }
        @media (max-width: 640px) {
          .dash-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .stat-sub { display: none; }
        }
        @media (max-width: 480px) {
          .dash-username { display: none; }
          .dash-back-label { display: none; }
          .dash-tabs-bar { overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 3px !important; border-radius: 6px !important; }
          .dash-tabs-bar::-webkit-scrollbar { display: none; }
          .dash-tabs-bar button { white-space: nowrap; font-size: 10px !important; padding: 8px 12px !important; border-radius: 4px !important; }
          .dash-profile-card { max-width: 100% !important; }
          .dash-name-grid { grid-template-columns: 1fr !important; }
          .dash-cita-fields { gap: 14px !important; flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

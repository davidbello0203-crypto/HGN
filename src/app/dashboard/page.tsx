'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import {
  CalendarCheck, Clock, CheckCircle, XCircle, LogOut, Plus,
  User, Phone, Mail, Edit2, Save, X, ArrowLeft, Dumbbell, Sparkles, Camera,
} from 'lucide-react';
import AvatarCrop from '@/components/ui/AvatarCrop';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

type Reserva = {
  id: string;
  servicio: string;
  dia: string;
  horario: string;
  objetivo: string;
  notas: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  created_at: string;
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

type Tab = 'proximas' | 'historial' | 'perfil';

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
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
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

  const proximas = reservas.filter(r => r.estado !== 'cancelada');
  const historial = reservas.filter(r => r.estado === 'cancelada');
  const nextCita = reservas.find(r => r.estado === 'confirmada') || reservas.find(r => r.estado === 'pendiente');
  const firstName = profile?.nombre?.split(' ')[0] || '';
  const initials = `${profile?.nombre?.[0] || ''}${profile?.apellido?.[0] || ''}`.toUpperCase() || '?';

  if (loading) return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <div style={{ width: '36px', height: '36px', border: '2px solid #1A2418', borderTopColor: '#F07820', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', letterSpacing: '0.15em', color: 'rgba(240,240,240,0.3)', textTransform: 'uppercase' }}>Cargando tu panel</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808' }}>

      {/* ── Header ── */}
      <header style={{ borderBottom: '1px solid #1A2418', backgroundColor: 'rgba(8,8,8,0.97)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container-gnh" style={{ height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>

          {/* Left: logo + back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Image src="/logo-gnh.png" alt="GNH" width={100} height={40} style={{ objectFit: 'contain', height: '36px', width: 'auto' }} />
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

      <div className="container-gnh" style={{ paddingTop: '36px', paddingBottom: '80px' }}>

        {/* ── Bienvenida ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EXPO_OUT }}
          style={{ marginBottom: '32px' }}>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#F07820', marginBottom: '6px' }}>
            Tu panel
          </p>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#F0F0F0', lineHeight: 1.1, marginBottom: '8px' }}>
            {firstName ? `Bienvenido, ${firstName}.` : 'Tu panel de salud.'}
          </h1>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.4)', fontStyle: 'italic' }}>
            {tip}
          </p>
        </motion.div>

        {/* ── Próxima cita destacada ── */}
        <AnimatePresence>
          {nextCita && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EXPO_OUT }}
              style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(240,120,32,0.1) 0%, rgba(40,180,74,0.07) 100%)', border: `1px solid ${nextCita.estado === 'confirmada' ? 'rgba(40,180,74,0.35)' : 'rgba(240,120,32,0.3)'}`, padding: '24px 28px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', backgroundColor: nextCita.estado === 'confirmada' ? '#28B44A' : '#F07820' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: nextCita.estado === 'confirmada' ? 'rgba(40,180,74,0.15)' : 'rgba(240,120,32,0.15)', border: `1px solid ${nextCita.estado === 'confirmada' ? 'rgba(40,180,74,0.3)' : 'rgba(240,120,32,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {nextCita.servicio.toLowerCase().includes('entrena') ? <Dumbbell size={22} color={nextCita.estado === 'confirmada' ? '#28B44A' : '#F07820'} /> : <Sparkles size={22} color={nextCita.estado === 'confirmada' ? '#28B44A' : '#F07820'} />}
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: nextCita.estado === 'confirmada' ? '#28B44A' : '#F07820', marginBottom: '4px' }}>
                    {nextCita.estado === 'confirmada' ? '✓ Próxima cita confirmada' : 'Próxima cita — pendiente'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#F0F0F0', marginBottom: '4px' }}>
                    {nextCita.servicio}
                  </p>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.55)' }}>
                    {nextCita.dia} · {nextCita.horario}
                  </p>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: ESTADO[nextCita.estado].text, backgroundColor: ESTADO[nextCita.estado].bg, border: `1px solid ${ESTADO[nextCita.estado].border}`, padding: '7px 16px' }}>
                {ESTADO[nextCita.estado].label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats ── */}
        <div className="dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
          {[
            { label: 'Total', value: reservas.length, icon: CalendarCheck, color: '#F07820', sub: 'citas registradas' },
            { label: 'Confirmadas', value: reservas.filter(r => r.estado === 'confirmada').length, icon: CheckCircle, color: '#28B44A', sub: 'listas para asistir' },
            { label: 'Pendientes', value: reservas.filter(r => r.estado === 'pendiente').length, icon: Clock, color: '#F07820', sub: 'en espera de confirm.' },
            { label: 'Canceladas', value: reservas.filter(r => r.estado === 'cancelada').length, icon: XCircle, color: '#FF6B6B', sub: 'no se realizaron' },
          ].map(({ label, value, icon: Icon, color, sub }, i) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: EXPO_OUT }}
              style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '20px', position: 'relative', overflow: 'hidden', transition: 'border-color 0.3s ease, transform 0.3s ease' }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = color; el.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = '#1A2418'; el.style.transform = 'translateY(0)'; }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: color, opacity: value > 0 ? 0.7 : 0.2 }} />
              <Icon size={16} color={color} style={{ marginBottom: '10px', opacity: value > 0 ? 1 : 0.4 }} />
              <div style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '32px', fontWeight: 700, color: value > 0 ? '#F0F0F0' : 'rgba(240,240,240,0.3)', lineHeight: 1, marginBottom: '4px' }}>{value}</div>
              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: value > 0 ? color : 'rgba(240,240,240,0.25)', marginBottom: '4px', fontWeight: 600 }}>{label}</div>
              <div className="stat-sub" style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,240,240,0.3)', lineHeight: 1.4 }}>{sub}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Tabs + botón ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="dash-tabs-bar" style={{ display: 'flex', gap: '0' }}>
            {([['proximas', 'Mis citas'], ['historial', 'Canceladas'], ['perfil', 'Mi perfil']] as [Tab, string][]).map(([t, label], i) => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  padding: '10px 20px',
                  border: `1px solid ${tab === t ? '#F07820' : '#1A2418'}`,
                  marginLeft: i > 0 ? '-1px' : 0,
                  position: 'relative',
                  zIndex: tab === t ? 1 : 0,
                  backgroundColor: tab === t ? 'rgba(240,120,32,0.1)' : 'transparent',
                  color: tab === t ? '#F07820' : 'rgba(240,240,240,0.4)',
                  fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase',
                  cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-reservar'))}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 24px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', transition: 'background-color 0.3s ease', fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FF8C35')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F07820')}>
            <Plus size={14} /> Nueva cita
          </button>
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">

          {/* Citas */}
          {(tab === 'proximas' || tab === 'historial') && (
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {(tab === 'proximas' ? proximas : historial).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '72px 24px', border: '1px solid #1A2418', backgroundColor: '#090C08', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 50% at 50% 80%, rgba(240,120,32,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(240,120,32,0.07)', border: '1px solid rgba(240,120,32,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <CalendarCheck size={28} color="rgba(240,120,32,0.4)" />
                  </div>
                  <p style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#F0F0F0', marginBottom: '8px' }}>
                    {tab === 'proximas' ? 'Sin citas activas' : 'Sin cancelaciones'}
                  </p>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.35)', marginBottom: '28px', maxWidth: '320px', margin: '0 auto 28px', lineHeight: 1.7 }}>
                    {tab === 'proximas'
                      ? 'Aún no tienes citas agendadas. Da el primer paso hacia tu transformación.'
                      : 'No tienes citas canceladas. ¡Excelente constancia!'}
                  </p>
                  {tab === 'proximas' && (
                    <button onClick={() => window.dispatchEvent(new CustomEvent('open-reservar'))}
                      style={{ padding: '13px 32px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, transition: 'background-color 0.3s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FF8C35')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F07820')}>
                      Agendar mi primera cita →
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(tab === 'proximas' ? proximas : historial).map((r, i) => {
                    const est = ESTADO[r.estado];
                    return (
                      <motion.div key={r.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.06, ease: EXPO_OUT }}
                        style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', transition: 'border-color 0.3s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = est.bar + '55')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1A2418')}>
                        {/* Left accent bar */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', backgroundColor: est.bar, opacity: 0.6 }} />
                        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', flex: 1, paddingLeft: '8px' }}>
                          {[
                            ['Servicio', r.servicio, true],
                            ['Día', r.dia, false],
                            ['Horario', r.horario, false],
                            ['Objetivo', r.objetivo, false],
                          ].map(([label, val, bold]) => (
                            <div key={String(label)}>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '4px' }}>{label}</div>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#F0F0F0', fontWeight: bold ? 500 : 400 }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: est.text, backgroundColor: est.bg, border: `1px solid ${est.border}`, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                            {est.label}
                          </span>
                          {r.estado === 'pendiente' && (
                            <button onClick={() => handleCancelar(r.id)} disabled={cancelingId === r.id}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.08)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                              <X size={11} /> {cancelingId === r.id ? '...' : 'Cancelar'}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* Perfil */}
          {tab === 'perfil' && (
            <motion.div key="perfil" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div className="dash-profile-card" style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', maxWidth: '580px', overflow: 'hidden' }}>

                {/* Profile hero */}
                <div style={{ background: 'linear-gradient(135deg, rgba(240,120,32,0.12) 0%, rgba(40,180,74,0.06) 100%)', borderBottom: '1px solid #1A2418', padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
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
                <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
        @media (max-width: 640px) {
          .dash-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .stat-sub { display: none; }
        }
        @media (max-width: 480px) {
          .dash-username { display: none; }
          .dash-back-label { display: none; }
          .dash-tabs-bar { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px; }
          .dash-tabs-bar::-webkit-scrollbar { display: none; }
          .dash-tabs-bar button { white-space: nowrap; font-size: 10px !important; padding: 9px 14px !important; }
          .dash-profile-card { max-width: 100% !important; }
          .dash-name-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

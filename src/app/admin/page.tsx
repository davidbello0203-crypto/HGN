'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CalendarCheck, Users, Clock, CheckCircle, XCircle, MessageCircle, LogOut, Search, Download, Edit2, Save, X, TrendingUp, Filter, CalendarDays, Plus, Loader2, Trash2 } from 'lucide-react';
import WeeklyCalendar, { type CalSlot, DIAS_SEMANA, DIAS_FINDE, HORARIOS_NUTRI_SEMANA, HORARIOS_NUTRI_FINDE, HORARIOS_ENTRENA } from '@/components/ui/WeeklyCalendar';

const DIAS = [...DIAS_SEMANA, ...DIAS_FINDE];

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

type Reserva = {
  id: string;
  user_id: string;
  servicio: string;
  tipo: 'nutricion' | 'entrenamiento';
  dia: string;
  horario: string;
  objetivo: string;
  notas: string;
  notas_admin: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  created_at: string;
  archived?: boolean;
  guest_name?: string;
  guest_phone?: string;
  profiles: { nombre: string; apellido: string; email: string; telefono: string; avatar_url?: string | null };
};

type Cliente = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  created_at: string;
  total_citas: number;
  confirmadas: number;
};

const ESTADO_COLORS = {
  pendiente:  { bg: 'rgba(240,120,32,0.12)',  border: 'rgba(240,120,32,0.3)',  text: '#F07820' },
  confirmada: { bg: 'rgba(40,180,74,0.12)',   border: 'rgba(40,180,74,0.3)',   text: '#28B44A' },
  cancelada:  { bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.2)', text: '#FF6B6B' },
};

type Tab = 'citas' | 'clientes' | 'estadisticas' | 'calendario';
type FilterEstado = 'todas' | 'pendiente' | 'confirmada' | 'cancelada';
type FilterTipo = 'todas' | 'nutricion' | 'entrenamiento';

// Services for guest booking
const SERVICIOS_NUTRICION = [
  'Consulta de nutricion (Primera vez)',
  'Consulta de nutricion (Seguimiento)',
];
const SERVICIOS_ENTRENAMIENTO = [
  'Sesion de entrenamiento personalizado',
  'Sesion de entrenamiento grupal',
];

export default function AdminPage() {
  const router = useRouter();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('citas');
  const [filter, setFilter] = useState<FilterEstado>('todas');
  const [tipoFilter, setTipoFilter] = useState<FilterTipo>('todas');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'confirmada' | 'cancelada' } | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [calTipoFilter, setCalTipoFilter] = useState<'todas' | 'nutricion' | 'entrenamiento'>('todas');
  const [calSelectedSlot, setCalSelectedSlot] = useState<{ dia: string; horario: string } | null>(null);
  const [detailReserva, setDetailReserva] = useState<Reserva | null>(null);
  const [detailNoteText, setDetailNoteText] = useState('');
  const [detailEditingNote, setDetailEditingNote] = useState(false);

  // Feature 1: Cita Improvisada
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestForm, setGuestForm] = useState({
    nombre: '', celular: '', dia: DIAS_SEMANA[0], horario: HORARIOS_ENTRENA[0], tipo: 'entrenamiento' as 'nutricion' | 'entrenamiento', objetivo: '',
  });
  const [guestSaving, setGuestSaving] = useState(false);
  const [guestSuccess, setGuestSuccess] = useState(false);
  const [guestError, setGuestError] = useState('');

  // Feature 2: Modo Limpiar
  const [cleanMode, setCleanMode] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: res } = await supabase
      .from('reservas')
      .select('*, profiles(nombre, apellido, email, telefono, avatar_url)')
      .order('created_at', { ascending: false });

    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    setReservas(res || []);

    if (profs) {
      const clientesConStats = profs.map(p => {
        const citasCliente = (res || []).filter(r => r.user_id === p.id);
        return {
          ...p,
          total_citas: citasCliente.length,
          confirmadas: citasCliente.filter(r => r.estado === 'confirmada').length,
        };
      });
      setClientes(clientesConStats);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(); // eslint-disable-line react-hooks/set-state-in-effect

    // Real-time: escuchar nuevas reservas
    const supabase = createClient();
    const channel = supabase
      .channel('reservas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        loadData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const updateEstado = async (id: string, estado: 'confirmada' | 'cancelada') => {
    setUpdating(id);
    const supabase = createClient();
    await supabase.from('reservas').update({ estado }).eq('id', id);
    if (estado === 'confirmada') {
      await fetch('/api/email/confirmacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: id }),
      });
    }
    await loadData();
    setUpdating(null);
  };

  const saveNota = async (id: string) => {
    const supabase = createClient();
    await supabase.from('reservas').update({ notas_admin: noteText }).eq('id', id);
    await loadData();
    setEditingNote(null);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const exportCSV = () => {
    const headers = ['Nombre', 'Email', 'Telefono', 'Tipo', 'Servicio', 'Dia', 'Horario', 'Objetivo', 'Estado', 'Fecha', 'Invitado', 'Celular invitado'];
    const rows = reservas.map(r => [
      r.guest_name || `${r.profiles?.nombre} ${r.profiles?.apellido}`,
      r.guest_name ? '(invitado)' : r.profiles?.email,
      r.guest_phone || r.profiles?.telefono || '',
      r.tipo || 'nutricion',
      r.servicio, r.dia, r.horario, r.objetivo, r.estado,
      new Date(r.created_at).toLocaleDateString('es-MX'),
      r.guest_name ? 'Si' : 'No',
      r.guest_phone || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'citas-gnh.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const waLink = (r: Reserva) => {
    const isGuest = !!r.guest_name;
    const name = isGuest ? r.guest_name : r.profiles?.nombre;
    const phone = isGuest ? r.guest_phone?.replace(/\D/g, '') : r.profiles?.telefono?.replace(/\D/g, '');
    const msg = `Hola ${name}! Tu cita esta *confirmada*.\n\n*Detalles:*\n- Servicio: ${r.servicio}\n- Dia: ${r.dia}\n- Horario: ${r.horario}\n\nTe esperamos! -- Bryan GNH`;
    return `https://wa.me/52${phone}?text=${encodeURIComponent(msg)}`;
  };

  // Archive a reservation (clean mode)
  const handleArchive = async (id: string) => {
    setArchiving(id);
    try {
      const res = await fetch(`/api/reservas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      });
      if (res.ok) {
        setReservas(prev => prev.filter(r => r.id !== id));
      }
    } catch {
      // silently fail
    }
    setArchiving(null);
  };

  // Delete a reservation permanently (admin only)
  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/reservas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirmId(null);
        setReservas(prev => prev.filter(r => r.id !== id));
      } else {
        const json = await res.json().catch(() => ({}));
        console.error('Delete failed:', res.status, json.error);
        alert(`Error al eliminar: ${json.error || res.status}`);
      }
    } catch (err) {
      console.error('Delete exception:', err);
    }
    setDeleting(null);
  };

  // Guest booking
  const handleGuestSubmit = async () => {
    if (!guestForm.nombre.trim() || !guestForm.celular.trim()) {
      setGuestError('Nombre y celular son requeridos');
      return;
    }
    setGuestSaving(true);
    setGuestError('');
    try {
      const servicio = guestForm.tipo === 'entrenamiento'
        ? SERVICIOS_ENTRENAMIENTO[0]
        : SERVICIOS_NUTRICION[0];

      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servicio,
          tipo: guestForm.tipo,
          dia: guestForm.dia,
          horario: guestForm.horario,
          objetivo: guestForm.objetivo || 'No especificado',
          guest_name: guestForm.nombre.trim(),
          guest_phone: guestForm.celular.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGuestError(data.error || 'Error al crear la cita');
      } else {
        setGuestSuccess(true);
        await loadData();
      }
    } catch {
      setGuestError('Error de conexion');
    }
    setGuestSaving(false);
  };

  const resetGuestModal = () => {
    setShowGuestModal(false);
    setGuestSuccess(false);
    setGuestError('');
    setGuestForm({ nombre: '', celular: '', dia: DIAS_SEMANA[0], horario: HORARIOS_ENTRENA[0], tipo: 'entrenamiento', objetivo: '' });
  };

  // Stats use ALL reservas (including archived) for accurate counts
  const stats = {
    total: reservas.length,
    pendientes: reservas.filter(r => r.estado === 'pendiente').length,
    confirmadas: reservas.filter(r => r.estado === 'confirmada').length,
    clientes: new Set(reservas.map(r => r.user_id)).size,
    nutricion: reservas.filter(r => (r.tipo ?? 'nutricion') === 'nutricion').length,
    entrenamiento: reservas.filter(r => r.tipo === 'entrenamiento').length,
  };

  // Chart data -- citas por servicio
  const servicioCount = reservas.reduce((acc, r) => {
    const key = r.servicio.split('(')[0].trim().slice(0, 20);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const chartData = Object.entries(servicioCount).map(([name, value]) => ({ name, value }));

  // Chart data -- citas por estado
  const estadoData = [
    { name: 'Pendientes', value: stats.pendientes, color: '#F07820' },
    { name: 'Confirmadas', value: stats.confirmadas, color: '#28B44A' },
    { name: 'Canceladas', value: reservas.filter(r => r.estado === 'cancelada').length, color: '#FF6B6B' },
  ];

  // Filtered list EXCLUDES archived for display
  const filtered = reservas.filter(r => {
    // Hide archived from list view
    if (r.archived) return false;
    const matchEstado = filter === 'todas' || r.estado === filter;
    const matchTipo = tipoFilter === 'todas' || (r.tipo ?? 'nutricion') === tipoFilter;
    const nombre = r.guest_name || `${r.profiles?.nombre} ${r.profiles?.apellido}`;
    const email = r.guest_name ? '' : r.profiles?.email || '';
    const matchSearch = !search || `${nombre} ${email}`.toLowerCase().includes(search.toLowerCase());
    return matchEstado && matchTipo && matchSearch;
  });

  const clientesFiltrados = clientes.filter(c =>
    !search || `${c.nombre} ${c.apellido} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const citasDelCliente = selectedCliente
    ? reservas.filter(r => r.user_id === selectedCliente.id && !r.archived)
    : [];

  // Helper: display name for a reserva
  const displayName = (r: Reserva) =>
    r.guest_name || `${r.profiles?.nombre || ''} ${r.profiles?.apellido || ''}`.trim();

  const displayContact = (r: Reserva) =>
    r.guest_name ? (r.guest_phone || 'Sin celular') : (r.profiles?.email || '');

  // Input style for modals
  const modalInputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#0F1208', border: '1px solid #1A2418',
    color: '#F0F0F0', fontFamily: 'var(--font-inter), system-ui, sans-serif',
    fontSize: '14px', padding: '12px 14px', outline: 'none', borderRadius: 0,
    transition: 'border-color 0.3s ease',
  };

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
        style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', letterSpacing: '0.15em', color: 'rgba(240,240,240,0.3)', textTransform: 'uppercase' }}>Panel de administracion</motion.p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808' }}>
      {/* Navbar */}
      <header style={{ borderBottom: '1px solid #1A2418', backgroundColor: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container-gnh" style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/"><Image src="/emblema-gnh.svg" alt="GNH" width={100} height={40} style={{ objectFit: 'contain', height: '36px', width: 'auto' }} /></Link>
            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#F07820', border: '1px solid rgba(240,120,32,0.3)', padding: '3px 8px' }}>Admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={exportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.55)', padding: '7px 14px', cursor: 'pointer', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'all 0.3s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#28B44A'; e.currentTarget.style.color = '#28B44A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.55)'; }}>
              <Download size={12} /> <span className="admin-csv-label">Exportar CSV</span>
            </button>
            <button onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.55)', padding: '7px 14px', cursor: 'pointer', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'all 0.3s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F0F0F0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.55)'; }}>
              <LogOut size={13} /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="container-gnh" style={{ paddingTop: '44px', paddingBottom: '100px' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EXPO_OUT }} style={{ marginBottom: '40px' }}>
          <p className="eyebrow" style={{ marginBottom: '10px', display: 'block', fontSize: '11px' }}>Panel de control</p>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: 'clamp(26px, 5vw, 36px)', fontWeight: 700, color: '#F0F0F0' }}>Administracion GNH</h1>
        </motion.div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '40px' }} className="admin-stats">
          {[
            { label: 'Total citas', value: stats.total, icon: CalendarCheck, color: '#F07820' },
            { label: 'Clientes', value: stats.clientes, icon: Users, color: '#F07820' },
            { label: 'Pendientes', value: stats.pendientes, icon: Clock, color: '#F07820' },
            { label: 'Confirmadas', value: stats.confirmadas, icon: CheckCircle, color: '#28B44A' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.55, delay: i * 0.08, ease: EXPO_OUT }}
              style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '28px 26px', position: 'relative', overflow: 'hidden', transition: 'border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease', boxShadow: '0 4px 24px rgba(40,180,74,0.04)' }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = color; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = `0 8px 32px ${color}18`; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = '#1A2418'; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 4px 24px rgba(40,180,74,0.04)'; }}>
              {/* Radial gradient background glow */}
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: color, opacity: value > 0 ? 0.8 : 0.2 }} />
              <Icon size={20} color={color} style={{ marginBottom: '14px', opacity: value > 0 ? 1 : 0.4 }} />
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '40px', fontWeight: 700, color: '#F0F0F0', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.35)', marginTop: '6px' }}>{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="admin-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '14px' }}>
          <div className="admin-tabs-bar" style={{ display: 'flex', gap: '6px', padding: '4px', backgroundColor: 'rgba(15,18,8,0.8)', border: '1px solid #1A2418', borderRadius: '8px' }}>
            {([['citas', 'Citas', CalendarCheck], ['calendario', 'Calendario', CalendarDays], ['clientes', 'Clientes', Users], ['estadisticas', 'Estadisticas', TrendingUp]] as [Tab, string, React.ElementType][]).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', border: 'none', borderRadius: '6px', backgroundColor: tab === t ? 'rgba(240,120,32,0.15)' : 'transparent', color: tab === t ? '#F07820' : 'rgba(240,240,240,0.45)', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', fontWeight: tab === t ? 600 : 400, boxShadow: tab === t ? '0 2px 8px rgba(240,120,32,0.15)' : 'none' }}
                onMouseEnter={(e) => { if (tab !== t) e.currentTarget.style.backgroundColor = 'rgba(240,240,240,0.04)'; }}
                onMouseLeave={(e) => { if (tab !== t) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Search + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {tab === 'citas' && (
              <>
                {/* Cita rapida button */}
                <button onClick={() => setShowGuestModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, transition: 'background-color 0.3s ease', whiteSpace: 'nowrap' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FF8C35')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F07820')}>
                  <Plus size={13} /> Cita rapida
                </button>
                {/* Limpiar toggle */}
                <button onClick={() => setCleanMode(!cleanMode)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: `1px solid ${cleanMode ? 'rgba(245,180,50,0.5)' : '#1A2418'}`, backgroundColor: cleanMode ? 'rgba(245,180,50,0.1)' : 'transparent', color: cleanMode ? '#F5B432' : 'rgba(240,240,240,0.45)', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}>
                  <Trash2 size={12} /> Limpiar
                </button>
              </>
            )}

            {tab !== 'estadisticas' && tab !== 'calendario' && (
              <div className="admin-search-wrap" style={{ position: 'relative' }}>
                <Search size={13} color="rgba(240,240,240,0.3)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '34px', paddingRight: '14px', paddingTop: '9px', paddingBottom: '9px', backgroundColor: '#090C08', border: '1px solid #1A2418', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '13px', outline: 'none', width: '220px', transition: 'border-color 0.3s ease' }}
                  onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                  onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
              </div>
            )}
          </div>
        </div>

        {/* Clean mode notice */}
        <AnimatePresence>
          {cleanMode && tab === 'citas' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              style={{ marginBottom: '16px', padding: '12px 18px', backgroundColor: 'rgba(245,180,50,0.06)', border: '1px solid rgba(245,180,50,0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trash2 size={14} color="#F5B432" />
              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: '#F5B432' }}>
                Modo limpiar activo -- Solo puedes ocultar citas canceladas
              </span>
              <button onClick={() => setCleanMode(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(245,180,50,0.6)', cursor: 'pointer', padding: '2px' }}>
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* TAB: CITAS */}
          {tab === 'citas' && (
            <motion.div key="citas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>

              {/* Segmento por tipo */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', padding: '3px', backgroundColor: 'rgba(15,18,8,0.6)', border: '1px solid #1A2418', borderRadius: '8px', width: 'fit-content' }}>
                {([
                  ['todas',          'Todos',          stats.total],
                  ['nutricion',      'Nutricion',      stats.nutricion],
                  ['entrenamiento',  'Entrenamiento',  stats.entrenamiento],
                ] as [FilterTipo, string, number][]).map(([t, label, count]) => (
                  <button key={t} onClick={() => setTipoFilter(t)}
                    style={{
                      padding: '9px 18px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: tipoFilter === t ? 'rgba(40,180,74,0.15)' : 'transparent',
                      color: tipoFilter === t ? '#28B44A' : 'rgba(240,240,240,0.45)',
                      fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)', whiteSpace: 'nowrap',
                      fontWeight: tipoFilter === t ? 600 : 400,
                      boxShadow: tipoFilter === t ? '0 2px 8px rgba(40,180,74,0.12)' : 'none',
                    }}
                    onMouseEnter={(e) => { if (tipoFilter !== t) e.currentTarget.style.backgroundColor = 'rgba(240,240,240,0.04)'; }}
                    onMouseLeave={(e) => { if (tipoFilter !== t) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    {label} <span style={{ marginLeft: '6px', fontSize: '10px', opacity: 0.7 }}>({count})</span>
                  </button>
                ))}
              </div>

              {/* Filtros estado */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
                <Filter size={13} color="rgba(240,240,240,0.3)" style={{ marginRight: '2px' }} />
                {(['todas', 'pendiente', 'confirmada', 'cancelada'] as FilterEstado[]).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding: '7px 16px', border: `1px solid ${filter === f ? '#F07820' : '#1A2418'}`, borderRadius: '20px', backgroundColor: filter === f ? 'rgba(240,120,32,0.12)' : 'transparent', color: filter === f ? '#F07820' : 'rgba(240,240,240,0.4)', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.25s ease', fontWeight: filter === f ? 600 : 400 }}
                    onMouseEnter={(e) => { if (filter !== f) e.currentTarget.style.borderColor = 'rgba(240,120,32,0.3)'; }}
                    onMouseLeave={(e) => { if (filter !== f) e.currentTarget.style.borderColor = '#1A2418'; }}>
                    {f} {f !== 'todas' && `(${reservas.filter(r => r.estado === f).length})`}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EXPO_OUT }}
                    style={{ textAlign: 'center', padding: '64px 32px', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.3)', fontFamily: 'var(--font-inter)', fontSize: '14px', backgroundColor: '#090C08', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 50% at 50% 80%, rgba(240,120,32,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
                    <CalendarCheck size={32} color="rgba(240,120,32,0.3)" style={{ marginBottom: '16px' }} />
                    <p>No hay citas en esta categoria</p>
                  </motion.div>
                ) : filtered.map((r, i) => {
                  const estado = ESTADO_COLORS[r.estado];
                  const isUpdating = updating === r.id;
                  const isGuest = !!r.guest_name;
                  return (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05, ease: EXPO_OUT }}
                      onClick={() => { if (!cleanMode) { setDetailReserva(r); setDetailNoteText(r.notas_admin || ''); setDetailEditingNote(false); } }}
                      style={{ backgroundColor: '#090C08', border: `1px solid ${cleanMode && r.estado === 'cancelada' ? 'rgba(245,180,50,0.3)' : '#1A2418'}`, padding: '24px 28px', cursor: cleanMode ? 'default' : 'pointer', transition: 'border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease', boxShadow: '0 2px 16px rgba(40,180,74,0.03)' }}
                      onMouseEnter={(e) => { if (!cleanMode) { e.currentTarget.style.borderColor = 'rgba(240,120,32,0.35)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(240,120,32,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = cleanMode && r.estado === 'cancelada' ? 'rgba(245,180,50,0.3)' : '#1A2418'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(40,180,74,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                        {/* Info cliente */}
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: isGuest ? 'rgba(245,180,50,0.12)' : 'rgba(240,120,32,0.12)', border: `1px solid ${isGuest ? 'rgba(245,180,50,0.3)' : 'rgba(240,120,32,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: isGuest ? '#F5B432' : '#F07820', flexShrink: 0, overflow: 'hidden' }}>
                              {!isGuest && r.profiles?.avatar_url
                                ? <Image unoptimized src={r.profiles.avatar_url} alt="" width={34} height={34} style={{ width: '34px', height: '34px', objectFit: 'cover' }} />
                                : (r.guest_name?.[0] || r.profiles?.nombre?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', fontWeight: 600, color: '#F0F0F0' }}>{displayName(r)}</span>
                                {isGuest && (
                                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#F5B432', backgroundColor: 'rgba(245,180,50,0.1)', border: '1px solid rgba(245,180,50,0.3)', padding: '2px 8px', fontWeight: 600 }}>
                                    Invitado
                                  </span>
                                )}
                              </div>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,240,240,0.4)' }}>
                                {isGuest ? (r.guest_phone || 'Sin celular') : r.profiles?.email}
                              </div>
                            </div>
                          </div>
                          {/* Badge de tipo */}
                          <div style={{ marginBottom: '10px' }}>
                            <span style={{
                              fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.18em',
                              textTransform: 'uppercase', fontWeight: 600, padding: '3px 10px',
                              backgroundColor: (r.tipo ?? 'nutricion') === 'entrenamiento' ? 'rgba(40,180,74,0.1)' : 'rgba(240,120,32,0.1)',
                              border: `1px solid ${(r.tipo ?? 'nutricion') === 'entrenamiento' ? 'rgba(40,180,74,0.3)' : 'rgba(240,120,32,0.3)'}`,
                              color: (r.tipo ?? 'nutricion') === 'entrenamiento' ? '#28B44A' : '#F07820',
                            }}>
                              {(r.tipo ?? 'nutricion') === 'entrenamiento' ? 'Entrenamiento' : 'Nutricion'}
                            </span>
                          </div>
                          <div className="admin-cita-fields" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '14px' }}>
                            {[['Servicio', r.servicio], ['Dia', r.dia], ['Horario', r.horario], ['Objetivo', r.objetivo]].map(([label, val]) => (
                              <div key={label}>
                                <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '4px' }}>{label}</div>
                                <div style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: '#F0F0F0', lineHeight: 1.4 }}>{val}</div>
                              </div>
                            ))}
                          </div>

                          {/* Notas del cliente */}
                          {r.notas && (
                            <div style={{ padding: '8px 12px', backgroundColor: 'rgba(240,240,240,0.03)', border: '1px solid #1A2418', marginBottom: '8px' }}>
                              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.4)' }}>Cliente: {r.notas}</span>
                            </div>
                          )}

                          {/* Notas admin */}
                          {!cleanMode && (
                            editingNote === r.id ? (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                                <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
                                  placeholder="Nota interna..."
                                  style={{ flex: 1, backgroundColor: '#0F1208', border: '1px solid #F07820', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '13px', padding: '8px 12px', outline: 'none' }} />
                                <button onClick={() => saveNota(r.id)}
                                  style={{ padding: '8px 14px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-inter)', fontSize: '11px' }}>
                                  <Save size={12} />
                                </button>
                                <button onClick={() => setEditingNote(null)}
                                  style={{ padding: '8px 10px', backgroundColor: 'transparent', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.4)', cursor: 'pointer' }}>
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setEditingNote(r.id); setNoteText(r.notas_admin || ''); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: r.notas_admin ? '#F07820' : 'rgba(240,240,240,0.3)', fontFamily: 'var(--font-inter)', fontSize: '11px', cursor: 'pointer', padding: 0, marginTop: '4px' }}>
                                <Edit2 size={11} /> {r.notas_admin || 'Agregar nota interna'}
                              </button>
                            )
                          )}
                        </div>

                        {/* Acciones */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                          <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: estado.text, backgroundColor: estado.bg, border: `1px solid ${estado.border}`, padding: '6px 14px', fontWeight: 600, borderRadius: '4px' }}>
                            {r.estado}
                          </span>

                          {/* Clean mode: ocultar (canceladas) + eliminar (todas) */}
                          {cleanMode && r.estado === 'cancelada' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleArchive(r.id); }}
                              disabled={archiving === r.id}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', backgroundColor: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.35)', color: '#FF6B6B', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: archiving === r.id ? 'default' : 'pointer', transition: 'all 0.2s ease', fontWeight: 600 }}
                              onMouseEnter={(e) => { if (archiving !== r.id) e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.22)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.12)'; }}>
                              {archiving === r.id ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <X size={12} />}
                              {archiving === r.id ? 'Ocultando...' : 'Ocultar'}
                            </button>
                          )}

                          {/* Eliminar permanentemente — siempre visible en modo limpiar */}
                          {cleanMode && (
                            deleteConfirmId === r.id ? (
                              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', backgroundColor: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.4)' }}>
                                <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(240,240,240,0.7)' }}>¿Eliminar?</span>
                                <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                                  style={{ padding: '3px 10px', backgroundColor: '#CC2200', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                  {deleting === r.id ? '...' : 'Sí'}
                                </button>
                                <button onClick={() => setDeleteConfirmId(null)}
                                  style={{ padding: '3px 8px', backgroundColor: 'transparent', border: '1px solid #1E2A1C', color: 'rgba(240,240,240,0.5)', fontFamily: 'var(--font-inter)', fontSize: '10px', cursor: 'pointer' }}>
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(r.id); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', backgroundColor: 'transparent', border: '1px solid rgba(204,34,0,0.4)', color: 'rgba(204,34,0,0.85)', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: 600 }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(204,34,0,0.12)'; e.currentTarget.style.borderColor = 'rgba(204,34,0,0.7)'; e.currentTarget.style.color = '#CC2200'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(204,34,0,0.4)'; e.currentTarget.style.color = 'rgba(204,34,0,0.85)'; }}>
                                <Trash2 size={11} /> Eliminar
                              </button>
                            )
                          )}

                          {!cleanMode && (r.estado === 'pendiente' || r.estado === 'confirmada') && (
                            confirmAction?.id === r.id ? (
                              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', backgroundColor: confirmAction.action === 'confirmada' ? 'rgba(40,180,74,0.08)' : 'rgba(255,107,107,0.08)', border: `1px solid ${confirmAction.action === 'confirmada' ? 'rgba(40,180,74,0.3)' : 'rgba(255,107,107,0.3)'}` }}>
                                <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(240,240,240,0.6)' }}>
                                  {confirmAction.action === 'confirmada' ? 'Confirmar cita?' : 'Cancelar cita?'}
                                </span>
                                <button onClick={() => { const a = confirmAction; setConfirmAction(null); updateEstado(a.id, a.action); }} disabled={isUpdating}
                                  style={{ padding: '4px 10px', backgroundColor: confirmAction.action === 'confirmada' ? '#28B44A' : '#FF6B6B', border: 'none', color: '#080808', fontFamily: 'var(--font-inter)', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                  {isUpdating ? '...' : 'Si'}
                                </button>
                                <button onClick={() => setConfirmAction(null)}
                                  style={{ padding: '4px 10px', backgroundColor: 'transparent', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.5)', fontFamily: 'var(--font-inter)', fontSize: '10px', cursor: 'pointer' }}>
                                  No
                                </button>
                              </div>
                            ) : (
                              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '6px' }}>
                                {r.estado === 'pendiente' && (
                                  <button onClick={() => setConfirmAction({ id: r.id, action: 'confirmada' })}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', backgroundColor: 'rgba(40,180,74,0.12)', border: '1px solid rgba(40,180,74,0.3)', color: '#28B44A', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(40,180,74,0.22)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(40,180,74,0.12)')}>
                                    <CheckCircle size={11} /> Confirmar
                                  </button>
                                )}
                                <button onClick={() => setConfirmAction({ id: r.id, action: 'cancelada' })}
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', backgroundColor: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.15)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.08)')}>
                                  <XCircle size={11} /> Cancelar
                                </button>
                              </div>
                            )
                          )}
                          {!cleanMode && (isGuest ? r.guest_phone : r.profiles?.telefono) && (
                            <a href={waLink(r)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.4)', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.2s ease' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.color = '#25D366'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.4)'; }}>
                              <MessageCircle size={11} /> WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                      {/* Hint */}
                      {!cleanMode && (
                        <div style={{ borderTop: '1px solid #1A2418', marginTop: '12px', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.2)' }}>
                            Ver detalles
                          </span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* TAB: CLIENTES */}
          {tab === 'clientes' && (
            <motion.div key="clientes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {selectedCliente ? (
                <div>
                  <button onClick={() => setSelectedCliente(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(240,240,240,0.45)', fontFamily: 'var(--font-inter)', fontSize: '12px', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
                    ← Volver a clientes
                  </button>
                  <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '28px 30px', marginBottom: '20px', boxShadow: '0 4px 24px rgba(40,180,74,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(240,120,32,0.12)', border: '1px solid rgba(240,120,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-playfair)', fontSize: '20px', fontWeight: 700, color: '#F07820' }}>
                        {selectedCliente.nombre?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', fontWeight: 700, color: '#F0F0F0' }}>{selectedCliente.nombre} {selectedCliente.apellido}</h2>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.45)' }}>{selectedCliente.email}</p>
                        {selectedCliente.telefono && <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.45)' }}>{selectedCliente.telefono}</p>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      {[['Total citas', selectedCliente.total_citas], ['Confirmadas', selectedCliente.confirmadas]].map(([l, v]) => (
                        <div key={l as string}>
                          <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '24px', fontWeight: 700, color: '#F07820' }}>{v}</div>
                          <div style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.35)' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.4)', marginBottom: '12px' }}>Historial de citas</h3>
                  {citasDelCliente.map(r => {
                    const e = ESTADO_COLORS[r.estado];
                    return (
                      <div key={r.id} style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '14px 18px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {[['Servicio', r.servicio], ['Dia', r.dia], ['Horario', r.horario]].map(([l, v]) => (
                            <div key={l as string}>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '2px' }}>{l}</div>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#F0F0F0' }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: e.text, backgroundColor: e.bg, border: `1px solid ${e.border}`, padding: '4px 10px' }}>{r.estado}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {clientesFiltrados.map((c, i) => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05, ease: EXPO_OUT }}
                      onClick={() => setSelectedCliente(c)}
                      style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease', boxShadow: '0 2px 16px rgba(40,180,74,0.03)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(240,120,32,0.3)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(240,120,32,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(40,180,74,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(240,120,32,0.12)', border: '1px solid rgba(240,120,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: '#F07820', flexShrink: 0, overflow: 'hidden' }}>
                          {(c as Cliente & { avatar_url?: string }).avatar_url
                            ? <Image unoptimized src={(c as Cliente & { avatar_url?: string }).avatar_url!} alt="" width={36} height={36} style={{ width: '36px', height: '36px', objectFit: 'cover' }} />
                            : c.nombre?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', fontWeight: 500, color: '#F0F0F0' }}>{c.nombre} {c.apellido}</div>
                          <div style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.4)' }}>{c.email}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '18px', fontWeight: 700, color: '#F07820' }}>{c.total_citas}</div>
                          <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)' }}>citas</div>
                        </div>
                        <span style={{ color: 'rgba(240,240,240,0.25)', fontSize: '18px' }}>&#x203A;</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: CALENDARIO */}
          {tab === 'calendario' && (() => {
            const calSlots: CalSlot[] = reservas
              .filter(r => r.estado !== 'cancelada' && !r.archived)
              .map(r => ({
                dia: r.dia,
                horario: r.horario,
                tipo: (r.tipo ?? 'nutricion') as 'nutricion' | 'entrenamiento',
                estado: r.estado,
                clientName: r.guest_name || (r.profiles ? `${r.profiles.nombre} ${r.profiles.apellido}`.trim() : undefined),
              }));

            const slotDetail = calSelectedSlot
              ? reservas.filter(r => r.dia === calSelectedSlot.dia && r.horario === calSelectedSlot.horario && r.estado !== 'cancelada' && !r.archived)
              : [];

            return (
              <motion.div key="calendario" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-playfair)', fontSize: '20px', fontWeight: 700, color: '#F0F0F0', marginBottom: '4px' }}>
                      Vista semanal de disponibilidad
                    </h2>
                    <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.35)' }}>
                      Haz clic en una celda ocupada para ver detalles
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0' }}>
                    {([
                      ['todas', 'Todas'],
                      ['nutricion', 'Nutricion'],
                      ['entrenamiento', 'Entrenamiento'],
                    ] as ['todas' | 'nutricion' | 'entrenamiento', string][]).map(([t, label], i) => (
                      <button key={t} onClick={() => setCalTipoFilter(t)}
                        style={{
                          padding: '8px 16px',
                          border: `1px solid ${calTipoFilter === t ? '#28B44A' : '#1A2418'}`,
                          marginLeft: i > 0 ? '-1px' : 0,
                          position: 'relative', zIndex: calTipoFilter === t ? 1 : 0,
                          backgroundColor: calTipoFilter === t ? 'rgba(40,180,74,0.1)' : '#090C08',
                          color: calTipoFilter === t ? '#28B44A' : 'rgba(240,240,240,0.45)',
                          fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
                          cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <WeeklyCalendar
                  slots={calSlots}
                  mode="view"
                  showNames={true}
                  tipoFilter={calTipoFilter}
                  onSelectSlot={(dia, horario) => {
                    const match = reservas.find(r => r.dia === dia && r.horario === horario && r.estado !== 'cancelada' && !r.archived);
                    if (match) {
                      setDetailReserva(match);
                      setDetailNoteText(match.notas_admin || '');
                      setDetailEditingNote(false);
                    }
                  }}
                />
              </motion.div>
            );
          })()}

          {/* TAB: ESTADISTICAS */}
          {tab === 'estadisticas' && (
            <motion.div key="estadisticas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="charts-grid">

                {/* Por servicio */}
                <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '28px', boxShadow: '0 4px 24px rgba(40,180,74,0.04)' }}>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.4)', marginBottom: '20px' }}>Citas por servicio</p>
                  {chartData.length === 0 ? (
                    <p style={{ color: 'rgba(240,240,240,0.25)', fontFamily: 'var(--font-inter)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Sin datos aun</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} barSize={28}>
                        <XAxis dataKey="name" tick={{ fill: 'rgba(240,240,240,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(240,240,240,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#090C08', border: '1px solid #1A2418', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: 12 }} cursor={{ fill: 'rgba(240,120,32,0.05)' }} />
                        <Bar dataKey="value" fill="#F07820" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Por estado */}
                <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '28px', boxShadow: '0 4px 24px rgba(40,180,74,0.04)' }}>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.4)', marginBottom: '20px' }}>Estado de citas</p>
                  {reservas.length === 0 ? (
                    <p style={{ color: 'rgba(240,240,240,0.25)', fontFamily: 'var(--font-inter)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Sin datos aun</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={estadoData} barSize={40}>
                        <XAxis dataKey="name" tick={{ fill: 'rgba(240,240,240,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'rgba(240,240,240,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#090C08', border: '1px solid #1A2418', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: 12 }} cursor={{ fill: 'rgba(240,120,32,0.05)' }} />
                        <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                          {estadoData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Objetivos mas frecuentes */}
                <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '28px', gridColumn: '1 / -1', boxShadow: '0 4px 24px rgba(40,180,74,0.04)' }}>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.4)', marginBottom: '20px' }}>Objetivos de los clientes</p>
                  {reservas.length === 0 ? (
                    <p style={{ color: 'rgba(240,240,240,0.25)', fontFamily: 'var(--font-inter)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Sin datos aun</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {Object.entries(reservas.reduce((acc, r) => { acc[r.objetivo] = (acc[r.objetivo] || 0) + 1; return acc; }, {} as Record<string, number>))
                        .sort((a, b) => b[1] - a[1])
                        .map(([objetivo, count]) => (
                          <div key={objetivo} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="admin-obj-label" style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.7)' }}>{objetivo}</span>
                            <div style={{ flex: 1, height: '6px', backgroundColor: '#1A2418', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', backgroundColor: '#F07820', borderRadius: '3px', width: `${(count / reservas.length) * 100}%`, transition: 'width 0.8s ease' }} />
                            </div>
                            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: '#F07820', minWidth: '24px', textAlign: 'right' }}>{count}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal detalle de cita ── */}
      <AnimatePresence>
        {detailReserva && (() => {
          const r = detailReserva;
          const est = ESTADO_COLORS[r.estado];
          const isNutri = (r.tipo ?? 'nutricion') !== 'entrenamiento';
          const isUpdatingModal = updating === r.id;
          const isGuest = !!r.guest_name;
          return (
            <>
              <motion.div key="detail-backdrop"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setDetailReserva(null)}
                style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(8px)', zIndex: 200 }} />

              <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 201, padding: '24px', pointerEvents: 'none' }}>
                <motion.div key="detail-panel"
                  initial={{ opacity: 0, y: 32, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.97 }}
                  transition={{ duration: 0.35, ease: EXPO_OUT }}
                  style={{
                    pointerEvents: 'auto', width: '100%', maxWidth: '520px',
                    maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
                    backgroundColor: '#090C08', border: '1px solid #1A2418',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
                  }}>

                  {/* Header del modal */}
                  <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid #1A2418', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(240,120,32,0.08) 0%, transparent 60%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: isGuest ? 'rgba(245,180,50,0.12)' : 'rgba(240,120,32,0.12)', border: `1px solid ${isGuest ? 'rgba(245,180,50,0.3)' : 'rgba(240,120,32,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter)', fontSize: '18px', fontWeight: 700, color: isGuest ? '#F5B432' : '#F07820', flexShrink: 0, overflow: 'hidden' }}>
                        {!isGuest && r.profiles?.avatar_url
                          ? <Image unoptimized src={r.profiles.avatar_url} alt="" width={52} height={52} style={{ width: '52px', height: '52px', objectFit: 'cover' }} />
                          : (r.guest_name?.[0] || r.profiles?.nombre?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F07820' }}>Detalle de cita</p>
                          {isGuest && (
                            <span style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#F5B432', backgroundColor: 'rgba(245,180,50,0.1)', border: '1px solid rgba(245,180,50,0.3)', padding: '2px 8px', fontWeight: 600 }}>
                              Invitado
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#F0F0F0', lineHeight: 1.1 }}>
                          {displayName(r)}
                        </h3>
                      </div>
                    </div>
                    <button onClick={() => setDetailReserva(null)}
                      style={{ background: 'none', border: 'none', color: 'rgba(240,240,240,0.35)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#F0F0F0')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,240,240,0.35)')}>
                      <X size={20} />
                    </button>
                  </div>

                  <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

                    {/* Estado + tipo */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: est.text, backgroundColor: est.bg, border: `1px solid ${est.border}`, padding: '5px 12px' }}>
                        {r.estado}
                      </span>
                      <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, padding: '5px 12px', backgroundColor: isNutri ? 'rgba(240,120,32,0.1)' : 'rgba(40,180,74,0.1)', border: `1px solid ${isNutri ? 'rgba(240,120,32,0.3)' : 'rgba(40,180,74,0.3)'}`, color: isNutri ? '#F07820' : '#28B44A' }}>
                        {isNutri ? 'Nutricion' : 'Entrenamiento'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(240,240,240,0.3)', padding: '5px 0', marginLeft: 'auto' }}>
                        {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Info de contacto */}
                    <div style={{ backgroundColor: '#0F1208', border: '1px solid #1A2418', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '4px' }}>Contacto</p>
                      {isGuest ? (
                        <>
                          {[
                            ['Nombre', r.guest_name],
                            ['Celular', r.guest_phone || '--'],
                          ].map(([label, val]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,240,240,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#F0F0F0', textAlign: 'right' }}>{val}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {[
                            ['Email', r.profiles?.email],
                            ['Telefono', r.profiles?.telefono || '--'],
                          ].map(([label, val]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,240,240,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#F0F0F0', textAlign: 'right' }}>{val}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Detalles de la cita */}
                    <div style={{ backgroundColor: '#0F1208', border: '1px solid #1A2418', padding: '16px 18px' }}>
                      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '14px' }}>Detalles de la cita</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {[
                          ['Servicio', r.servicio],
                          ['Dia', r.dia],
                          ['Horario', r.horario],
                          ['Objetivo', r.objetivo],
                        ].map(([label, val]) => (
                          <div key={label}>
                            <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '4px' }}>{label}</div>
                            <div style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#F0F0F0', lineHeight: 1.4 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notas del cliente */}
                    {r.notas && (
                      <div style={{ padding: '12px 16px', backgroundColor: 'rgba(240,240,240,0.02)', border: '1px solid #1A2418' }}>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '6px' }}>Notas del cliente</p>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.6)', lineHeight: 1.7 }}>{r.notas}</p>
                      </div>
                    )}

                    {/* Nota interna admin */}
                    <div>
                      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '8px' }}>Nota interna</p>
                      {detailEditingNote ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input value={detailNoteText} onChange={(e) => setDetailNoteText(e.target.value)}
                            placeholder="Nota interna..."
                            style={{ flex: 1, backgroundColor: '#0F1208', border: '1px solid #F07820', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '13px', padding: '10px 12px', outline: 'none' }} />
                          <button onClick={async () => {
                              const supabase = createClient();
                              await supabase.from('reservas').update({ notas_admin: detailNoteText }).eq('id', r.id);
                              await loadData();
                              setDetailReserva(prev => prev ? { ...prev, notas_admin: detailNoteText } : null);
                              setDetailEditingNote(false);
                            }}
                            style={{ padding: '10px 14px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Save size={13} />
                          </button>
                          <button onClick={() => setDetailEditingNote(false)}
                            style={{ padding: '10px 10px', backgroundColor: 'transparent', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.4)', cursor: 'pointer' }}>
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setDetailNoteText(r.notas_admin || ''); setDetailEditingNote(true); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid #1A2418', color: r.notas_admin ? '#F07820' : 'rgba(240,240,240,0.3)', fontFamily: 'var(--font-inter)', fontSize: '12px', cursor: 'pointer', padding: '9px 14px', width: '100%', transition: 'all 0.2s ease' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F07820'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = r.notas_admin ? '#F07820' : 'rgba(240,240,240,0.3)'; }}>
                          <Edit2 size={12} /> {r.notas_admin || 'Agregar nota interna'}
                        </button>
                      )}
                    </div>

                    {/* Acciones */}
                    {(r.estado === 'pendiente' || r.estado === 'confirmada') && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {r.estado === 'pendiente' && (
                          <button onClick={() => { updateEstado(r.id, 'confirmada'); setDetailReserva(prev => prev ? { ...prev, estado: 'confirmada' } : null); }}
                            disabled={isUpdatingModal}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', backgroundColor: 'rgba(40,180,74,0.12)', border: '1px solid rgba(40,180,74,0.35)', color: '#28B44A', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: isUpdatingModal ? 'default' : 'pointer', transition: 'all 0.2s ease' }}
                            onMouseEnter={(e) => { if (!isUpdatingModal) e.currentTarget.style.backgroundColor = 'rgba(40,180,74,0.22)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(40,180,74,0.12)'; }}>
                            <CheckCircle size={13} /> {isUpdatingModal ? 'Guardando...' : 'Confirmar cita'}
                          </button>
                        )}
                        <button onClick={() => { updateEstado(r.id, 'cancelada'); setDetailReserva(prev => prev ? { ...prev, estado: 'cancelada' } : null); }}
                          disabled={isUpdatingModal}
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', backgroundColor: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: isUpdatingModal ? 'default' : 'pointer', transition: 'all 0.2s ease' }}
                          onMouseEnter={(e) => { if (!isUpdatingModal) e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.16)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.08)'; }}>
                          <XCircle size={13} /> Cancelar cita
                        </button>
                      </div>
                    )}

                    {/* WhatsApp */}
                    {(isGuest ? r.guest_phone : r.profiles?.telefono) && (
                      <a href={waLink(r)} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.5)', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.2s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.color = '#25D366'; e.currentTarget.style.backgroundColor = 'rgba(37,211,102,0.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.5)'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                        <MessageCircle size={14} /> Enviar WhatsApp
                      </a>
                    )}
                  </div>
                </motion.div>
              </div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── Modal Cita Rapida (Guest Booking) ── */}
      <AnimatePresence>
        {showGuestModal && (
          <>
            <motion.div key="guest-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={resetGuestModal}
              style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(8px)', zIndex: 200 }} />

            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 201, padding: '24px', pointerEvents: 'none' }}>
              <motion.div key="guest-panel"
                initial={{ opacity: 0, y: 32, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ duration: 0.35, ease: EXPO_OUT }}
                style={{
                  pointerEvents: 'auto', width: '100%', maxWidth: '480px',
                  maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
                  backgroundColor: '#090C08', border: '1px solid #1A2418',
                  boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
                }}>

                {/* Header */}
                <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #1A2418', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(240,120,32,0.07) 0%, transparent 60%)' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F07820', marginBottom: '4px' }}>Nueva cita</p>
                    <h3 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#F0F0F0' }}>
                      Cita rapida (invitado)
                    </h3>
                  </div>
                  <button onClick={resetGuestModal}
                    style={{ background: 'none', border: 'none', color: 'rgba(240,240,240,0.35)', cursor: 'pointer', padding: '4px' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ padding: '24px 28px' }}>
                  {guestSuccess ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                      <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(40,180,74,0.15)', border: '1px solid rgba(40,180,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                          <CheckCircle size={26} color="#28B44A" />
                        </div>
                        <h4 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#F0F0F0', marginBottom: '8px' }}>
                          Cita creada con exito
                        </h4>
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.45)', lineHeight: 1.7, marginBottom: '24px' }}>
                          Puedes invitar al cliente a registrarse en la plataforma para que gestione sus propias citas en el futuro.
                        </p>
                        <button onClick={resetGuestModal}
                          style={{ padding: '12px 32px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                          Cerrar
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Nombre */}
                      <div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.38)', marginBottom: '7px' }}>
                          Nombre completo *
                        </label>
                        <input value={guestForm.nombre}
                          onChange={(e) => setGuestForm({ ...guestForm, nombre: e.target.value })}
                          placeholder="Ej: Juan Perez"
                          style={modalInputStyle}
                          onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                          onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
                      </div>

                      {/* Celular */}
                      <div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.38)', marginBottom: '7px' }}>
                          Celular (WhatsApp) *
                        </label>
                        <input value={guestForm.celular}
                          onChange={(e) => setGuestForm({ ...guestForm, celular: e.target.value })}
                          type="tel"
                          placeholder="Ej: 7451105266"
                          style={modalInputStyle}
                          onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                          onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
                      </div>

                      {/* Tipo — toggle pills */}
                      <div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.38)', marginBottom: '7px' }}>
                          Tipo de cita
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {(['entrenamiento', 'nutricion'] as const).map(t => (
                            <button key={t} onClick={() => {
                              const newDia = t === 'entrenamiento' ? DIAS_SEMANA[0] : DIAS_SEMANA[0];
                              const newHorario = t === 'entrenamiento' ? HORARIOS_ENTRENA[0] : HORARIOS_NUTRI_SEMANA[0];
                              setGuestForm({ ...guestForm, tipo: t, dia: newDia, horario: newHorario });
                            }}
                              style={{
                                flex: 1, padding: '10px 12px', fontFamily: 'var(--font-inter)', fontSize: '12px',
                                backgroundColor: guestForm.tipo === t
                                  ? (t === 'entrenamiento' ? 'rgba(40,180,74,0.15)' : 'rgba(240,120,32,0.15)')
                                  : '#111610',
                                border: `1px solid ${guestForm.tipo === t ? (t === 'entrenamiento' ? '#28B44A' : '#F07820') : '#1E2A1C'}`,
                                color: guestForm.tipo === t ? (t === 'entrenamiento' ? '#28B44A' : '#F07820') : 'rgba(240,240,240,0.55)',
                                cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: guestForm.tipo === t ? 600 : 400,
                              }}>
                              {t === 'entrenamiento' ? '🏋️ Entrenamiento' : '🥗 Nutrición'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Día — pills dinámicos por tipo */}
                      <div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.38)', marginBottom: '7px' }}>
                          Día
                        </label>
                        {guestForm.tipo === 'nutricion' && (
                          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(240,240,240,0.3)', marginBottom: '8px' }}>
                            Entre semana: 7-9pm · Fin de semana: 8am-6pm
                          </p>
                        )}
                        {guestForm.tipo === 'entrenamiento' && (
                          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', color: 'rgba(240,240,240,0.3)', marginBottom: '8px' }}>
                            Lunes a Viernes · 6am-6pm
                          </p>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                          {(guestForm.tipo === 'entrenamiento' ? DIAS_SEMANA : [...DIAS_SEMANA, ...DIAS_FINDE]).map(d => {
                            const accent = guestForm.tipo === 'entrenamiento' ? '#28B44A' : '#F07820';
                            const accentBg = guestForm.tipo === 'entrenamiento' ? 'rgba(40,180,74,0.15)' : 'rgba(240,120,32,0.15)';
                            return (
                              <button key={d} onClick={() => {
                                const isFinde = DIAS_FINDE.includes(d);
                                const newHorario = guestForm.tipo === 'nutricion'
                                  ? (isFinde ? HORARIOS_NUTRI_FINDE[0] : HORARIOS_NUTRI_SEMANA[0])
                                  : HORARIOS_ENTRENA[0];
                                setGuestForm({ ...guestForm, dia: d, horario: newHorario });
                              }}
                                style={{
                                  padding: '7px 13px', fontFamily: 'var(--font-inter)', fontSize: '12px',
                                  backgroundColor: guestForm.dia === d ? accentBg : '#111610',
                                  border: `1px solid ${guestForm.dia === d ? accent : '#1E2A1C'}`,
                                  color: guestForm.dia === d ? accent : 'rgba(240,240,240,0.55)',
                                  cursor: 'pointer', transition: 'all 0.18s ease',
                                  fontWeight: guestForm.dia === d ? 600 : 400,
                                }}>
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Horario — pills dinámicos por tipo + día */}
                      <div>
                        {(() => {
                          const isFinde = DIAS_FINDE.includes(guestForm.dia);
                          const horariosDisp = guestForm.tipo === 'entrenamiento'
                            ? HORARIOS_ENTRENA
                            : isFinde ? HORARIOS_NUTRI_FINDE : HORARIOS_NUTRI_SEMANA;
                          const accent = guestForm.tipo === 'entrenamiento' ? '#28B44A' : '#F07820';
                          const accentBg = guestForm.tipo === 'entrenamiento' ? 'rgba(40,180,74,0.15)' : 'rgba(240,120,32,0.15)';
                          return (
                            <>
                              <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.38)', marginBottom: '7px' }}>
                                Horario <span style={{ color: 'rgba(240,240,240,0.22)', letterSpacing: 0, textTransform: 'none', fontSize: '10px' }}>({horariosDisp.length} opciones)</span>
                              </label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                                {horariosDisp.map(h => (
                                  <button key={h} onClick={() => setGuestForm({ ...guestForm, horario: h })}
                                    style={{
                                      padding: '7px 11px', fontFamily: 'var(--font-inter)', fontSize: '11px',
                                      backgroundColor: guestForm.horario === h ? accentBg : '#111610',
                                      border: `1px solid ${guestForm.horario === h ? accent : '#1E2A1C'}`,
                                      color: guestForm.horario === h ? accent : 'rgba(240,240,240,0.55)',
                                      cursor: 'pointer', transition: 'all 0.18s ease',
                                      fontWeight: guestForm.horario === h ? 600 : 400,
                                      whiteSpace: 'nowrap',
                                    }}>
                                    {h}
                                  </button>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Objetivo (optional) */}
                      <div>
                        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.38)', marginBottom: '7px' }}>
                          Objetivo (opcional)
                        </label>
                        <textarea value={guestForm.objetivo}
                          onChange={(e) => setGuestForm({ ...guestForm, objetivo: e.target.value })}
                          placeholder="Ej: Bajar de peso, ganar masa muscular..."
                          rows={3}
                          style={{ ...modalInputStyle, resize: 'vertical' }}
                          onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                          onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
                      </div>

                      {/* Error */}
                      {guestError && (
                        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: '#FF6B6B', padding: '8px 12px', backgroundColor: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
                          {guestError}
                        </p>
                      )}

                      {/* Submit */}
                      <button onClick={handleGuestSubmit} disabled={guestSaving}
                        style={{ width: '100%', padding: '14px', backgroundColor: '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', cursor: guestSaving ? 'default' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.3s ease', opacity: guestSaving ? 0.7 : 1 }}
                        onMouseEnter={(e) => { if (!guestSaving) e.currentTarget.style.backgroundColor = '#FF8C35'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F07820'; }}>
                        {guestSaving ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={14} />}
                        {guestSaving ? 'Creando cita...' : 'Crear cita de invitado'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .admin-stats { grid-template-columns: repeat(2, 1fr) !important; gap: 12px !important; }
          .charts-grid { grid-template-columns: 1fr !important; }
          .admin-cita-fields { gap: 16px !important; }
        }
        @media (max-width: 600px) {
          .admin-csv-label { display: none; }
          .admin-toolbar { flex-direction: column; align-items: stretch !important; }
          .admin-tabs-bar { overflow-x: auto; -webkit-overflow-scrolling: touch; padding: 3px !important; border-radius: 6px !important; }
          .admin-tabs-bar::-webkit-scrollbar { display: none; }
          .admin-tabs-bar button { white-space: nowrap; font-size: 10px !important; padding: 8px 12px !important; border-radius: 4px !important; }
          .admin-search-wrap { width: 100%; }
          .admin-search-wrap input { width: 100% !important; }
          .admin-obj-label { min-width: 0; flex: 1; font-size: 12px !important; }
          .admin-cita-fields { gap: 12px !important; flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

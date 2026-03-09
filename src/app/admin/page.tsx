'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CalendarCheck, Users, Clock, CheckCircle, XCircle, MessageCircle, LogOut, Search, Download, Edit2, Save, X, TrendingUp, Filter } from 'lucide-react';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

type Reserva = {
  id: string;
  user_id: string;
  servicio: string;
  dia: string;
  horario: string;
  objetivo: string;
  notas: string;
  notas_admin: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada';
  created_at: string;
  profiles: { nombre: string; apellido: string; email: string; telefono: string };
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

type Tab = 'citas' | 'clientes' | 'estadisticas';
type FilterEstado = 'todas' | 'pendiente' | 'confirmada' | 'cancelada';

export default function AdminPage() {
  const router = useRouter();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('citas');
  const [filter, setFilter] = useState<FilterEstado>('todas');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: res } = await supabase
      .from('reservas')
      .select('*, profiles(nombre, apellido, email, telefono)')
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
    const headers = ['Nombre', 'Email', 'Teléfono', 'Servicio', 'Día', 'Horario', 'Objetivo', 'Estado', 'Fecha'];
    const rows = reservas.map(r => [
      `${r.profiles?.nombre} ${r.profiles?.apellido}`,
      r.profiles?.email,
      r.profiles?.telefono || '',
      r.servicio, r.dia, r.horario, r.objetivo, r.estado,
      new Date(r.created_at).toLocaleDateString('es-MX'),
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'citas-gnh.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const waLink = (r: Reserva) => {
    const msg = `Hola ${r.profiles?.nombre}! 👋 Tu cita está *confirmada*.\n\n📋 *Detalles:*\n• Servicio: ${r.servicio}\n• Día: ${r.dia}\n• Horario: ${r.horario}\n\n¡Te esperamos! — Bryan GNH`;
    const phone = r.profiles?.telefono?.replace(/\D/g, '');
    return `https://wa.me/52${phone}?text=${encodeURIComponent(msg)}`;
  };

  const stats = {
    total: reservas.length,
    pendientes: reservas.filter(r => r.estado === 'pendiente').length,
    confirmadas: reservas.filter(r => r.estado === 'confirmada').length,
    clientes: new Set(reservas.map(r => r.user_id)).size,
  };

  // Chart data — citas por servicio
  const servicioCount = reservas.reduce((acc, r) => {
    const key = r.servicio.split('(')[0].trim().slice(0, 20);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const chartData = Object.entries(servicioCount).map(([name, value]) => ({ name, value }));

  // Chart data — citas por estado
  const estadoData = [
    { name: 'Pendientes', value: stats.pendientes, color: '#F07820' },
    { name: 'Confirmadas', value: stats.confirmadas, color: '#28B44A' },
    { name: 'Canceladas', value: reservas.filter(r => r.estado === 'cancelada').length, color: '#FF6B6B' },
  ];

  const filtered = reservas.filter(r => {
    const matchEstado = filter === 'todas' || r.estado === filter;
    const matchSearch = !search || `${r.profiles?.nombre} ${r.profiles?.apellido} ${r.profiles?.email}`.toLowerCase().includes(search.toLowerCase());
    return matchEstado && matchSearch;
  });

  const clientesFiltrados = clientes.filter(c =>
    !search || `${c.nombre} ${c.apellido} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const citasDelCliente = selectedCliente
    ? reservas.filter(r => r.user_id === selectedCliente.id)
    : [];

  if (loading) return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid #1A2418', borderTopColor: '#F07820', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808' }}>
      {/* Navbar */}
      <header style={{ borderBottom: '1px solid #1A2418', backgroundColor: 'rgba(8,8,8,0.97)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container-gnh" style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/"><Image src="/logo-gnh.png" alt="GNH" width={100} height={40} style={{ objectFit: 'contain', height: '36px', width: 'auto' }} /></Link>
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

      <div className="container-gnh" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EXPO_OUT }} style={{ marginBottom: '32px' }}>
          <p className="eyebrow" style={{ marginBottom: '8px', display: 'block' }}>Panel de control</p>
          <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '30px', fontWeight: 700, color: '#F0F0F0' }}>Administración GNH</h1>
        </motion.div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }} className="admin-stats">
          {[
            { label: 'Total citas', value: stats.total, icon: CalendarCheck, color: '#F07820' },
            { label: 'Clientes', value: stats.clientes, icon: Users, color: '#F07820' },
            { label: 'Pendientes', value: stats.pendientes, icon: Clock, color: '#F07820' },
            { label: 'Confirmadas', value: stats.confirmadas, icon: CheckCircle, color: '#28B44A' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.07, ease: EXPO_OUT }}
              style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '20px 22px' }}>
              <Icon size={17} color={color} style={{ marginBottom: '10px' }} />
              <div style={{ fontFamily: 'var(--font-playfair)', fontSize: '30px', fontWeight: 700, color: '#F0F0F0', lineHeight: 1 }}>{value}</div>
              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.35)', marginTop: '4px' }}>{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <div className="admin-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="admin-tabs-bar" style={{ display: 'flex', gap: '4px' }}>
            {([['citas', 'Citas', CalendarCheck], ['clientes', 'Clientes', Users], ['estadisticas', 'Estadísticas', TrendingUp]] as [Tab, string, React.ElementType][]).map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: `1px solid ${tab === t ? '#F07820' : '#1A2418'}`, backgroundColor: tab === t ? 'rgba(240,120,32,0.1)' : 'transparent', color: tab === t ? '#F07820' : 'rgba(240,240,240,0.45)', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {/* Search */}
          {tab !== 'estadisticas' && (
            <div className="admin-search-wrap" style={{ position: 'relative' }}>
              <Search size={13} color="rgba(240,240,240,0.3)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '34px', paddingRight: '14px', paddingTop: '9px', paddingBottom: '9px', backgroundColor: '#090C08', border: '1px solid #1A2418', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '13px', outline: 'none', width: '220px', transition: 'border-color 0.3s ease' }}
                onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">

          {/* TAB: CITAS */}
          {tab === 'citas' && (
            <motion.div key="citas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {/* Filtros */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <Filter size={13} color="rgba(240,240,240,0.3)" style={{ alignSelf: 'center', marginRight: '4px' }} />
                {(['todas', 'pendiente', 'confirmada', 'cancelada'] as FilterEstado[]).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding: '6px 14px', border: `1px solid ${filter === f ? '#F07820' : '#1A2418'}`, backgroundColor: filter === f ? 'rgba(240,120,32,0.1)' : 'transparent', color: filter === f ? '#F07820' : 'rgba(240,240,240,0.4)', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                    {f} {f !== 'todas' && `(${reservas.filter(r => r.estado === f).length})`}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.3)', fontFamily: 'var(--font-inter)', fontSize: '14px' }}>
                    No hay citas en esta categoría
                  </div>
                ) : filtered.map((r, i) => {
                  const estado = ESTADO_COLORS[r.estado];
                  const isUpdating = updating === r.id;
                  return (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.04, ease: EXPO_OUT }}
                      style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                        {/* Info cliente */}
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: 'rgba(240,120,32,0.12)', border: '1px solid rgba(240,120,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: '#F07820', flexShrink: 0 }}>
                              {r.profiles?.nombre?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', fontWeight: 600, color: '#F0F0F0' }}>{r.profiles?.nombre} {r.profiles?.apellido}</div>
                              <div style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', color: 'rgba(240,240,240,0.4)' }}>{r.profiles?.email}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {[['Servicio', r.servicio], ['Día', r.dia], ['Horario', r.horario], ['Objetivo', r.objetivo]].map(([label, val]) => (
                              <div key={label}>
                                <div style={{ fontFamily: 'var(--font-inter)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.3)', marginBottom: '2px' }}>{label}</div>
                                <div style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#F0F0F0' }}>{val}</div>
                              </div>
                            ))}
                          </div>

                          {/* Notas del cliente */}
                          {r.notas && (
                            <div style={{ padding: '8px 12px', backgroundColor: 'rgba(240,240,240,0.03)', border: '1px solid #1A2418', marginBottom: '8px' }}>
                              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.4)' }}>📝 Cliente: {r.notas}</span>
                            </div>
                          )}

                          {/* Notas admin */}
                          {editingNote === r.id ? (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
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
                            <button onClick={() => { setEditingNote(r.id); setNoteText(r.notas_admin || ''); }}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: r.notas_admin ? '#F07820' : 'rgba(240,240,240,0.3)', fontFamily: 'var(--font-inter)', fontSize: '11px', cursor: 'pointer', padding: 0, marginTop: '4px' }}>
                              <Edit2 size={11} /> {r.notas_admin || 'Agregar nota interna'}
                            </button>
                          )}
                        </div>

                        {/* Acciones */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                          <span style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: estado.text, backgroundColor: estado.bg, border: `1px solid ${estado.border}`, padding: '4px 10px' }}>
                            {r.estado}
                          </span>
                          {r.estado === 'pendiente' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => updateEstado(r.id, 'confirmada')} disabled={isUpdating}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', backgroundColor: 'rgba(40,180,74,0.12)', border: '1px solid rgba(40,180,74,0.3)', color: '#28B44A', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(40,180,74,0.22)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(40,180,74,0.12)')}>
                                <CheckCircle size={11} /> {isUpdating ? '...' : 'Confirmar'}
                              </button>
                              <button onClick={() => updateEstado(r.id, 'cancelada')} disabled={isUpdating}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', backgroundColor: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.15)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,107,107,0.08)')}>
                                <XCircle size={11} /> Cancelar
                              </button>
                            </div>
                          )}
                          {r.profiles?.telefono && (
                            <a href={waLink(r)} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', border: '1px solid #1A2418', color: 'rgba(240,240,240,0.4)', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', transition: 'all 0.2s ease' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.color = '#25D366'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1A2418'; e.currentTarget.style.color = 'rgba(240,240,240,0.4)'; }}>
                              <MessageCircle size={11} /> WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
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
                  <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '24px', marginBottom: '16px' }}>
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
                          {[['Servicio', r.servicio], ['Día', r.dia], ['Horario', r.horario]].map(([l, v]) => (
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
                    <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.04 }}
                      onClick={() => setSelectedCliente(c)}
                      style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'border-color 0.2s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(240,120,32,0.3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1A2418')}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(240,120,32,0.12)', border: '1px solid rgba(240,120,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: '#F07820', flexShrink: 0 }}>
                          {c.nombre?.[0]?.toUpperCase() || '?'}
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
                        <span style={{ color: 'rgba(240,240,240,0.25)', fontSize: '18px' }}>›</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: ESTADÍSTICAS */}
          {tab === 'estadisticas' && (
            <motion.div key="estadisticas" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="charts-grid">

                {/* Por servicio */}
                <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '24px' }}>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.4)', marginBottom: '20px' }}>Citas por servicio</p>
                  {chartData.length === 0 ? (
                    <p style={{ color: 'rgba(240,240,240,0.25)', fontFamily: 'var(--font-inter)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Sin datos aún</p>
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
                <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '24px' }}>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.4)', marginBottom: '20px' }}>Estado de citas</p>
                  {reservas.length === 0 ? (
                    <p style={{ color: 'rgba(240,240,240,0.25)', fontFamily: 'var(--font-inter)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>Sin datos aún</p>
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

                {/* Objetivos más frecuentes */}
                <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '24px', gridColumn: '1 / -1' }}>
                  <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.4)', marginBottom: '20px' }}>Objetivos de los clientes</p>
                  {reservas.length === 0 ? (
                    <p style={{ color: 'rgba(240,240,240,0.25)', fontFamily: 'var(--font-inter)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>Sin datos aún</p>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .admin-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .charts-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .admin-csv-label { display: none; }
          .admin-toolbar { flex-direction: column; align-items: stretch !important; }
          .admin-tabs-bar { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .admin-tabs-bar::-webkit-scrollbar { display: none; }
          .admin-tabs-bar button { white-space: nowrap; }
          .admin-search-wrap { width: 100%; }
          .admin-search-wrap input { width: 100% !important; }
          .admin-obj-label { min-width: 0; flex: 1; font-size: 12px !important; }
        }
      `}</style>
    </div>
  );
}

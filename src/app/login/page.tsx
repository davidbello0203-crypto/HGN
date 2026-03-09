'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { CalendarCheck, Eye, EyeOff } from 'lucide-react';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0F1208',
  border: '1px solid #1A2418',
  color: '#F0F0F0',
  fontFamily: 'var(--font-inter), system-ui, sans-serif',
  fontSize: '14px',
  padding: '14px 16px',
  outline: 'none',
  borderRadius: 0,
  transition: 'border-color 0.3s ease',
};

function ReservarBanner() {
  const params = useSearchParams();
  if (params.get('from') !== 'reservar') return null;
  return (
    <div style={{ backgroundColor: 'rgba(240,120,32,0.08)', border: '1px solid rgba(240,120,32,0.25)', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <CalendarCheck size={18} color="#F07820" style={{ flexShrink: 0, marginTop: '2px' }} />
      <div>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: '#F07820', marginBottom: '4px' }}>
          Inicia sesión para agendar tu cita
        </p>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.55)', lineHeight: 1.6 }}>
          Necesitas una cuenta para reservar con Bryan. Es rápido y gratuito.
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotRegistered(false);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (!profile) {
        setNotRegistered(true);
      } else {
        setError('Contraseña incorrecta. Intenta de nuevo.');
      }
      setLoading(false);
      return;
    }

    // Si venía de reservar, regresar a la landing y abrir el modal
    if (params.get('from') === 'reservar') {
      router.push('/?open=reservar');
    } else {
      router.push('/dashboard');
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>
          Correo electrónico
        </label>
        <input
          type="email" required value={email}
          onChange={(e) => { setEmail(e.target.value); setNotRegistered(false); setError(''); }}
          placeholder="tu@correo.com"
          style={{ ...inputStyle, borderColor: notRegistered ? 'rgba(240,120,32,0.5)' : '#1A2418' }}
          onFocus={(e) => (e.target.style.borderColor = '#F07820')}
          onBlur={(e) => (e.target.style.borderColor = notRegistered ? 'rgba(240,120,32,0.5)' : '#1A2418')}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>
          Contraseña
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'} required value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ ...inputStyle, paddingRight: '44px' }}
            onFocus={(e) => (e.target.style.borderColor = '#F07820')}
            onBlur={(e) => (e.target.style.borderColor = '#1A2418')}
          />
          <button type="button" onClick={() => setShowPassword(v => !v)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(240,240,240,0.35)', transition: 'color 0.2s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#F07820')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,240,240,0.35)')}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Correo no registrado */}
      {notRegistered && (
        <div style={{ backgroundColor: 'rgba(240,120,32,0.08)', border: '1px solid rgba(240,120,32,0.3)', padding: '14px 16px' }}>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: '#F07820', marginBottom: '6px' }}>
            Este correo no está registrado
          </p>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.55)', marginBottom: '12px', lineHeight: 1.6 }}>
            No encontramos una cuenta con <strong style={{ color: 'rgba(240,240,240,0.8)' }}>{email}</strong>. ¿Quieres crear una?
          </p>
          <a
            href={`/registro?email=${encodeURIComponent(email)}`}
            style={{ display: 'inline-block', padding: '9px 20px', backgroundColor: '#F07820', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none', transition: 'background-color 0.3s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FF8C35')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F07820')}
          >
            Crear cuenta gratis →
          </a>
        </div>
      )}

      {/* Contraseña incorrecta */}
      {error && (
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#FF6B6B', padding: '10px 14px', backgroundColor: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
          {error}
        </p>
      )}

      {!notRegistered && (
        <button
          type="submit" disabled={loading}
          style={{
            marginTop: '8px', padding: '15px', backgroundColor: loading ? '#1A2418' : '#F07820',
            border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)',
            fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase',
            cursor: loading ? 'default' : 'pointer', transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#FF8C35'; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#F07820'; }}
        >
          {loading ? 'Verificando...' : 'Ingresar'}
        </button>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(240,120,32,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EXPO_OUT }}
        style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <a href="/" style={{ display: 'inline-block' }}>
            <Image src="/logo-gnh.png" alt="Good Nutrition Habits" width={140} height={56} style={{ objectFit: 'contain', height: '52px', width: 'auto' }} />
          </a>
        </div>

        {/* Card */}
        <div className="login-card" style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '40px 36px' }}>
          <p className="eyebrow" style={{ marginBottom: '12px', display: 'block' }}>Acceso</p>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#F0F0F0', marginBottom: '28px', lineHeight: 1.2 }}>
            Bienvenido de vuelta
          </h1>

          <Suspense fallback={null}>
            <ReservarBanner />
          </Suspense>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #1A2418' }}>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.45)', textAlign: 'center', marginBottom: '12px' }}>
              ¿No tienes cuenta?{' '}
              <a href="/registro" style={{ color: '#F07820', textDecoration: 'none', transition: 'color 0.3s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FF8C35')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#F07820')}>
                Regístrate gratis
              </a>
            </p>
            <div style={{ backgroundColor: 'rgba(40,180,74,0.06)', border: '1px solid rgba(40,180,74,0.15)', padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.40)', lineHeight: 1.6 }}>
                Registrarte te permite agendar citas, ver tu historial y recibir confirmaciones de Bryan directamente.
              </p>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.25)', marginTop: '24px' }}>
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>← Volver al inicio</a>
        </p>
      </motion.div>
      <style>{`
        @media (max-width: 480px) {
          .login-card { padding: 28px 20px !important; }
        }
      `}</style>
    </div>
  );
}

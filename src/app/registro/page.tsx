'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

function RegistroForm() {
  const params = useSearchParams();
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', telefono: '', password: '', confirm: '' });

  useEffect(() => {
    const emailParam = params.get('email');
    if (emailParam) setForm((prev) => ({ ...prev, email: emailParam }));
  }, [params]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.telefono.trim()) { setError('El número de WhatsApp es obligatorio para enviarte confirmaciones.'); return; }
    const digits = form.telefono.replace(/\D/g, '');
    if (digits.length < 10) { setError('El número de WhatsApp debe tener al menos 10 dígitos.'); return; }
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden.'); return; }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setLoading(true);
    setError('');
    setAlreadyRegistered(false);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          nombre: form.nombre,
          apellido: form.apellido,
          telefono: form.telefono,
          full_name: `${form.nombre} ${form.apellido}`,
        },
      },
    });

    if (signUpError) {
      if (signUpError.message === 'User already registered') {
        setAlreadyRegistered(true);
      } else {
        setError(signUpError.message);
      }
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(240,120,32,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EXPO_OUT }}
          style={{ textAlign: 'center', maxWidth: '440px', width: '100%', position: 'relative', zIndex: 1 }}>

          <div style={{ marginBottom: '40px' }}>
            <a href="/" style={{ display: 'inline-block' }}>
              <Image src="/logo-gnh.png" alt="Good Nutrition Habits" width={140} height={56} style={{ objectFit: 'contain', height: '48px', width: 'auto' }} />
            </a>
          </div>

          <div style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '40px 32px' }}>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.5, ease: EXPO_OUT }}
              style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(240,120,32,0.1)', border: '1px solid rgba(240,120,32,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}
            >
              <span style={{ fontSize: '28px' }}>✉</span>
            </motion.div>

            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F07820', marginBottom: '12px' }}>
              Último paso
            </p>
            <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#F0F0F0', marginBottom: '16px', lineHeight: 1.2 }}>
              Confirma tu correo
            </h2>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(240,240,240,0.55)', lineHeight: 1.75, marginBottom: '28px' }}>
              Te enviamos un correo a{' '}
              <strong style={{ color: 'rgba(240,240,240,0.85)' }}>{form.email}</strong>.
              {' '}Ábrelo y haz clic en el enlace para activar tu cuenta.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', marginBottom: '32px' }}>
              {[
                ['1', 'Abre tu bandeja de entrada'],
                ['2', 'Busca el correo de Good Nutrition Habits'],
                ['3', 'Haz clic en el enlace de confirmación'],
              ].map(([num, text]) => (
                <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'rgba(240,120,32,0.15)', border: '1px solid rgba(240,120,32,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-inter)', fontSize: '11px', fontWeight: 700, color: '#F07820' }}>{num}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.6)' }}>{text}</span>
                </div>
              ))}
            </div>

            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.3)', lineHeight: 1.6 }}>
              ¿No lo encuentras? Revisa tu carpeta de spam o correo no deseado.
            </p>
          </div>

          <p style={{ marginTop: '24px', fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.25)' }}>
            <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>← Volver al inicio</a>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(240,120,32,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EXPO_OUT }}
        style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1 }}>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <a href="/" style={{ display: 'inline-block' }}>
            <Image src="/logo-gnh.png" alt="Good Nutrition Habits" width={140} height={56} style={{ objectFit: 'contain', height: '52px', width: 'auto' }} />
          </a>
        </div>

        <div className="registro-card" style={{ backgroundColor: '#090C08', border: '1px solid #1A2418', padding: '40px 36px' }}>
          <p className="eyebrow" style={{ marginBottom: '12px', display: 'block' }}>Registro</p>
          <h1 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#F0F0F0', marginBottom: '32px', lineHeight: 1.2 }}>
            Crea tu cuenta
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[['nombre', 'Nombre', 'text', 'Juan'], ['apellido', 'Apellido', 'text', 'Pérez']].map(([field, label, type, placeholder]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>{label}</label>
                  <input type={type} required placeholder={placeholder} value={form[field as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                    onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
                </div>
              ))}
            </div>

            {[
              ['email', 'Correo electrónico', 'email', 'tu@correo.com'],
              ['telefono', 'WhatsApp / Teléfono', 'tel', '745 123 4567'],
            ].map(([field, label, type, placeholder]) => (
              <div key={field}>
                <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>{label}</label>
                <input type={type} required placeholder={placeholder} value={form[field as keyof typeof form]}
                  onChange={(e) => { setForm({ ...form, [field]: e.target.value }); if (field === 'email') setAlreadyRegistered(false); }}
                  style={{ ...inputStyle, borderColor: field === 'email' && alreadyRegistered ? 'rgba(240,120,32,0.5)' : '#1A2418' }}
                  onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                  onBlur={(e) => (e.target.style.borderColor = field === 'email' && alreadyRegistered ? 'rgba(240,120,32,0.5)' : '#1A2418')} />
              </div>
            ))}

            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} required placeholder="••••••••" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                  onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(240,240,240,0.35)', transition: 'color 0.2s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#F07820')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,240,240,0.35)')}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.45)', marginBottom: '8px' }}>Confirmar contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={showConfirm ? 'text' : 'password'} required placeholder="••••••••" value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  onFocus={(e) => (e.target.style.borderColor = '#F07820')}
                  onBlur={(e) => (e.target.style.borderColor = '#1A2418')} />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(240,240,240,0.35)', transition: 'color 0.2s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#F07820')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(240,240,240,0.35)')}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {alreadyRegistered && (
              <div style={{ backgroundColor: 'rgba(240,120,32,0.08)', border: '1px solid rgba(240,120,32,0.3)', padding: '14px 16px' }}>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', fontWeight: 600, color: '#F07820', marginBottom: '6px' }}>
                  Este correo ya tiene una cuenta
                </p>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.55)', marginBottom: '12px', lineHeight: 1.6 }}>
                  <strong style={{ color: 'rgba(240,240,240,0.8)' }}>{form.email}</strong> ya está registrado. ¿Quieres iniciar sesión?
                </p>
                <a href={`/login?email=${encodeURIComponent(form.email)}`}
                  style={{ display: 'inline-block', padding: '9px 20px', backgroundColor: '#F07820', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FF8C35')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F07820')}
                >
                  Iniciar sesión →
                </a>
              </div>
            )}

            {error && (
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: '#FF6B6B', padding: '10px 14px', backgroundColor: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}
              style={{ marginTop: '8px', padding: '15px', backgroundColor: loading ? '#1A2418' : '#F07820', border: 'none', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer', transition: 'all 0.3s ease' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#FF8C35'; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#F07820'; }}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #1A2418', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: '13px', color: 'rgba(240,240,240,0.45)' }}>
              ¿Ya tienes cuenta?{' '}
              <a href="/login" style={{ color: '#F07820', textDecoration: 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FF8C35')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#F07820')}>
                Inicia sesión
              </a>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.25)', marginTop: '24px' }}>
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>← Volver al inicio</a>
        </p>
      </motion.div>
      <style>{`
        @media (max-width: 480px) {
          .registro-card { padding: 28px 20px !important; }
        }
      `}</style>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroForm />
    </Suspense>
  );
}

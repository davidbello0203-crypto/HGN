'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

function ConfirmadoContent() {
  const params = useSearchParams();
  const router = useRouter();
  const hasError = params.get('error') === 'true';

  if (hasError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EXPO_OUT }}
        style={{ textAlign: 'center', maxWidth: '420px', width: '100%' }}
      >
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <span style={{ fontSize: '26px', color: '#FF6B6B' }}>✕</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#F0F0F0', marginBottom: '12px' }}>
          Enlace inválido
        </h2>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(240,240,240,0.55)', lineHeight: 1.7, marginBottom: '32px' }}>
          El enlace de confirmación ya expiró o no es válido. Intenta registrarte de nuevo o contacta a soporte.
        </p>
        <a href="/registro" style={{ display: 'inline-block', padding: '14px 36px', backgroundColor: '#F07820', color: '#F0F0F0', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'none' }}>
          Volver al registro
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EXPO_OUT }}
      style={{ textAlign: 'center', maxWidth: '420px', width: '100%' }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5, ease: EXPO_OUT }}
        style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: 'rgba(40,180,74,0.12)', border: '1px solid rgba(40,180,74,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}
      >
        <span style={{ fontSize: '32px', color: '#28B44A' }}>✓</span>
      </motion.div>

      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#28B44A', marginBottom: '12px' }}>
        Correo confirmado
      </p>
      <h2 style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#F0F0F0', marginBottom: '16px', lineHeight: 1.2 }}>
        ¡Tu cuenta está lista!
      </h2>
      <p style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(240,240,240,0.55)', lineHeight: 1.75, maxWidth: '340px', margin: '0 auto 12px' }}>
        Tu correo ha sido verificado exitosamente.
      </p>
      <div style={{ backgroundColor: 'rgba(40,180,74,0.07)', border: '1px solid rgba(40,180,74,0.2)', padding: '14px 18px', maxWidth: '340px', margin: '0 auto 32px', textAlign: 'left' }}>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.5)', lineHeight: 1.7 }}>
          Si dejaste la página de registro abierta en otra pestaña, ya inició sesión automáticamente ahí.
        </p>
      </div>

      <button onClick={() => router.push('/dashboard')}
        style={{ display: 'inline-block', padding: '14px 40px', backgroundColor: '#28B44A', color: '#080808', fontFamily: 'var(--font-inter)', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', fontWeight: 700, transition: 'background-color 0.3s ease' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#32D458')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#28B44A')}
      >
        Ir a mi panel →
      </button>
    </motion.div>
  );
}

export default function ConfirmadoPage() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 40%, rgba(40,180,74,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* Logo */}
        <div style={{ marginBottom: '48px' }}>
          <Link href="/" style={{ display: 'inline-block' }}>
            <Image src="/logo-gnh.png" alt="Good Nutrition Habits" width={140} height={56} style={{ objectFit: 'contain', height: '48px', width: 'auto' }} />
          </Link>
        </div>

        <Suspense fallback={null}>
          <ConfirmadoContent />
        </Suspense>

        <p style={{ marginTop: '32px', fontFamily: 'var(--font-inter)', fontSize: '12px', color: 'rgba(240,240,240,0.25)' }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}

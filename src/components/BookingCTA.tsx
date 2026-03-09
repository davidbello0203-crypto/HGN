'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

const EXPO_OUT = [0.16, 1, 0.3, 1] as const;

export default function BookingCTA() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session?.user));
  }, []);

  return (
    <section id="contacto" style={{ position: 'relative', overflow: 'hidden', paddingTop: '120px', paddingBottom: '120px' }}>
      {/* Background image */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Image
          src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1920&q=80"
          alt="Nutrición saludable"
          fill style={{ objectFit: 'cover', objectPosition: 'center' }}
          sizes="100vw"
        />
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(8,8,8,0.88)' }} />
      </div>

      <div className="container-gnh" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EXPO_OUT }}
          className="eyebrow" style={{ marginBottom: '20px', display: 'block' }}>
          Empieza hoy
        </motion.p>

        <motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.1, ease: EXPO_OUT }} viewport={{ once: true }}
          style={{ display: 'block', width: '48px', height: '1px', backgroundColor: '#F07820', transformOrigin: 'center', margin: '0 auto 28px' }} />

        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1, ease: EXPO_OUT }}
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 700, color: '#F0F0F0', lineHeight: 1.1, letterSpacing: '-0.01em', marginBottom: '20px' }}
          className="cta-heading">
          Tu transformación
          <br />
          <span style={{ color: '#28B44A' }}>comienza ahora</span>
        </motion.h2>

        <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2, ease: EXPO_OUT }}
          style={{ fontFamily: 'var(--font-inter)', fontSize: '15px', fontWeight: 300, color: 'rgba(240,240,240,0.60)', maxWidth: '480px', margin: '0 auto 52px', lineHeight: 1.75 }}>
          Agenda tu consulta de nutrición o reserva una sesión de entrenamiento. Contáctame por WhatsApp y resolvemos tus dudas al momento.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3, ease: EXPO_OUT }}
          style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => window.dispatchEvent(new CustomEvent('open-reservar'))} className="cta-btn-gold">
            {loggedIn ? 'Reservar mi cita' : 'Regístrate y reserva'}
          </button>
          <a href="https://www.instagram.com/good_nutrition_habits" target="_blank" rel="noopener noreferrer" className="cta-btn-ghost">
            @good_nutrition_habits
          </a>
        </motion.div>
      </div>

      <style>{`
        .cta-heading { font-size: 36px; }
        @media (min-width: 768px) { .cta-heading { font-size: 56px; } }
        .cta-btn-gold {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #F0F0F0; background-color: #F07820; border: 1px solid #F07820;
          padding: 16px 36px; text-decoration: none; display: inline-block;
          transition: all 0.45s ease; cursor: pointer;
        }
        .cta-btn-gold:hover { background-color: #FF8C35; border-color: #FF8C35; }
        .cta-btn-ghost {
          font-family: var(--font-inter), system-ui, sans-serif;
          font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #F0F0F0; background: transparent; border: 1px solid rgba(240,240,240,0.35);
          padding: 16px 36px; text-decoration: none; display: inline-block;
          transition: all 0.45s ease;
        }
        .cta-btn-ghost:hover { background-color: rgba(240,240,240,0.08); border-color: rgba(240,240,240,0.6); }
      `}</style>
    </section>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { User, Instagram } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Sobre mí', href: '#sobre-mi' },
  { label: 'Servicios', href: '#servicios' },
  { label: 'Contacto', href: '#contacto' },
];
const SECTION_IDS = NAV_LINKS.map((l) => l.href.replace('#', ''));

function NavLink({ href, label, isActive, onClick }: { href: string; label: string; isActive: boolean; onClick: (href: string) => void }) {
  return (
    <button
      onClick={() => onClick(href)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase',
        color: isActive ? '#28B44A' : 'rgba(240,240,240,0.65)',
        fontWeight: isActive ? 500 : 400,
        padding: '4px 0', position: 'relative', transition: 'color 0.35s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#28B44A'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'rgba(240,240,240,0.65)'; }}
    >
      {label}
      <AnimatePresence>
        {isActive && (
          <motion.span
            key="dot"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              position: 'absolute', bottom: '-6px', left: '50%',
              transform: 'translateX(-50%)', width: '3px', height: '3px',
              borderRadius: '50%', backgroundColor: '#F07820', display: 'block',
            }}
          />
        )}
      </AnimatePresence>
    </button>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        setUserRole(data?.role ?? 'user');
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        setUserRole(data?.role ?? 'user');
      } else {
        setUserRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); });
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(handleIntersection, { threshold: 0, rootMargin: '-30% 0px -60% 0px' });
    SECTION_IDS.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [handleIntersection]);

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 200);
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: '72px',
          display: 'flex', alignItems: 'center',
          transition: 'background-color 0.5s ease, border-color 0.5s ease, backdrop-filter 0.5s ease',
          backgroundColor: scrolled ? 'rgba(8,8,8,0.97)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(40,180,74,0.15)' : '1px solid transparent',
        }}
      >
        <div className="container-gnh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          {/* Logo */}
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ textDecoration: 'none', lineHeight: 1, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Image src="/emblema-gnh.svg" alt="Good Nutrition Habits" width={44} height={44} style={{ objectFit: 'contain', height: '44px', width: '44px' }} priority />
          </a>

          {/* Desktop nav — links centrados */}
          <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: '16px' }}>
            {/* Links center */}
            <ul style={{ display: 'flex', alignItems: 'center', gap: '24px', listStyle: 'none', flex: 1, justifyContent: 'center' }}>
              {NAV_LINKS.map((l) => (
                <li key={l.href}><NavLink href={l.href} label={l.label} isActive={activeSection === l.href.replace('#', '')} onClick={handleNavClick} /></li>
              ))}
            </ul>

            {/* Actions right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <a href="https://www.instagram.com/good_nutrition_habits" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F0F0F0', backgroundColor: 'rgba(240,120,32,0.12)', border: '1px solid rgba(240,120,32,0.35)', padding: '7px 12px', transition: 'all 0.3s ease', textDecoration: 'none', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(240,120,32,0.25)'; e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F07820'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(240,120,32,0.12)'; e.currentTarget.style.borderColor = 'rgba(240,120,32,0.35)'; e.currentTarget.style.color = '#F0F0F0'; }}>
                <Instagram size={14} />
                <span className="ig-label">@GNH</span>
              </a>
              <button
                onClick={() => {
                  if (userEmail) window.dispatchEvent(new CustomEvent('open-reservar'));
                  else window.location.href = '/login?from=reservar';
                }}
                style={{
                  fontFamily: 'var(--font-inter), system-ui, sans-serif',
                  fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: '#080808', backgroundColor: '#F07820', border: '1px solid #F07820',
                  padding: '8px 18px', cursor: 'pointer', transition: 'all 0.4s ease', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FF8C35'; e.currentTarget.style.borderColor = '#FF8C35'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F07820'; e.currentTarget.style.borderColor = '#F07820'; }}
              >
                Reservar
              </button>

              {userEmail ? (
                <a href={userRole === 'admin' ? '/admin' : '/dashboard'}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.7)', border: '1px solid rgba(240,240,240,0.15)', padding: '8px 14px', textDecoration: 'none', transition: 'all 0.3s ease', whiteSpace: 'nowrap' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F07820'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(240,240,240,0.15)'; e.currentTarget.style.color = 'rgba(240,240,240,0.7)'; }}>
                  <User size={12} />
                  {userRole === 'admin' ? 'Admin' : 'Mi cuenta'}
                </a>
              ) : (
                <a href="/login"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.7)', border: '1px solid rgba(240,240,240,0.15)', padding: '8px 14px', textDecoration: 'none', transition: 'all 0.3s ease', whiteSpace: 'nowrap' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F07820'; e.currentTarget.style.color = '#F07820'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(240,240,240,0.15)'; e.currentTarget.style.color = 'rgba(240,240,240,0.7)'; }}>
                  <User size={12} /> Ingresar
                </a>
              )}
            </div>
          </nav>

          {/* Hamburger */}
          <button onClick={() => setMobileOpen((v) => !v)} aria-label="Menú" className="nav-mobile-toggle"
            style={{ background: 'none', border: 'none', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
            <motion.span animate={mobileOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }} transition={{ duration: 0.3 }}
              style={{ display: 'block', width: '24px', height: '1px', backgroundColor: '#F0F0F0' }} />
            <motion.span animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }} transition={{ duration: 0.25 }}
              style={{ display: 'block', width: '16px', height: '1px', backgroundColor: '#F07820', transformOrigin: 'right center' }} />
            <motion.span animate={mobileOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }} transition={{ duration: 0.3 }}
              style={{ display: 'block', width: '24px', height: '1px', backgroundColor: '#F0F0F0' }} />
          </button>
        </div>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div key="drawer"
            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ position: 'fixed', top: '72px', left: 0, right: 0, zIndex: 99, backgroundColor: 'rgba(8,8,8,0.98)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(40,180,74,0.15)', padding: '36px 24px 44px' }}>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '26px' }}>
              {NAV_LINKS.map((l, i) => (
                <motion.li key={l.href} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.4 }}>
                  <button onClick={() => handleNavClick(l.href)}
                    style={{ background: 'none', border: 'none', fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '12px', letterSpacing: '0.22em', textTransform: 'uppercase', color: activeSection === l.href.replace('#', '') ? '#28B44A' : '#F0F0F0', padding: '4px 0', transition: 'color 0.3s ease' }}>
                    {l.label}
                  </button>
                </motion.li>
              ))}
            </ul>
            <div style={{ marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(40,180,74,0.12)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  if (userEmail) window.dispatchEvent(new CustomEvent('open-reservar'));
                  else window.location.href = '/login?from=reservar';
                }}
                style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#F0F0F0', backgroundColor: '#F07820', border: '1px solid #F07820', padding: '13px 32px', cursor: 'pointer' }}>
                Reservar ahora
              </button>
              {userEmail ? (
                <a href={userRole === 'admin' ? '/admin' : '/dashboard'}
                  onClick={() => setMobileOpen(false)}
                  style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.7)', border: '1px solid rgba(240,240,240,0.15)', padding: '13px 32px', textDecoration: 'none', textAlign: 'center' }}>
                  {userRole === 'admin' ? 'Panel Admin' : 'Mi cuenta'}
                </a>
              ) : (
                <a href="/login" onClick={() => setMobileOpen(false)}
                  style={{ fontFamily: 'var(--font-inter)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,240,240,0.7)', border: '1px solid rgba(240,240,240,0.15)', padding: '13px 32px', textDecoration: 'none', textAlign: 'center' }}>
                  Ingresar
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}

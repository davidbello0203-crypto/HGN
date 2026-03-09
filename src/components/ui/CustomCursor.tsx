'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, useSpring } from 'framer-motion';

export default function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const springConfig = { stiffness: 350, damping: 28, mass: 0.5 };
  const x = useSpring(-100, springConfig);
  const y = useSpring(-100, springConfig);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    x.set(e.clientX);
    y.set(e.clientY);
    if (!isVisible) setIsVisible(true);
    // Detectar hover via target — sin listeners por elemento
    const target = e.target as HTMLElement;
    setIsHovering(!!target.closest('a, button, [role="button"]'));
  }, [x, y, isVisible]);

  const handleLeaveWindow = useCallback(() => setIsVisible(false), []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    document.documentElement.addEventListener('mouseleave', handleLeaveWindow);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleLeaveWindow);
    };
  }, [handleMouseMove, handleLeaveWindow]);

  return (
    <div className="custom-cursor" aria-hidden="true">
      <motion.div style={{ x, y, translateX: '-50%', translateY: '-50%', position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 9999 }}>
        <motion.div
          animate={{
            width: isHovering ? 40 : 8,
            height: isHovering ? 40 : 8,
            backgroundColor: isHovering ? 'rgba(40,180,74,0.2)' : 'rgba(40,180,74,0.9)',
            borderWidth: isHovering ? 1 : 0,
            borderColor: isHovering ? 'rgba(40,180,74,0.8)' : 'transparent',
            opacity: isVisible ? 1 : 0,
          }}
          transition={{
            width: { type: 'spring', stiffness: 300, damping: 24 },
            height: { type: 'spring', stiffness: 300, damping: 24 },
            backgroundColor: { duration: 0.25 },
            opacity: { duration: 0.3 },
          }}
          style={{ borderRadius: '50%', borderStyle: 'solid' }}
        />
      </motion.div>
    </div>
  );
}

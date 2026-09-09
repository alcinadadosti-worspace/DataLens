import React from 'react';
import { motion } from 'framer-motion';
import { useVDThemeStore } from '../../store/useVDThemeStore';

/**
 * Botão sol/lua do Modo VD — mesma técnica do ThemeToggleButton do Modo Loja (círculo se
 * expandindo a partir do ponto clicado via View Transitions API).
 */
const VDThemeToggleButton: React.FC = () => {
  const theme = useVDThemeStore(s => s.theme);
  const setTheme = useVDThemeStore(s => s.setTheme);
  const isDark = theme === 'dark';

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const next = isDark ? 'light' : 'dark';
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = Math.max(x, window.innerWidth - x);
    const dy = Math.max(y, window.innerHeight - y);
    const radius = Math.hypot(dx, dy);

    const root = document.documentElement;
    root.style.setProperty('--vd-theme-origin-x', `${x}px`);
    root.style.setProperty('--vd-theme-origin-y', `${y}px`);
    root.style.setProperty('--vd-theme-radius', `${radius}px`);

    const canAnimate = typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canAnimate) {
      setTheme(next);
      return;
    }

    root.setAttribute('data-vd-theme-animating', 'true');
    const transition = document.startViewTransition(() => setTheme(next));
    transition.finished.finally(() => root.removeAttribute('data-vd-theme-animating'));
  }

  return (
    <button
      onClick={handleClick}
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 9,
        border: '1px solid var(--vd-border, #E8E2D6)',
        background: 'var(--vd-surface, #FFFFFF)',
        color: 'var(--vd-text-secondary, #6B6258)',
        cursor: 'pointer', overflow: 'hidden', position: 'relative', flexShrink: 0,
      }}
    >
      <motion.div
        key={isDark ? 'moon' : 'sun'}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex' }}
      >
        <i className={`ph ${isDark ? 'ph-moon-stars' : 'ph-sun'}`} style={{ fontSize: 17 }} />
      </motion.div>
    </button>
  );
};

export default VDThemeToggleButton;

import React from 'react';
import { motion } from 'framer-motion';
import { useLojaThemeStore } from '../../store/useLojaThemeStore';

/**
 * Botão sol/lua que troca claro<->escuro com um efeito de círculo se expandindo a partir do ponto
 * clicado (View Transitions API nativa — só existe em navegadores Chromium; nos demais a troca é
 * instantânea, sem esse efeito extra, mas funciona igual).
 */
const ThemeToggleButton: React.FC = () => {
  const theme = useLojaThemeStore(s => s.theme);
  const setTheme = useLojaThemeStore(s => s.setTheme);
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
    root.style.setProperty('--loja-theme-origin-x', `${x}px`);
    root.style.setProperty('--loja-theme-origin-y', `${y}px`);
    root.style.setProperty('--loja-theme-radius', `${radius}px`);

    const canAnimate = typeof document.startViewTransition === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canAnimate) {
      setTheme(next);
      return;
    }

    root.setAttribute('data-loja-theme-animating', 'true');
    const transition = document.startViewTransition(() => setTheme(next));
    transition.finished.finally(() => root.removeAttribute('data-loja-theme-animating'));
  }

  return (
    <button
      onClick={handleClick}
      title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 9,
        border: '1px solid var(--loja-border, #E8E2D6)',
        background: 'var(--loja-surface, #FFFFFF)',
        color: 'var(--loja-text-secondary, #6B6258)',
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

export default ThemeToggleButton;

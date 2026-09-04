import React, { useEffect, useRef } from 'react';
import { useLojaThemeStore } from '../../store/useLojaThemeStore';

/**
 * Fundo fixo de grade animada que reage ao cursor (o site original que inspirou isso — originkit.dev
 * — bloqueou a raspagem do código-fonte real; essa é uma reconstrução própria da mesma ideia: uma
 * grade de pontos que se distorce perto do mouse, como uma superfície líquida).
 */
const LiquidGridBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useLojaThemeStore(s => s.theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SPACING = 34;
    const mouse = { x: -9999, y: -9999, active: false };
    let width = 0, height = 0, dpr = 1;
    let raf = 0;
    let t = 0;

    function resize() {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvasEl.width = width * dpr;
      canvasEl.height = height * dpr;
      canvasEl.style.width = `${width}px`;
      canvasEl.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }
    function onLeave() {
      mouse.active = false;
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const dotColor = getComputedStyle(document.documentElement).getPropertyValue('--loja-border-strong').trim() || '#D8D0C0';
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--loja-accent').trim() || '#B26A3C';

      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;

      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const baseX = ix * SPACING;
          const baseY = iy * SPACING;

          let dx = 0, dy = 0;
          let influence = 0;
          if (mouse.active) {
            const distX = baseX - mouse.x;
            const distY = baseY - mouse.y;
            const dist = Math.sqrt(distX * distX + distY * distY);
            const radius = 180;
            if (dist < radius) {
              influence = (1 - dist / radius);
              const angle = Math.atan2(distY, distX);
              // "líquido": empurra o ponto pra longe do cursor, com uma leve ondulação temporal.
              const push = influence * 14;
              dx = Math.cos(angle) * push;
              dy = Math.sin(angle) * push + Math.sin(t * 0.002 + ix * 0.5 + iy * 0.5) * influence * 2;
            }
          }
          const wobble = Math.sin(t * 0.0006 + ix * 0.35 + iy * 0.35) * 1.2;

          const x = baseX + dx;
          const y = baseY + dy + wobble;
          const size = 1 + influence * 1.8;
          const alpha = 0.22 + influence * 0.55;

          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = influence > 0.05 ? hexToRgba(accent, Math.min(alpha, 0.85)) : hexToRgba(dotColor, 0.35);
          ctx.fill();
        }
      }
    }

    function hexToRgba(hex: string, alpha: number): string {
      const clean = hex.replace('#', '');
      if (clean.length !== 6) return `rgba(178,106,60,${alpha})`;
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }

    function loop() {
      t += 16;
      draw();
      if (!reducedMotion) raf = requestAnimationFrame(loop);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    if (!reducedMotion) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      }}
    />
  );
};

export default LiquidGridBackground;

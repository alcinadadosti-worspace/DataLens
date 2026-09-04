import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ScreenTransitionProps {
  routeKey: string;
  children: React.ReactNode;
}

/**
 * Ao trocar de tela: um overlay em "pixels" cobre e descobre a viewport rapidamente (mesma ideia
 * do Pixel Card do reactbits.dev — que lá é um efeito de hover num card, aqui adaptado pra cobrir
 * a tela inteira na troca de rota), e por baixo o conteúdo novo entra com fade + leve subida
 * vertical.
 */
const ScreenTransition: React.FC<ScreenTransitionProps> = ({ routeKey, children }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevKey = useRef(routeKey);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      prevKey.current = routeKey;
      return;
    }
    if (prevKey.current === routeKey) return;
    prevKey.current = routeKey;
    playPixelWipe();
  }, [routeKey]);

  function playPixelWipe() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const gap = 26;
    const cols = Math.ceil(width / gap);
    const rows = Math.ceil(height / gap);
    const cells: { x: number; y: number; delay: number }[] = [];
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        cells.push({ x: ix * gap, y: iy * gap, delay: Math.random() * 130 });
      }
    }
    const surface = getComputedStyle(document.documentElement).getPropertyValue('--loja-surface').trim() || '#FFFFFF';

    const fadeIn = 220, hold = 40, fadeOut = 240;
    const start = performance.now();

    function frame(now: number) {
      const elapsed = now - start;
      ctx!.clearRect(0, 0, width, height);
      ctx!.fillStyle = surface;
      for (const c of cells) {
        const localT = elapsed - c.delay;
        let alpha: number;
        if (localT < 0) alpha = 0;
        else if (localT < fadeIn) alpha = localT / fadeIn;
        else if (localT < fadeIn + hold) alpha = 1;
        else if (localT < fadeIn + hold + fadeOut) alpha = 1 - (localT - fadeIn - hold) / fadeOut;
        else alpha = 0;
        if (alpha <= 0) continue;
        ctx!.globalAlpha = alpha;
        ctx!.fillRect(c.x, c.y, gap - 2, gap - 2);
      }
      ctx!.globalAlpha = 1;

      if (elapsed < fadeIn + hold + fadeOut + 130) {
        requestAnimationFrame(frame);
      } else {
        ctx!.clearRect(0, 0, width, height);
      }
    }
    requestAnimationFrame(frame);
  }

  return (
    <div style={{ position: 'relative' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={routeKey}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'none' }}
      />
    </div>
  );
};

export default ScreenTransition;

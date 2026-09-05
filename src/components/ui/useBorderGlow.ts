import React, { useCallback, useRef } from 'react';

/**
 * Handlers de ponteiro compartilhados pelo efeito BorderGlow (ChartCard/KpiCard).
 *
 * Duas otimizações que importam bastante em telas com muitos painéis:
 * 1. `getBoundingClientRect()` força um reflow síncrono — só lê o retângulo uma vez, ao entrar no
 *    painel (`onPointerEnter`), e reaproveita esse valor em todo `pointermove` seguinte, em vez de
 *    reler a cada movimento (painéis não mudam de tamanho enquanto o mouse paira sobre eles).
 * 2. `pointermove` pode disparar centenas de vezes por segundo (mouse de alta taxa de polling) —
 *    as escritas de estilo são agrupadas por frame via requestAnimationFrame, então no máximo uma
 *    atualização de verdade acontece por frame renderizado, não uma por evento.
 */
export function useBorderGlowHandler() {
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ el: HTMLDivElement; edge: number; angle: number } | null>(null);

  const flush = useCallback(() => {
    rafRef.current = null;
    const pending = pendingRef.current;
    if (!pending) return;
    pending.el.style.setProperty('--edge-proximity', `${(pending.edge * 100).toFixed(2)}`);
    pending.el.style.setProperty('--cursor-angle', `${pending.angle.toFixed(2)}deg`);
  }, []);

  const onPointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    rectRef.current = e.currentTarget.getBoundingClientRect();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = rectRef.current ?? e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;

    let kx = Infinity;
    let ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    pendingRef.current = { el: e.currentTarget, edge, angle };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flush);
    }
  }, [flush]);

  return { onPointerEnter, onPointerMove };
}

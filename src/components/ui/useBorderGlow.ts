import React, { useCallback } from 'react';

/**
 * Handler de ponteiro compartilhado pelo efeito BorderGlow (ChartCard/KpiCard) — calcula a
 * proximidade da borda e o ângulo do cursor em relação ao centro do painel, e escreve isso como
 * CSS custom properties no próprio elemento (lidas pelo borderGlow.css).
 */
export function useBorderGlowHandler() {
  return useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
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

    el.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(2)}`);
    el.style.setProperty('--cursor-angle', `${angle.toFixed(2)}deg`);
  }, []);
}

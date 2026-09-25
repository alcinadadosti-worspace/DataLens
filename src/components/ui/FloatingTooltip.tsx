import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface FloatingTooltipProps {
  /** Elemento de onde o balão sai — a posição é calculada pelo retângulo dele na tela. */
  anchor: HTMLElement | null;
  open: boolean;
  /** Lado preferido. Se não couber na tela desse lado, o balão abre do outro. */
  placement?: 'up' | 'down';
  /** 'center' centraliza no elemento; 'start' alinha à esquerda dele (seta a 16px da borda). */
  align?: 'center' | 'start';
  gap?: number;
  /** Aparência do balão (fundo, padding, largura...). A posição é controlada aqui. */
  style?: React.CSSProperties;
  arrowColor?: string;
  children: React.ReactNode;
}

const VIEWPORT_MARGIN = 8;
const ARROW_EDGE = 12;

/**
 * Balão flutuante renderizado fora da árvore do componente (portal), numa camada acima do cabeçalho
 * fixo (TopBar, z-index 50). Um tooltip `position: absolute` dentro do card fica preso no contexto de
 * empilhamento do card — por maior que seja o z-index dele, o cabeçalho passava por cima. O portal vai
 * para a raiz do modo (`[data-vd-theme]` / `[data-loja-theme]`), e não para o `body`, para continuar
 * herdando as variáveis de cor do tema.
 */
const FloatingTooltip: React.FC<FloatingTooltipProps> = ({
  anchor, open, placement = 'up', align = 'center', gap = 8, style, arrowColor = 'var(--loja-ink, #1C1814)', children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrowLeft: number; side: 'up' | 'down' } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) { setPos(null); return; }
    function update() {
      const el = ref.current;
      if (!el || !anchor) return;
      const a = anchor.getBoundingClientRect();
      const { width, height } = el.getBoundingClientRect();
      const fitsUp = a.top - gap - height >= VIEWPORT_MARGIN;
      const fitsDown = a.bottom + gap + height <= window.innerHeight - VIEWPORT_MARGIN;
      const side = placement === 'up' ? (fitsUp || !fitsDown ? 'up' : 'down') : (fitsDown || !fitsUp ? 'down' : 'up');
      const pointX = align === 'center' ? a.left + a.width / 2 : a.left + 16;
      const idealLeft = align === 'center' ? pointX - width / 2 : a.left;
      const maxLeft = window.innerWidth - VIEWPORT_MARGIN - width;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(idealLeft, maxLeft));
      const top = side === 'up' ? a.top - gap - height : a.bottom + gap;
      const arrowLeft = Math.max(ARROW_EDGE, Math.min(pointX - left, width - ARROW_EDGE));
      setPos({ top, left, arrowLeft, side });
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchor, placement, align, gap]);

  if (!open || !anchor) return null;
  const target = anchor.closest<HTMLElement>('[data-vd-theme], [data-loja-theme]') ?? document.body;
  const side = pos?.side ?? placement;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        ...style,
        position: 'fixed',
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        zIndex: 1000,
        pointerEvents: 'none',
        // Invisível até a primeira medição, pra não piscar na posição (0,0).
        opacity: pos ? 1 : 0,
        transition: 'opacity 150ms',
      }}
    >
      {children}
      <div style={{
        position: 'absolute',
        ...(side === 'up' ? { top: '100%' } : { bottom: '100%' }),
        left: pos?.arrowLeft ?? ARROW_EDGE,
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
        ...(side === 'up' ? { borderTop: `5px solid ${arrowColor}` } : { borderBottom: `5px solid ${arrowColor}` }),
      }} />
    </div>,
    target,
  );
};

export default FloatingTooltip;

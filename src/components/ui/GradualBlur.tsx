import React, { useMemo, useState } from 'react';

// Adaptado do componente "GradualBlur" da React Bits (reactbits.dev) — trimmed pro nosso único
// uso real (uma faixa de desfoque gradual no topo do conteúdo, revelando a página ao carregar).
// A nota de dependência "mathjs" do pacote original é enganosa: o código-fonte deles não usa
// mathjs em lugar nenhum, então não foi adicionado aqui.

type Position = 'top' | 'bottom' | 'left' | 'right';
type Curve = 'linear' | 'bezier' | 'ease-in' | 'ease-out' | 'ease-in-out';

interface GradualBlurProps {
  position?: Position;
  strength?: number;
  height?: string;
  width?: string;
  divCount?: number;
  exponential?: boolean;
  curve?: Curve;
  opacity?: number;
  animated?: boolean;
  duration?: string;
  easing?: string;
  target?: 'parent' | 'page';
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
}

const CURVE_FUNCTIONS: Record<Curve, (p: number) => number> = {
  linear: p => p,
  bezier: p => p * p * (3 - 2 * p),
  'ease-in': p => p * p,
  'ease-out': p => 1 - Math.pow(1 - p, 2),
  'ease-in-out': p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
};

function getGradientDirection(position: Position): string {
  return { top: 'to top', bottom: 'to bottom', left: 'to left', right: 'to right' }[position];
}

const GradualBlur: React.FC<GradualBlurProps> = ({
  position = 'bottom',
  strength = 2,
  height = '6rem',
  width,
  divCount = 5,
  exponential = false,
  curve = 'linear',
  opacity = 1,
  animated = false,
  duration = '0.3s',
  easing = 'ease-out',
  target = 'parent',
  zIndex = 30,
  className = '',
  style,
}) => {
  const [visible, setVisible] = useState(!animated);

  React.useEffect(() => {
    if (!animated) return;
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, [animated]);

  const blurDivs = useMemo(() => {
    const divs: React.ReactNode[] = [];
    const increment = 100 / divCount;
    const curveFunc = CURVE_FUNCTIONS[curve] || CURVE_FUNCTIONS.linear;
    const direction = getGradientDirection(position);

    for (let i = 1; i <= divCount; i++) {
      const progress = curveFunc(i / divCount);
      const blurValue = exponential
        ? Math.pow(2, progress * 4) * 0.0625 * strength
        : 0.0625 * (progress * divCount + 1) * strength;

      const p1 = Math.round((increment * i - increment) * 10) / 10;
      const p2 = Math.round(increment * i * 10) / 10;
      const p3 = Math.round((increment * i + increment) * 10) / 10;
      const p4 = Math.round((increment * i + increment * 2) * 10) / 10;

      let gradient = `transparent ${p1}%, black ${p2}%`;
      if (p3 <= 100) gradient += `, black ${p3}%`;
      if (p4 <= 100) gradient += `, transparent ${p4}%`;

      const maskImage = `linear-gradient(${direction}, ${gradient})`;

      divs.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            maskImage,
            WebkitMaskImage: maskImage,
            backdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
            WebkitBackdropFilter: `blur(${blurValue.toFixed(3)}rem)`,
            opacity,
          }}
        />,
      );
    }
    return divs;
  }, [divCount, curve, exponential, strength, position, opacity]);

  const isVertical = position === 'top' || position === 'bottom';
  const isPageTarget = target === 'page';

  const containerStyle: React.CSSProperties = {
    position: isPageTarget ? 'fixed' : 'absolute',
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: `opacity ${duration} ${easing}`,
    zIndex: isPageTarget ? zIndex + 100 : zIndex,
    isolation: 'isolate',
    ...(isVertical
      ? { height, width: width || '100%', [position]: 0, left: 0, right: 0 }
      : { width: width || height, height: '100%', [position]: 0, top: 0, bottom: 0 }),
    ...style,
  };

  return (
    <div className={className} style={containerStyle} aria-hidden="true">
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>{blurDivs}</div>
    </div>
  );
};

export default GradualBlur;

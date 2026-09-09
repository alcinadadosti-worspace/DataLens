import React from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

interface ScrollProgressProps {
  /** Distância da borda esquerda — acompanha a largura da sidebar de cada modo. */
  left?: number;
  /** Gradiente da linha preenchida. */
  gradient?: string;
  glow?: string;
}

/**
 * Linha vertical acoplada à borda direita da sidebar, que preenche de cima pra baixo conforme a
 * página é rolada.
 */
const ScrollProgress: React.FC<ScrollProgressProps> = ({
  left = 264,
  gradient = 'linear-gradient(180deg, #FF5252 0%, #D6272C 55%, #8A1116 100%)',
  glow = 'rgba(214, 39, 44, 0.65)',
}) => {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 60, damping: 18, mass: 0.5 });

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', top: 0, left, bottom: 0, width: 4,
        zIndex: 70, pointerEvents: 'none',
        background: 'rgba(120, 20, 20, 0.12)',
      }}
    >
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          scaleY: smooth,
          transformOrigin: 'top',
          background: gradient,
          boxShadow: `0 0 10px ${glow}, 0 0 2px ${glow}`,
        }}
      />
    </div>
  );
};

export default ScrollProgress;

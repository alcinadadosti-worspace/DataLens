import React from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Linha vertical vermelha acoplada à borda direita da tela, que preenche de cima pra baixo
 * conforme a página é rolada.
 */
const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 22, mass: 0.25 });

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 4,
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
          background: 'linear-gradient(180deg, #FF5252 0%, #D6272C 55%, #8A1116 100%)',
          boxShadow: '0 0 10px rgba(214, 39, 44, 0.65), 0 0 2px rgba(214, 39, 44, 0.9)',
        }}
      />
    </div>
  );
};

export default ScrollProgress;

import React from 'react';
import { motion, useScroll, useSpring, useTransform, useMotionValueEvent } from 'framer-motion';

const SIZE = 44;
const STROKE = 3.5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Anel circular fixo com o % de rolagem da página — inspirado no "Scroll Progress" do skiper-ui,
 * sem o arrastar-pra-rolar do original (só o indicador visual).
 */
const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });
  const dashOffset = useTransform(smooth, v => CIRCUMFERENCE * (1 - v));
  const [percent, setPercent] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  useMotionValueEvent(smooth, 'change', v => {
    setPercent(Math.round(v * 100));
  });
  useMotionValueEvent(scrollYProgress, 'change', v => {
    setVisible(v > 0.01);
  });

  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.8 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', top: 78, right: 24, zIndex: 60,
        width: SIZE, height: SIZE,
        pointerEvents: 'none',
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="var(--loja-surface, #FFFFFF)"
          stroke="var(--loja-border, #E8E2D6)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none"
          stroke="var(--loja-accent, #B26A3C)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--loja-text-secondary, #6B6258)',
      }}>
        {percent}
      </div>
    </motion.div>
  );
};

export default ScrollProgress;

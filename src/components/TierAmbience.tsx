import React, { useMemo } from 'react';
import { TIER_STYLES, TierStyle } from '../design-system/tierStyles';

interface TierAmbienceProps {
  tierId: string | null;
}

const TierAmbience: React.FC<TierAmbienceProps> = ({ tierId }) => {
  if (!tierId) return null;
  const style = TIER_STYLES[tierId];
  if (!style) return null;
  const intensity = style.intensity || 0;
  const isDiamante = tierId === 'diamante';

  return (
    <div
      key={tierId}
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none',
        animation: 'amb-fade 700ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <BgWash style={style} isDiamante={isDiamante} />
      {intensity >= 4 && <EdgeBands style={style} />}
      {intensity >= 3 && <DriftOrbs style={style} count={intensity >= 6 ? 4 : 2} />}
      {intensity >= 5 && <LightStreak style={style} />}
      {isDiamante && <PrismRays />}
      {intensity >= 6 && <FloatingParticles style={style} count={isDiamante ? 26 : 14} />}
      {isDiamante && <SparkleField />}
      {isDiamante && <ShimmerOverlay />}
      <CornerSet style={style} intensity={intensity} isDiamante={isDiamante} />
    </div>
  );
};

function BgWash({ style, isDiamante }: { style: TierStyle; isDiamante: boolean }) {
  if (isDiamante) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(135deg, #FCE4F0 0%, #DCEAFE 18%, #C4F4E5 36%, #FFF1B5 54%, #F0D4FC 72%, #DCEAFE 88%, #FCE4F0 100%)`,
        backgroundSize: '320% 320%',
        animation: 'amb-prism 16s ease-in-out infinite',
        opacity: 0.78,
      }} />
    );
  }
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 90% 60% at 50% 0%, ${style.bgNear} 0%, ${style.bgMid} 35%, ${style.bgFar} 70%, #FAF7F2 100%)`,
        opacity: 0.82,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 50% 50% at 50% 110%, ${style.bgNear} 0%, transparent 60%)`,
        opacity: 0.35,
      }} />
    </>
  );
}

function EdgeBands({ style }: { style: TierStyle }) {
  const edgeStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg, transparent 0%, ${style.accent} 30%, ${style.accent} 70%, transparent 100%)`,
    opacity: 0.45,
    boxShadow: `0 0 18px ${style.ringGlow}`,
  };
  return (
    <>
      <div style={{ ...edgeStyle, top: 0 }} />
      <div style={{ ...edgeStyle, bottom: 0 }} />
    </>
  );
}

function DriftOrbs({ style, count }: { style: TierStyle; count: number }) {
  const orbs = [];
  for (let i = 0; i < count; i++) {
    const size = 380 + (i % 2) * 160;
    orbs.push(
      <div key={i} style={{
        position: 'absolute',
        width: size, height: size, borderRadius: '50%',
        left: `${(i * 27 + 8) % 80}%`,
        top: `${(i * 41 + 12) % 70}%`,
        background: `radial-gradient(circle at 40% 40%, ${style.particle} 0%, transparent 65%)`,
        opacity: 0.25,
        filter: 'blur(40px)',
        animation: `amb-drift-${i % 3} ${24 + i * 4}s ease-in-out infinite`,
      }} />
    );
  }
  return <>{orbs}</>;
}

function LightStreak({ style }: { style: TierStyle }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '-30%',
        width: '60%', height: '140%',
        background: `linear-gradient(110deg, transparent 0%, ${style.particle} 50%, transparent 100%)`,
        opacity: 0.22,
        filter: 'blur(40px)',
        transform: 'rotate(15deg)',
        animation: 'amb-streak 9s ease-in-out infinite',
      }} />
    </div>
  );
}

function FloatingParticles({ style, count }: { style: TierStyle; count: number }) {
  const particles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 3 + Math.random() * 4,
        dur: 8 + Math.random() * 10,
        delay: -Math.random() * 12,
      });
    }
    return arr;
  }, [count]);

  return (
    <>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${p.left}%`, top: `${p.top}%`,
          width: p.size, height: p.size, borderRadius: '50%',
          background: style.particle,
          boxShadow: `0 0 ${p.size * 3}px ${style.ringGlow}`,
          opacity: 0.7,
          animation: `amb-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
        }} />
      ))}
    </>
  );
}

function PrismRays() {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      width: 1800, height: 1800,
      transform: 'translate(-50%, -50%)',
      animation: 'amb-spin 60s linear infinite',
      opacity: 0.5,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `conic-gradient(from 0deg,
          transparent 0deg, rgba(252,228,240,0.35) 12deg, transparent 24deg,
          transparent 56deg, rgba(220,234,254,0.40) 68deg, transparent 80deg,
          transparent 112deg, rgba(196,244,229,0.40) 124deg, transparent 136deg,
          transparent 168deg, rgba(255,241,181,0.40) 180deg, transparent 192deg,
          transparent 224deg, rgba(240,196,252,0.40) 236deg, transparent 248deg,
          transparent 280deg, rgba(168,182,242,0.40) 292deg, transparent 304deg,
          transparent 336deg, rgba(252,228,240,0.35) 348deg, transparent 360deg)`,
        filter: 'blur(28px)',
      }} />
    </div>
  );
}

function SparkleField() {
  const sparkles = useMemo(() => {
    const arr = [];
    const hues = ['#FFFFFF', '#FCE4F0', '#DCEAFE', '#FFF1B5', '#F0D4FC'];
    for (let i = 0; i < 30; i++) {
      arr.push({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 3,
        dur: 1.6 + Math.random() * 2.4,
        delay: -Math.random() * 4,
        hue: hues[i % 5],
      });
    }
    return arr;
  }, []);

  return (
    <>
      {sparkles.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size, borderRadius: '50%',
          background: s.hue,
          boxShadow: `0 0 ${s.size * 4}px ${s.hue}, 0 0 ${s.size * 8}px rgba(107,125,217,0.6)`,
          animation: `amb-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}
    </>
  );
}

function ShimmerOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)',
      backgroundSize: '220% 100%',
      animation: 'amb-shimmer 6s linear infinite',
      mixBlendMode: 'screen',
    }} />
  );
}

interface CornerSetProps { style: TierStyle; intensity: number; isDiamante: boolean; }

function CornerSet({ style, intensity, isDiamante }: CornerSetProps) {
  const positions = [
    { key: 'tl', top: 0, left: 0, rotate: 0 },
    { key: 'tr', top: 0, right: 0, rotate: 90 },
    { key: 'br', bottom: 0, right: 0, rotate: 180 },
    { key: 'bl', bottom: 0, left: 0, rotate: 270 },
  ];
  return (
    <>
      {positions.map(p => (
        <CornerBracket key={p.key} pos={p} style={style} intensity={intensity} isDiamante={isDiamante} />
      ))}
    </>
  );
}

interface Pos { key: string; top?: number; left?: number; bottom?: number; right?: number; rotate: number; }

function CornerBracket({ pos, style, intensity, isDiamante }: { pos: Pos; style: TierStyle; intensity: number; isDiamante: boolean }) {
  const size = intensity >= 5 ? 280 : intensity >= 3 ? 240 : 220;
  const strokeWidth = intensity >= 5 ? 5 : 4.5;
  const id = `metal-${pos.key}-${Math.random().toString(36).slice(2, 7)}`;
  const ringGlow = style.ringGlow;
  const showSecondary = intensity >= 5;
  const showGem = intensity >= 4;
  const showHalo = intensity >= 6;

  const wrapStyle: React.CSSProperties = {
    position: 'absolute',
    top: pos.top !== undefined ? pos.top : undefined,
    left: pos.left !== undefined ? pos.left : undefined,
    bottom: pos.bottom !== undefined ? pos.bottom : undefined,
    right: pos.right !== undefined ? pos.right : undefined,
    width: size, height: size,
    transform: `rotate(${pos.rotate}deg)`,
    transformOrigin: 'center',
    filter: `drop-shadow(0 0 6px ${ringGlow}) drop-shadow(0 0 18px ${ringGlow})${isDiamante ? ' drop-shadow(0 0 32px rgba(255,255,255,0.7))' : ''}`,
  };

  return (
    <div style={wrapStyle}>
      {showHalo && (
        <div style={{
          position: 'absolute', top: '15%', left: '15%',
          width: '55%', height: '55%', borderRadius: '50%',
          background: `radial-gradient(circle, ${style.particle} 0%, transparent 70%)`,
          opacity: 0.45, filter: 'blur(18px)',
        }} />
      )}
      <svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {isDiamante ? (
              <>
                <stop offset="0%" stopColor="#FCE4F0" />
                <stop offset="20%" stopColor="#DCEAFE" />
                <stop offset="40%" stopColor="#C4F4E5" />
                <stop offset="60%" stopColor="#FFF1B5" />
                <stop offset="80%" stopColor="#F0D4FC" />
                <stop offset="100%" stopColor="#DCEAFE" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={style.fg} />
                <stop offset="22%" stopColor={style.accent} />
                <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="72%" stopColor={style.fg} />
                <stop offset="100%" stopColor={style.accent} />
              </>
            )}
          </linearGradient>
        </defs>
        <path d="M 4 42 L 4 4 L 42 4" fill="none" stroke={`url(#${id})`} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {showSecondary && (
          <path d="M 9 26 L 9 9 L 26 9" fill="none" stroke={`url(#${id})`} strokeWidth={strokeWidth - 1.2} strokeLinecap="round" strokeOpacity="0.7" />
        )}
        {showGem && (
          <g transform="translate(4 4)">
            {isDiamante ? (
              <g>
                <polygon points="9,2 16,8 9,16 2,8" fill={`url(#${id})`} stroke={style.accent} strokeWidth="0.4" opacity="0.95" />
                <polyline points="9,2 9,16" stroke="#FFFFFF" strokeWidth="0.3" opacity="0.7" />
                <polyline points="2,8 16,8" stroke="#FFFFFF" strokeWidth="0.3" opacity="0.7" />
              </g>
            ) : (
              <circle cx="9" cy="9" r="6" fill={`url(#${id})`} opacity="0.9" />
            )}
          </g>
        )}
        {intensity >= 3 && (
          <line x1="22" y1="4" x2="32" y2="4" stroke={style.accent} strokeWidth={strokeWidth - 1.2} opacity="0.5" />
        )}
      </svg>
    </div>
  );
}

export default TierAmbience;

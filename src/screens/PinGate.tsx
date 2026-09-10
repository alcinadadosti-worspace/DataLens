import React, { useEffect, useRef, useState } from 'react';
import { sha256Hex } from '../utils/sha256';

interface PinGateProps {
  pinHash: string;
  storageKey: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

const PinGate: React.FC<PinGateProps> = ({
  pinHash,
  storageKey,
  title = 'Acesso restrito',
  subtitle = 'Digite o código de acesso para continuar.',
  children,
}) => {
  // Guarda o próprio hash do PIN que desbloqueou, não só um "1" — se o PIN for trocado no código,
  // o valor salvo não bate mais com o novo `pinHash` e o acesso é pedido de novo.
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === pinHash;
    } catch {
      return false;
    }
  });
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus();
  }, [unlocked]);

  useEffect(() => {
    if (digits.length < 4) return;
    let cancelled = false;
    sha256Hex(digits).then((hash) => {
      if (cancelled) return;
      if (hash === pinHash) {
        try {
          localStorage.setItem(storageKey, pinHash);
        } catch {
          /* ignore */
        }
        setUnlocked(true);
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setDigits('');
        }, 350);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [digits, pinHash, storageKey]);

  if (unlocked) return <>{children}</>;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: '#1C1814',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#FAF7F2', borderRadius: 24, padding: 48,
          maxWidth: 360, width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          border: '1px solid #E8E2D6',
          textAlign: 'center',
          transform: shake ? 'translateX(0)' : undefined,
          animation: shake ? 'loginShake 0.35s' : undefined,
        }}
      >
        <div
          style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #1C1814 0%, #3D362E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Fraunces, serif', color: '#FAF7F2', fontSize: 24, fontWeight: 600,
          }}
        >
          D
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>
          {title}
        </h1>
        <p style={{ color: '#6B6258', fontSize: 14, marginTop: 8, marginBottom: 28 }}>
          {subtitle}
        </p>

        <div
          onClick={() => inputRef.current?.focus()}
          style={{ display: 'flex', justifyContent: 'center', gap: 12, cursor: 'text' }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 44, height: 52, borderRadius: 10,
                border: `1px solid ${shake ? '#C0554A' : '#E8E2D6'}`,
                background: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 600,
                color: '#1C1814',
              }}
            >
              {digits[i] ? '•' : ''}
            </div>
          ))}
        </div>

        <input
          ref={inputRef}
          value={digits}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 4);
            setDigits(v);
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoFocus
          style={{
            position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none',
          }}
        />
      </div>

      <style>{`
        @keyframes loginShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};

export default PinGate;

export interface TierStyle {
  grad: string;
  softGrad: string;
  fg: string;
  accent: string;
  bg: string;
  glow: string;
  badgeFg: string;
  intensity: number;
  metalGrad: string;
  bgFar: string;
  bgMid: string;
  bgNear: string;
  particle: string;
  ringGlow: string;
  diamante?: boolean;
}

export const TIER_STYLES: Record<string, TierStyle> = {
  bronze: {
    grad: 'linear-gradient(135deg, #F4D3B0 0%, #C9824D 45%, #8B4A1F 100%)',
    softGrad: 'linear-gradient(135deg, #FAEDDF 0%, #F4D3B0 100%)',
    fg: '#5C2E0F', accent: '#B26A3C', bg: '#FAEDDF',
    glow: '0 8px 24px rgba(178,106,60,0.30)',
    badgeFg: '#2A1404',
    intensity: 1,
    metalGrad: 'linear-gradient(135deg, #F4D3B0 0%, #C9824D 28%, #FFEAD0 48%, #6B3815 70%, #C9824D 100%)',
    bgFar:  '#FAEDDF',
    bgMid:  '#F2D9B8',
    bgNear: '#E5B47F',
    particle: '#C9824D',
    ringGlow: 'rgba(178,106,60,0.55)',
  },
  prata: {
    grad: 'linear-gradient(135deg, #F0F2F4 0%, #C7CCD2 40%, #8A929B 75%, #BBC1C7 100%)',
    softGrad: 'linear-gradient(135deg, #F5F7F9 0%, #DBDFE3 100%)',
    fg: '#2E3338', accent: '#8A929B', bg: '#EEF1F4',
    glow: '0 8px 24px rgba(138,146,155,0.25)',
    badgeFg: '#1F2428',
    intensity: 2,
    metalGrad: 'linear-gradient(135deg, #FFFFFF 0%, #C7CCD2 28%, #FFFFFF 50%, #6E767F 72%, #C7CCD2 100%)',
    bgFar:  '#EEF1F4',
    bgMid:  '#DDE2E7',
    bgNear: '#B9C0C7',
    particle: '#8A929B',
    ringGlow: 'rgba(138,146,155,0.55)',
  },
  ouro: {
    grad: 'linear-gradient(135deg, #FCEFB0 0%, #E8C547 45%, #B38A1F 100%)',
    softGrad: 'linear-gradient(135deg, #FBF3D0 0%, #F1DC92 100%)',
    fg: '#5C4500', accent: '#C9A227', bg: '#FBF3D0',
    glow: '0 8px 24px rgba(201,162,39,0.32)',
    badgeFg: '#3D2D00',
    intensity: 3,
    metalGrad: 'linear-gradient(135deg, #FFF6C4 0%, #E8C547 28%, #FFF8D6 48%, #8E6B0F 70%, #E8C547 100%)',
    bgFar:  '#FBF3D0',
    bgMid:  '#F5E59B',
    bgNear: '#E8C547',
    particle: '#E8C547',
    ringGlow: 'rgba(201,162,39,0.65)',
  },
  platina: {
    grad: 'linear-gradient(135deg, #F0F5F8 0%, #C5D2DC 40%, #6B8A9E 78%, #A8B8C5 100%)',
    softGrad: 'linear-gradient(135deg, #EFF4F7 0%, #C5D2DC 100%)',
    fg: '#1F3340', accent: '#6B8A9E', bg: '#E8EFF4',
    glow: '0 8px 24px rgba(107,138,158,0.28)',
    badgeFg: '#15242F',
    intensity: 4,
    metalGrad: 'linear-gradient(135deg, #FFFFFF 0%, #C5D2DC 28%, #FFFFFF 48%, #4A6577 70%, #A8B8C5 100%)',
    bgFar:  '#E8EFF4',
    bgMid:  '#C9D6E0',
    bgNear: '#9CB1C0',
    particle: '#6B8A9E',
    ringGlow: 'rgba(107,138,158,0.6)',
  },
  rubi: {
    grad: 'linear-gradient(135deg, #F8B8C2 0%, #DC4565 45%, #8A1426 100%)',
    softGrad: 'linear-gradient(135deg, #FBE5E9 0%, #F0A8B3 100%)',
    fg: '#5C0F1A', accent: '#C32E47', bg: '#FBE5E9',
    glow: '0 8px 24px rgba(195,46,71,0.30)',
    badgeFg: '#FBE5E9',
    intensity: 5,
    metalGrad: 'linear-gradient(135deg, #FFD0D8 0%, #DC4565 22%, #FFFFFF 42%, #5C0F1A 65%, #DC4565 100%)',
    bgFar:  '#FBE5E9',
    bgMid:  '#F2A4B2',
    bgNear: '#DC4565',
    particle: '#DC4565',
    ringGlow: 'rgba(220,69,101,0.7)',
  },
  esmeralda: {
    grad: 'linear-gradient(135deg, #B5E2C9 0%, #2DA070 45%, #0F5C3F 100%)',
    softGrad: 'linear-gradient(135deg, #E0F2E8 0%, #9FD4B8 100%)',
    fg: '#0E3A2A', accent: '#1F8A5B', bg: '#E0F2E8',
    glow: '0 8px 24px rgba(31,138,91,0.28)',
    badgeFg: '#E0F2E8',
    intensity: 6,
    metalGrad: 'linear-gradient(135deg, #C8F2DC 0%, #2DA070 22%, #FFFFFF 42%, #0E3A2A 65%, #2DA070 100%)',
    bgFar:  '#E0F2E8',
    bgMid:  '#9FD4B8',
    bgNear: '#2DA070',
    particle: '#2DA070',
    ringGlow: 'rgba(45,160,112,0.7)',
  },
  diamante: {
    grad: 'linear-gradient(135deg, #FCE4F0 0%, #DCEAFE 25%, #E1F4FA 50%, #F0E4FC 75%, #FCE4F0 100%)',
    softGrad: 'linear-gradient(135deg, #F8F2FB 0%, #EEF2FB 50%, #F4F8FC 100%)',
    fg: '#1A2B4F', accent: '#6B7DD9', bg: '#EEF2FB',
    glow: '0 8px 32px rgba(107,125,217,0.34)',
    badgeFg: '#1A2B4F',
    diamante: true,
    intensity: 7,
    metalGrad: 'linear-gradient(135deg, #FCE4F0 0%, #DCEAFE 18%, #C4F4E5 36%, #FFF1B5 54%, #F0C4FC 72%, #DCEAFE 100%)',
    bgFar:  '#F4F2FA',
    bgMid:  '#E2EAFB',
    bgNear: '#CDE0F8',
    particle: '#A8B6F2',
    ringGlow: 'rgba(107,125,217,0.7)',
  },
  cf: {
    grad: 'linear-gradient(135deg, #F5F1E5 0%, #D8D0C0 100%)',
    softGrad: 'linear-gradient(135deg, #F5F1E5 0%, #E8E2D2 100%)',
    fg: '#2A2620', accent: '#6B6258', bg: '#F2EEE2',
    glow: '0 8px 24px rgba(107,98,88,0.18)',
    badgeFg: '#2A2620',
    intensity: 0,
    metalGrad: 'linear-gradient(135deg, #F5F1E5 0%, #D8D0C0 50%, #F5F1E5 100%)',
    bgFar:  '#FAF7F2',
    bgMid:  '#F2EEE2',
    bgNear: '#E8E2D2',
    particle: '#9B9287',
    ringGlow: 'rgba(107,98,88,0.35)',
  },
};

export interface TierDefinition {
  id: string;
  name: string;
  material: string;
  papelValue: string;
}

export const TIER_DEFINITIONS: TierDefinition[] = [
  { id: 'bronze', name: 'Bronze', material: 'Cobre', papelValue: 'Bronze' },
  { id: 'prata', name: 'Prata', material: 'Prata', papelValue: 'Prata' },
  { id: 'ouro', name: 'Ouro', material: 'Ouro', papelValue: 'Ouro' },
  { id: 'platina', name: 'Platina', material: 'Platina', papelValue: 'Platina' },
  { id: 'rubi', name: 'Rubi', material: 'Rubi', papelValue: 'Rubi' },
  { id: 'esmeralda', name: 'Esmeralda GB', material: 'Esmeralda', papelValue: 'Esmeralda GB' },
  { id: 'diamante', name: 'Diamante GB', material: 'Diamante', papelValue: 'Diamante GB' },
  { id: 'cf', name: 'Consumidor Final', material: 'Final', papelValue: 'Consumidor Final' },
];

export function papelToTierId(papel: string): string {
  const def = TIER_DEFINITIONS.find(d => d.papelValue === papel);
  return def ? def.id : 'cf';
}

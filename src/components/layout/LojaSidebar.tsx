import React from 'react';
import { motion } from 'framer-motion';
import GlossyContent from '../ui/GlossyContent';

interface LojaSidebarProps {
  active: string;
  onNavigate: (route: string) => void;
}

const navItems = [
  { id: 'loja-overview',    label: 'Ranking geral',      icon: 'ph-trophy', hint: 'Visão consolidada de todas as lojas por GMV (Gross Merchandise Value).' },
  { id: 'loja-perfil',      label: 'Perfil da loja',     icon: 'ph-storefront', hint: 'Tudo sobre uma loja em um só lugar — GMV, canais, produtos, pedidos, Fidelidade e logística.' },
  { id: 'loja-scorecard',   label: 'Indicadores PEF',    icon: 'ph-gauge', hint: 'Scorecard com os ~20 indicadores do Resumo de Performance — Meta PEF, realizado e comparativo com o ano anterior.' },
  { id: 'loja-consultores', label: 'Consultores',        icon: 'ph-users', hint: 'Desempenho individual de consultores e operadores.' },
  { id: 'loja-canais',      label: 'Canais & Formas',    icon: 'ph-share-network', hint: 'Mix de canais de venda e formas de pagamento.' },
  { id: 'loja-categorias',  label: 'Categorias',         icon: 'ph-tag', hint: 'Mix de categoria, subcategoria, linha e marca de produto.' },
  { id: 'loja-abc',         label: 'Curva ABC',          icon: 'ph-chart-bar', hint: 'Classificação de produtos por importância no faturamento (A, B, C).' },
  { id: 'loja-pedidos',     label: 'Gestão de pedidos',  icon: 'ph-package', hint: 'Ciclo de reposição de estoque: sugestão, colocação e atendimento.' },
  { id: 'loja-logistica',   label: 'Logística',          icon: 'ph-truck', hint: 'Adesão à plataforma de transferência entre lojas, rotas e pedidos em aberto.' },
  { id: 'loja-periodo',     label: 'Período',            icon: 'ph-calendar-dots', hint: 'GMV dia a dia e sazonalidade por dia da semana.' },
  { id: 'loja-horario',     label: 'Venda por hora',     icon: 'ph-clock', hint: 'Distribuição de vendas por faixa de horário do dia.' },
  { id: 'loja-fidelidade-servicos', label: 'Fidelidade & serviços', icon: 'ph-heart', hint: 'Programa Fidelidade, Serviços em loja, Loja Digital e Cuidados Faciais + Botik.' },
  { id: 'loja-import',      label: 'Importar',           icon: 'ph-upload-simple', hint: 'Importar os arquivos CSV/xlsx do relatório gerencial.' },
];

const LojaSidebar: React.FC<LojaSidebarProps> = ({ active, onNavigate }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 64, bottom: 0, left: 0, width: 264,
      background: 'var(--loja-bg, #FAF7F2)',
      borderRight: '1px solid var(--loja-border-soft, rgba(28,24,20,0.08))',
      padding: '22px 14px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    }}>
      {navItems.map(item => {
        const isActive = active === item.id;
        return (
          <motion.div
            key={item.id}
            className={`glossy-btn${isActive ? ' glossy-active' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={item.hint}
            style={{ borderRadius: 11, fontSize: 15 }}
            whileHover={{ scale: 1.025, x: 2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          >
            <GlossyContent
              justify="flex-start"
              icon={<i className={`ph ${isActive ? 'ph-bold' : ''} ${item.icon}`} style={{ fontSize: 20 }} />}
            >
              {item.label}
            </GlossyContent>
          </motion.div>
        );
      })}
    </div>
  );
};

export default LojaSidebar;

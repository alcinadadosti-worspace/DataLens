import { useCallback } from 'react';
import { exportToCSV, exportToXLSX } from '../services/exportService';
import { Order } from '../types/order';

export function useExport(orders: Order[]) {
  const exportCSV = useCallback(() => {
    const data = orders.map(o => ({
      'Código Pedido': o.CodigoPedido,
      'Nome Pessoa': o.NomePessoa,
      'Pessoa': o.Pessoa,
      'Papel': o.Papel,
      'Valor Praticado': o.ValorPraticado,
      'Valor Líquido': o.ValorLiquido,
      'Qtde Materiais': o.QtdeMateriais,
      'Meio Captação': o.MeioCaptacao,
      'Modelo Comercial': o.ModeloComercial,
      'Situação Comercial': o.SituacaoComercial,
      'Detalhe Situação': o.DetalheSituacaoComercial,
      'Ciclo Marketing': o.CicloMarketing,
      'Responsável Estrutura': o.ResponsavelEstrutura,
      'Estrutura': o.Estrutura,
      'Cidade Entrega': o.CidadeEntregaRetirada,
      'UF Entrega': o.UFEntregaRetirada,
      'Data Captação': o.DataCaptacao,
      'Data Aprovação': o.DataAprovacao,
      'Data Autorização': o.DataAutorizacaoFaturamento,
    }));
    exportToCSV(data, `datalens-pedidos-${new Date().toISOString().slice(0, 10)}`);
  }, [orders]);

  const exportXLSX = useCallback(() => {
    const data = orders.map(o => ({
      'Código Pedido': o.CodigoPedido,
      'Nome Pessoa': o.NomePessoa,
      'Pessoa': o.Pessoa,
      'Papel': o.Papel,
      'Valor Praticado': o.ValorPraticado,
      'Valor Líquido': o.ValorLiquido,
      'Qtde Materiais': o.QtdeMateriais,
      'Meio Captação': o.MeioCaptacao,
      'Modelo Comercial': o.ModeloComercial,
      'Situação Comercial': o.SituacaoComercial,
      'Detalhe Situação': o.DetalheSituacaoComercial,
      'Ciclo Marketing': o.CicloMarketing,
      'Responsável Estrutura': o.ResponsavelEstrutura,
      'Estrutura': o.Estrutura,
      'Cidade Entrega': o.CidadeEntregaRetirada,
      'UF Entrega': o.UFEntregaRetirada,
    }));
    exportToXLSX(data, `datalens-pedidos-${new Date().toISOString().slice(0, 10)}`);
  }, [orders]);

  return { exportCSV, exportXLSX };
}

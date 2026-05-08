import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Order, ParseResult } from '../types/order';
import { papelToTierId } from '../design-system/tierStyles';

// Column name mapping from spreadsheet to Order interface
const COLUMN_MAP: Record<string, keyof Order> = {
  'CodigoPedido': 'CodigoPedido',
  'Código Pedido': 'CodigoPedido',
  'SituaçãoFiscal': 'SituacaoFiscal',
  'Situação Fiscal': 'SituacaoFiscal',
  'Pessoa': 'Pessoa',
  'NomePessoa': 'NomePessoa',
  'Nome Pessoa': 'NomePessoa',
  'Papel': 'Papel',
  'QtdeMateriais': 'QtdeMateriais',
  'Qtde Materiais': 'QtdeMateriais',
  'QtdMateriais': 'QtdeMateriais',
  'ValorPraticado': 'ValorPraticado',
  'Valor Praticado': 'ValorPraticado',
  'ValorLiquido': 'ValorLiquido',
  'Valor Liquido': 'ValorLiquido',
  'Valor Líquido': 'ValorLiquido',
  'MeioCaptacao': 'MeioCaptacao',
  'Meio Captação': 'MeioCaptacao',
  'Meio Captacao': 'MeioCaptacao',
  'ModeloComercial': 'ModeloComercial',
  'Modelo Comercial': 'ModeloComercial',
  'SituaçãoComercial': 'SituacaoComercial',
  'Situação Comercial': 'SituacaoComercial',
  'SituacaoComercial': 'SituacaoComercial',
  'DetalheSituaçãoComercial': 'DetalheSituacaoComercial',
  'Detalhe Situação Comercial': 'DetalheSituacaoComercial',
  'DetalheSituacaoComercial': 'DetalheSituacaoComercial',
  'Data Captação': 'DataCaptacao',
  'Data Captacao': 'DataCaptacao',
  'DataCaptacao': 'DataCaptacao',
  'Data Aprovação': 'DataAprovacao',
  'Data Aprovacao': 'DataAprovacao',
  'DataAprovacao': 'DataAprovacao',
  'DataAutorizaçãoFaturamento': 'DataAutorizacaoFaturamento',
  'Data Autorização Faturamento': 'DataAutorizacaoFaturamento',
  'DataAutorizacaoFaturamento': 'DataAutorizacaoFaturamento',
  'DataEntrega': 'DataEntrega',
  'Data Entrega': 'DataEntrega',
  'Ciclo Marketing': 'CicloMarketing',
  'CicloMarketing': 'CicloMarketing',
  'Dia do Ciclo': 'DiaDoCiclo',
  'DiaDoCiclo': 'DiaDoCiclo',
  'Estrutura': 'Estrutura',
  'Cód Estrutura': 'CodEstrutura',
  'CodEstrutura': 'CodEstrutura',
  'Cód Estrutura Pai': 'CodEstruturaPai',
  'CodEstruturaPai': 'CodEstruturaPai',
  'Responsável Estrutura': 'ResponsavelEstrutura',
  'ResponsavelEstrutura': 'ResponsavelEstrutura',
  'Telefone Responsável': 'TelefoneResponsavel',
  'TelefoneResponsavel': 'TelefoneResponsavel',
  'Usuario de Criação': 'UsuarioCriacao',
  'UsuarioCriacao': 'UsuarioCriacao',
  'Usuario de Finalização': 'UsuarioFinalizacao',
  'UsuarioFinalizacao': 'UsuarioFinalizacao',
  'Logradouro': 'Logradouro',
  'Bairro': 'Bairro',
  'Cidade': 'Cidade',
  'UF': 'UF',
  'CEP': 'CEP',
  'LogradouroEntrega': 'LogradouroEntrega',
  'Logradouro Entrega': 'LogradouroEntrega',
  'BairroEntregaRetirada': 'BairroEntregaRetirada',
  'Bairro Entrega': 'BairroEntregaRetirada',
  'CidadeEntregaRetirada': 'CidadeEntregaRetirada',
  'Cidade Entrega': 'CidadeEntregaRetirada',
  'UFEntregaRetirada': 'UFEntregaRetirada',
  'UF Entrega': 'UFEntregaRetirada',
  'CEPEntregaRetirada': 'CEPEntregaRetirada',
  'CEP Entrega': 'CEPEntregaRetirada',
  'Peso Real': 'PesoReal',
  'PesoReal': 'PesoReal',
  'CodModeloComercial': 'CodModeloComercial',
  'Cod Modelo Comercial': 'CodModeloComercial',
};

function parseNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/\./g, '').replace(',', '.').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function mapRow(raw: Record<string, unknown>): Order {
  const mapped: Partial<Record<keyof Order, unknown>> = {};

  for (const [rawKey, value] of Object.entries(raw)) {
    const normalizedKey = rawKey.trim();
    const orderKey = COLUMN_MAP[normalizedKey];
    if (orderKey) {
      mapped[orderKey] = value;
    }
  }

  const papel = parseStr(mapped.Papel);
  const tierId = papelToTierId(papel);

  return {
    CodigoPedido: parseStr(mapped.CodigoPedido),
    SituacaoFiscal: parseStr(mapped.SituacaoFiscal),
    Pessoa: parseStr(mapped.Pessoa),
    NomePessoa: parseStr(mapped.NomePessoa),
    Papel: papel,
    tierId,
    QtdeMateriais: parseNum(mapped.QtdeMateriais),
    ValorPraticado: parseNum(mapped.ValorPraticado),
    ValorLiquido: parseNum(mapped.ValorLiquido),
    MeioCaptacao: parseStr(mapped.MeioCaptacao),
    ModeloComercial: parseStr(mapped.ModeloComercial),
    SituacaoComercial: parseStr(mapped.SituacaoComercial),
    DetalheSituacaoComercial: parseStr(mapped.DetalheSituacaoComercial),
    DataCaptacao: parseStr(mapped.DataCaptacao),
    DataAprovacao: parseStr(mapped.DataAprovacao),
    DataAutorizacaoFaturamento: parseStr(mapped.DataAutorizacaoFaturamento),
    DataEntrega: parseStr(mapped.DataEntrega),
    CicloMarketing: parseStr(mapped.CicloMarketing),
    DiaDoCiclo: parseStr(mapped.DiaDoCiclo),
    Estrutura: parseStr(mapped.Estrutura),
    CodEstrutura: parseStr(mapped.CodEstrutura),
    CodEstruturaPai: parseStr(mapped.CodEstruturaPai),
    ResponsavelEstrutura: parseStr(mapped.ResponsavelEstrutura),
    TelefoneResponsavel: parseStr(mapped.TelefoneResponsavel),
    UsuarioCriacao: parseStr(mapped.UsuarioCriacao),
    UsuarioFinalizacao: parseStr(mapped.UsuarioFinalizacao),
    Logradouro: parseStr(mapped.Logradouro),
    Bairro: parseStr(mapped.Bairro),
    Cidade: parseStr(mapped.Cidade),
    UF: parseStr(mapped.UF),
    CEP: parseStr(mapped.CEP),
    LogradouroEntrega: parseStr(mapped.LogradouroEntrega),
    BairroEntregaRetirada: parseStr(mapped.BairroEntregaRetirada),
    CidadeEntregaRetirada: parseStr(mapped.CidadeEntregaRetirada),
    UFEntregaRetirada: parseStr(mapped.UFEntregaRetirada),
    CEPEntregaRetirada: parseStr(mapped.CEPEntregaRetirada),
    PesoReal: parseNum(mapped.PesoReal),
    CodModeloComercial: parseStr(mapped.CodModeloComercial),
  };
}

function isFVC(order: Order): boolean {
  return order.Estrutura.trimStart().toUpperCase().startsWith('FVC');
}

export async function parseXLSX(file: File): Promise<ParseResult> {
  const errors: string[] = [];

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: true,
    });

    if (rawRows.length === 0) {
      return { orders: [], errors: ['Planilha vazia'], rowCount: 0, fvcExcludedCount: 0, detectedColumns: [] };
    }

    const detectedColumns = Object.keys(rawRows[0]);
    const mapped = rawRows.map((row, i) => {
      try {
        return mapRow(row);
      } catch (e) {
        errors.push(`Linha ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    }).filter((o): o is Order => o !== null);
    const orders = mapped.filter(o => !isFVC(o));
    const fvcExcludedCount = mapped.length - orders.length;

    return { orders, errors, rowCount: rawRows.length, fvcExcludedCount, detectedColumns };
  } catch (e) {
    return {
      orders: [],
      errors: [`Erro ao ler arquivo: ${e instanceof Error ? e.message : String(e)}`],
      rowCount: 0,
      fvcExcludedCount: 0,
      detectedColumns: [],
    };
  }
}

export async function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      encoding: 'UTF-8',
      complete: (result) => {
        const errors: string[] = result.errors.map(e => `Linha ${e.row}: ${e.message}`);
        const detectedColumns = result.meta.fields ?? [];

        const mapped = result.data.map((row, i) => {
          try {
            return mapRow(row);
          } catch (e) {
            errors.push(`Linha ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
            return null;
          }
        }).filter((o): o is Order => o !== null);
        const orders = mapped.filter(o => !isFVC(o));
        const fvcExcludedCount = mapped.length - orders.length;

        resolve({
          orders,
          errors,
          rowCount: result.data.length,
          fvcExcludedCount,
          detectedColumns,
        });
      },
      error: (err) => {
        resolve({
          orders: [],
          errors: [`Erro ao parsear CSV: ${err.message}`],
          rowCount: 0,
          fvcExcludedCount: 0,
          detectedColumns: [],
        });
      },
    });
  });
}

export async function parseSpreadsheet(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    return parseCSV(file);
  }
  return parseXLSX(file);
}

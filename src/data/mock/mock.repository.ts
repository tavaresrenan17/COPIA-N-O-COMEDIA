import { IErpRepository, FiltroParcelas, TituloInput } from '../repository.interface';
import { rateiosDoItem, rateiosSemItem, RateioCasado } from '../orcamento/casamento-rateio';
import { 
  Pessoa, 
  PlanoConta, 
  CentroCusto, 
  ContaBancaria, 
  Subempresa,
  GrupoLinhaCusto,
  LinhaCusto,
  GrupoGestao,
  LinhaGestao,
  Titulo,
  TituloParcela,
  TituloRateio,
  Movimento,
  ParcelaView,
  TipoTitulo,
  StatusParcela,
  FormaPagamentoMovimento,
  FiltroFluxoCaixa,
  FluxoCaixaResultado,
  FluxoCaixaBucket,
  FluxoCaixaLancamento,
  FiltroDashboard,
  DashboardExecutiveData,
  DespesaCentroCustoItem,
  DespesaPlanoContaGroup,
  DespesaPlanoContaFolhaItem,
  TopPessoaItem,
  Cliente, 
  Fornecedor, 
  ContaPagar, 
  ContaReceber, 
  OrcamentoDAV, 
  DashboardMetrics,
  OrcamentoEmpreendimento,
  OrcamentoItem,
  OrcamentoExecucaoView,
  OrcamentoExecucaoItemView,
  OrcamentoCurvaSPonto,
  StatusOrcamentoEmpreendimento,
  Orcamento,
  ComprometidoTituloItem,
  RealizadoMovimentoItem,
  DisponibilidadeOrcamentariaResultado,
  Recorrencia,
  StatusRecorrencia,
  FrequenciaRecorrencia,
  GeracaoRetroativaSimulacaoResultado,
  GeracaoRetroativaOcorrenciaItem,
  RecorrenciaOcorrencia,
  RecorrenciaReajuste,
  LogExecucaoFila,
  Feriado,
  ProximaOcorrenciaPrevia,
  RecorrenciaRateio,
  AjusteDiaUtilRecorrencia,
  StatusConciliacaoItem,
  ExtratoBancarioItem,
  ResumoSaldosConciliacao,
  ConciliacaoLog,
  ExtratoImportacao,
  ExtratoLancamento,
  ConciliacaoRegra,
  SugestaoCasamento,
  PreviewImportacaoOFX,
  ResumoSaldosConciliacaoEtapa9
} from '../types';




let mockFeriados: Feriado[] = [
  { data: '2026-01-01', descricao: 'Confraternização Universal' },
  { data: '2026-02-16', descricao: 'Carnaval (Segunda)' },
  { data: '2026-02-17', descricao: 'Carnaval (Terça)' },
  { data: '2026-04-03', descricao: 'Sexta-feira Santa' },
  { data: '2026-04-21', descricao: 'Tiradentes' },
  { data: '2026-05-01', descricao: 'Dia do Trabalho' },
  { data: '2026-06-04', descricao: 'Corpus Christi' },
  { data: '2026-09-07', descricao: 'Independência do Brasil' },
  { data: '2026-10-12', descricao: 'Nossa Senhora Aparecida' },
  { data: '2026-11-02', descricao: 'Finados' },
  { data: '2026-11-15', descricao: 'Proclamação da República' },
  { data: '2026-12-25', descricao: 'Natal' }
];

let mockRecorrencias: Recorrencia[] = [];
let mockRecorrenciaOcorrencias: RecorrenciaOcorrencia[] = [];
let mockRecorrenciaReajustes: RecorrenciaReajuste[] = [];
let mockRecorrenciaLogs: LogExecucaoFila[] = [];
let mockOrcamentosEmpreendimento: Orcamento[] = [];

// Mock Data: Plano de Contas Oficial (Dimensão Contábil Base DRE)
let mockPlanoContas: PlanoConta[] = [
  { id: 'pc-1', codigo: '1', nome: 'RECEITAS', parentId: null, natureza: 'receita', nivel: 1, aceitaLancamento: false, ativo: true },
  { id: 'pc-1.1', codigo: '1.1', nome: 'Receita operacional', parentId: 'pc-1', natureza: 'receita', nivel: 2, aceitaLancamento: false, ativo: true },
  { id: 'pc-1.1.01', codigo: '1.1.01', nome: 'Locação de equipamentos', parentId: 'pc-1.1', natureza: 'receita', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-1.1.02', codigo: '1.1.02', nome: 'Empreitada', parentId: 'pc-1.1', natureza: 'receita', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-1.1.03', codigo: '1.1.03', nome: 'Venda de material', parentId: 'pc-1.1', natureza: 'receita', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-1.2', codigo: '1.2', nome: 'Receita não operacional', parentId: 'pc-1', natureza: 'receita', nivel: 2, aceitaLancamento: false, ativo: true },
  { id: 'pc-1.2.01', codigo: '1.2.01', nome: 'Venda de ativo', parentId: 'pc-1.2', natureza: 'receita', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-1.2.02', codigo: '1.2.02', nome: 'Rendimento de aplicação', parentId: 'pc-1.2', natureza: 'receita', nivel: 3, aceitaLancamento: true, ativo: true },

  { id: 'pc-2', codigo: '2', nome: 'CUSTOS DIRETOS', parentId: null, natureza: 'custo', nivel: 1, aceitaLancamento: false, ativo: true },
  { id: 'pc-2.1', codigo: '2.1', nome: 'Mão de obra', parentId: 'pc-2', natureza: 'custo', nivel: 2, aceitaLancamento: false, ativo: true },
  { id: 'pc-2.1.01', codigo: '2.1.01', nome: 'Salários de obra', parentId: 'pc-2.1', natureza: 'custo', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-2.1.02', codigo: '2.1.02', nome: 'Encargos', parentId: 'pc-2.1', natureza: 'custo', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-2.1.03', codigo: '2.1.03', nome: 'Empreiteiros terceiros', parentId: 'pc-2.1', natureza: 'custo', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-2.2', codigo: '2.2', nome: 'Material', parentId: 'pc-2', natureza: 'custo', nivel: 2, aceitaLancamento: false, ativo: true },
  { id: 'pc-2.2.01', codigo: '2.2.01', nome: 'Material de construção', parentId: 'pc-2.2', natureza: 'custo', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-2.2.02', codigo: '2.2.02', nome: 'Material elétrico', parentId: 'pc-2.2', natureza: 'custo', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-2.3', codigo: '2.3', nome: 'Equipamento', parentId: 'pc-2', natureza: 'custo', nivel: 2, aceitaLancamento: false, ativo: true },
  { id: 'pc-2.3.01', codigo: 'pc-2.3.01', nome: 'Locação de terceiros', parentId: 'pc-2.3', natureza: 'custo', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-2.3.02', codigo: 'pc-2.3.02', nome: 'Manutenção de máquinas', parentId: 'pc-2.3', natureza: 'custo', nivel: 3, aceitaLancamento: true, ativo: true },
  { id: 'pc-2.3.03', codigo: 'pc-2.3.03', nome: 'Combustível', parentId: 'pc-2.3', natureza: 'custo', nivel: 3, aceitaLancamento: true, ativo: true },

  { id: 'pc-3', codigo: '3', nome: 'DESPESAS ADMINISTRATIVAS', parentId: null, natureza: 'despesa', nivel: 1, aceitaLancamento: false, ativo: true },
  { id: 'pc-3.1.01', codigo: '3.1.01', nome: 'Salários administrativos', parentId: 'pc-3', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },
  { id: 'pc-3.1.02', codigo: '3.1.02', nome: 'Aluguel', parentId: 'pc-3', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },
  { id: 'pc-3.1.03', codigo: '3.1.03', nome: 'Contabilidade e jurídico', parentId: 'pc-3', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },
  { id: 'pc-3.1.04', codigo: '3.1.04', nome: 'Software e telefonia', parentId: 'pc-3', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },

  { id: 'pc-4', codigo: '4', nome: 'DESPESAS FINANCEIRAS', parentId: null, natureza: 'despesa', nivel: 1, aceitaLancamento: false, ativo: true },
  { id: 'pc-4.1.01', codigo: '4.1.01', nome: 'Juros e multas pagos', parentId: 'pc-4', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },
  { id: 'pc-4.1.02', codigo: '4.1.02', nome: 'Tarifas bancárias', parentId: 'pc-4', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },
  { id: 'pc-4.1.03', codigo: '4.1.03', nome: 'IOF', parentId: 'pc-4', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },

  { id: 'pc-5', codigo: '5', nome: 'IMPOSTOS', parentId: null, natureza: 'despesa', nivel: 1, aceitaLancamento: false, ativo: true },
  { id: 'pc-5.1.01', codigo: '5.1.01', nome: 'Simples Nacional/DAS', parentId: 'pc-5', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },
  { id: 'pc-5.1.02', codigo: '5.1.02', nome: 'ISS retido', parentId: 'pc-5', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },
  { id: 'pc-5.1.03', codigo: '5.1.03', nome: 'INSS retido', parentId: 'pc-5', natureza: 'despesa', nivel: 2, aceitaLancamento: true, ativo: true },

  { id: 'pc-6', codigo: '6', nome: 'INVESTIMENTOS', parentId: null, natureza: 'investimento', nivel: 1, aceitaLancamento: false, ativo: true },
  { id: 'pc-6.1.01', codigo: '6.1.01', nome: 'Aquisição de máquina', parentId: 'pc-6', natureza: 'investimento', nivel: 2, aceitaLancamento: true, ativo: true },
  { id: 'pc-6.1.02', codigo: '6.1.02', nome: 'Aquisição de veículo', parentId: 'pc-6', natureza: 'investimento', nivel: 2, aceitaLancamento: true, ativo: true },
];

let mockCentrosCusto: CentroCusto[] = [
  { id: 'cc-999', codigo: '999', nome: 'Não alocado', parentId: null, tipo: 'administrativo', nivel: 1, aceitaLancamento: true, ativo: true }
];
let mockPessoas: Pessoa[] = [];
let mockGruposGestao: GrupoGestao[] = [];
let mockLinhasGestao: LinhaGestao[] = [];
let mockContasBancarias: ContaBancaria[] = [];
let mockExtratoImportacoes: ExtratoImportacao[] = [];
let mockConciliacaoRegras: ConciliacaoRegra[] = [];
let mockExtratoItems: ExtratoLancamento[] = [];
let mockConciliacaoLogs: ConciliacaoLog[] = [];
let mockSubempresas: Subempresa[] = [];
let mockGruposLinhaCusto: GrupoLinhaCusto[] = [];
let mockLinhasCusto: LinhaCusto[] = [];

let nextTituloSeqCounter = 1;

let mockContasPagar: ContaPagar[] = [];
let mockContasReceber: ContaReceber[] = [];
let mockOrcamentos: OrcamentoDAV[] = [];
let mockTitulos: Titulo[] = [];
let mockMovimentos: Movimento[] = [];

export class MockErpRepository implements IErpRepository {
  // ---------------------------------------------------------------------------
  // 1. PESSOA
  // ---------------------------------------------------------------------------
  async getPessoas(filtro?: { apenasAtivos?: boolean; apenasClientes?: boolean; apenasFornecedores?: boolean }): Promise<Pessoa[]> {
    let result = [...mockPessoas];
    if (filtro?.apenasAtivos !== false) result = result.filter(p => p.ativo);
    if (filtro?.apenasClientes) result = result.filter(p => p.isCliente);
    if (filtro?.apenasFornecedores) result = result.filter(p => p.isFornecedor);
    return result;
  }
  async getPessoaById(id: string): Promise<Pessoa | null> {
    return mockPessoas.find(p => p.id === id) || null;
  }
  async createPessoa(data: Omit<Pessoa, 'id' | 'createdAt' | 'updatedAt'>): Promise<Pessoa> {
    if (!data.isCliente && !data.isFornecedor) throw new Error('Marque Cliente ou Fornecedor.');
    // Id sequencial: o código exibido nas telas deriva dos dígitos do id (ex.: pes-8 -> 000008).
    const proximoNumero = mockPessoas.reduce((m, p) => Math.max(m, parseInt(p.id.replace(/\D/g, ''), 10) || 0), 0) + 1;
    const newP = { ...data, id: `pes-${proximoNumero}`, ativo: data.ativo ?? true, createdAt: new Date().toISOString().split('T')[0] };
    mockPessoas.unshift(newP);
    return newP;
  }
  async updatePessoa(id: string, data: Partial<Pessoa>): Promise<Pessoa> {
    const idx = mockPessoas.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Pessoa não encontrada');
    mockPessoas[idx] = { ...mockPessoas[idx], ...data };
    return mockPessoas[idx];
  }
  async deletePessoa(id: string): Promise<boolean> {
    const idx = mockPessoas.findIndex(p => p.id === id);
    if (idx !== -1) mockPessoas[idx].ativo = false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // 2. PLANO DE CONTAS
  // ---------------------------------------------------------------------------
  async getPlanoContas(filtro?: { apenasAtivos?: boolean }): Promise<PlanoConta[]> {
    let result = [...mockPlanoContas];
    if (filtro?.apenasAtivos !== false) result = result.filter(pc => pc.ativo);
    return result;
  }
  async getPlanoContasFolhas(natureza?: string | string[]): Promise<PlanoConta[]> {
    let list = mockPlanoContas.filter(pc => pc.ativo && pc.aceitaLancamento);
    const naturezas = natureza ? (Array.isArray(natureza) ? natureza : [natureza]) : null;

    if (naturezas) list = list.filter(pc => naturezas.includes(pc.natureza));
    return list;
  }
  async getPlanoContaById(id: string): Promise<PlanoConta | null> {
    return mockPlanoContas.find(pc => pc.id === id) || null;
  }
  async createPlanoConta(data: Omit<PlanoConta, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlanoConta> {
    const newPc = { ...data, id: `pc-${Date.now()}`, ativo: data.ativo ?? true, createdAt: new Date().toISOString().split('T')[0] };
    mockPlanoContas.push(newPc);
    return newPc;
  }
  async updatePlanoConta(id: string, data: Partial<PlanoConta>): Promise<PlanoConta> {
    const idx = mockPlanoContas.findIndex(pc => pc.id === id);
    if (idx === -1) throw new Error('Plano de conta não encontrado');
    mockPlanoContas[idx] = { ...mockPlanoContas[idx], ...data };
    return mockPlanoContas[idx];
  }
  async deletePlanoConta(id: string): Promise<boolean> {
    const idx = mockPlanoContas.findIndex(pc => pc.id === id);
    if (idx !== -1) mockPlanoContas[idx].ativo = false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // 3. CENTRO DE CUSTOS
  // ---------------------------------------------------------------------------
  async getCentrosCusto(filtro?: { apenasAtivos?: boolean; subempresaId?: string }): Promise<CentroCusto[]> {
    let result = [...mockCentrosCusto];
    if (filtro?.apenasAtivos !== false) result = result.filter(cc => cc.ativo);
    if (filtro?.subempresaId) result = result.filter(cc => cc.subempresaId === filtro.subempresaId);
    return result;
  }
  async getCentroCustosFolhas(subempresaId?: string): Promise<CentroCusto[]> {
    let result = mockCentrosCusto.filter(cc => cc.ativo && cc.aceitaLancamento);
    if (subempresaId) result = result.filter(cc => cc.subempresaId === subempresaId);
    return result;
  }
  async getCentroCustoById(id: string): Promise<CentroCusto | null> {
    return mockCentrosCusto.find(cc => cc.id === id) || null;
  }
  async createCentroCusto(data: Omit<CentroCusto, 'id' | 'createdAt' | 'updatedAt' | 'gastoCentavos'>): Promise<CentroCusto> {
    let subempresaNome = data.subempresaNome;
    if (data.subempresaId && !subempresaNome) {
      const sub = mockSubempresas.find(s => s.id === data.subempresaId);
      if (sub) subempresaNome = sub.nome;
    }
    const newCc: CentroCusto = { 
      ...data, 
      subempresaNome,
      id: `cc-${Date.now()}`, 
      gastoCentavos: 0, 
      ativo: data.ativo ?? true, 
      createdAt: new Date().toISOString().split('T')[0] 
    };
    mockCentrosCusto.push(newCc);
    return newCc;
  }
  async updateCentroCusto(id: string, data: Partial<CentroCusto>): Promise<CentroCusto> {
    const idx = mockCentrosCusto.findIndex(cc => cc.id === id);
    if (idx === -1) throw new Error('Centro de custo não encontrado');
    let subempresaNome = data.subempresaNome ?? mockCentrosCusto[idx].subempresaNome;
    if (data.subempresaId && data.subempresaId !== mockCentrosCusto[idx].subempresaId) {
      const sub = mockSubempresas.find(s => s.id === data.subempresaId);
      if (sub) subempresaNome = sub.nome;
    }
    mockCentrosCusto[idx] = { ...mockCentrosCusto[idx], ...data, subempresaNome };
    return mockCentrosCusto[idx];
  }
  async deleteCentroCusto(id: string): Promise<boolean> {
    const idx = mockCentrosCusto.findIndex(cc => cc.id === id);
    if (idx !== -1) mockCentrosCusto[idx].ativo = false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // 4. CONTA BANCÁRIA
  // ---------------------------------------------------------------------------
  async getContasBancarias(filtro?: { apenasAtivos?: boolean }): Promise<ContaBancaria[]> {
    let result = [...mockContasBancarias];
    if (filtro?.apenasAtivos !== false) result = result.filter(cb => cb.ativo);
    return result;
  }
  async getContaBancariaById(id: string): Promise<ContaBancaria | null> {
    return mockContasBancarias.find(cb => cb.id === id) || null;
  }
  async createContaBancaria(data: Omit<ContaBancaria, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContaBancaria> {
    const newCb = { ...data, id: `cb-${Date.now()}`, ativo: data.ativo ?? true, createdAt: new Date().toISOString().split('T')[0] };
    mockContasBancarias.unshift(newCb);
    return newCb;
  }
  async updateContaBancaria(id: string, data: Partial<ContaBancaria>): Promise<ContaBancaria> {
    const idx = mockContasBancarias.findIndex(cb => cb.id === id);
    if (idx === -1) throw new Error('Conta bancária não encontrada');
    mockContasBancarias[idx] = { ...mockContasBancarias[idx], ...data };
    return mockContasBancarias[idx];
  }
  async deleteContaBancaria(id: string): Promise<boolean> {
    const idx = mockContasBancarias.findIndex(cb => cb.id === id);
    if (idx !== -1) mockContasBancarias[idx].ativo = false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // 4.4 GRUPO DE GESTÃO
  // ---------------------------------------------------------------------------
  async getGruposGestao(filtro?: { apenasAtivos?: boolean }): Promise<GrupoGestao[]> {
    let result = [...mockGruposGestao];
    if (filtro?.apenasAtivos !== false) {
      result = result.filter(g => g.ativo);
    }
    return result;
  }

  async getGrupoGestaoById(id: string): Promise<GrupoGestao | null> {
    return mockGruposGestao.find(g => g.id === id) || null;
  }

  async createGrupoGestao(data: Omit<GrupoGestao, 'id' | 'createdAt' | 'updatedAt'>): Promise<GrupoGestao> {
    const proximoSeq = mockGruposGestao.reduce((m, g) => Math.max(m, parseInt((g.codigo || '').replace(/\D/g, ''), 10) || 0), 0) + 1;
    const codigoSequencial = String(proximoSeq).padStart(3, '0');
    const newG: GrupoGestao = {
      id: `gg-${proximoSeq}`,
      codigo: data.codigo || codigoSequencial,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo !== false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    mockGruposGestao.unshift(newG);
    return newG;
  }

  async updateGrupoGestao(id: string, data: Partial<GrupoGestao>): Promise<GrupoGestao> {
    const idx = mockGruposGestao.findIndex(g => g.id === id);
    if (idx === -1) throw new Error('Grupo de Gestão não encontrado');
    mockGruposGestao[idx] = {
      ...mockGruposGestao[idx],
      ...data,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    return mockGruposGestao[idx];
  }

  async deleteGrupoGestao(id: string): Promise<boolean> {
    const idx = mockGruposGestao.findIndex(g => g.id === id);
    if (idx !== -1) {
      mockGruposGestao[idx].ativo = false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // 4.5 LINHA DE GESTÃO
  // ---------------------------------------------------------------------------
  async getLinhasGestao(grupoGestaoId?: string, filtro?: { apenasAtivos?: boolean }): Promise<LinhaGestao[]> {
    let result = [...mockLinhasGestao];
    if (grupoGestaoId) {
      result = result.filter(l => l.grupoGestaoId === grupoGestaoId);
    }
    if (filtro?.apenasAtivos !== false) {
      result = result.filter(l => l.ativo);
    }
    return result.map(l => {
      const g = mockGruposGestao.find(grupo => grupo.id === l.grupoGestaoId);
      return {
        ...l,
        grupoGestaoNome: g ? `${g.codigo} - ${g.nome}` : l.grupoGestaoNome,
      };
    });
  }

  async getLinhaGestaoById(id: string): Promise<LinhaGestao | null> {
    const l = mockLinhasGestao.find(item => item.id === id);
    if (!l) return null;
    const g = mockGruposGestao.find(grupo => grupo.id === l.grupoGestaoId);
    return {
      ...l,
      grupoGestaoNome: g ? `${g.codigo} - ${g.nome}` : l.grupoGestaoNome,
    };
  }

  async createLinhaGestao(data: Omit<LinhaGestao, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinhaGestao> {
    let grupo = mockGruposGestao.find(g => g.id === data.grupoGestaoId);
    if (!grupo && data.grupoGestaoId) {
      const grupos = await this.getGruposGestao();
      grupo = grupos.find(g => g.id === data.grupoGestaoId);
    }
    const proximoSeq = mockLinhasGestao.reduce((m, l) => Math.max(m, parseInt((l.codigo || '').replace(/\D/g, ''), 10) || 0), 0) + 1;
    const codigoSequencial = String(proximoSeq).padStart(3, '0');
    const obra = data.centroCustoId ? mockCentrosCusto.find(c => c.id === data.centroCustoId) : null;
    const newL: LinhaGestao = {
      id: `lg-${Date.now()}`,
      grupoGestaoId: data.grupoGestaoId,
      grupoGestaoNome: grupo?.nome,
      centroCustoId: data.centroCustoId,
      centroCustoCodigo: obra?.codigo,
      centroCustoNome: obra?.nome,
      codigo: data.codigo || codigoSequencial,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo !== false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    mockLinhasGestao.unshift(newL);
    return newL;
  }

  async updateLinhaGestao(id: string, data: Partial<LinhaGestao>): Promise<LinhaGestao> {
    const idx = mockLinhasGestao.findIndex(l => l.id === id);
    if (idx === -1) throw new Error('Linha de Gestão não encontrada');
    
    let grupo = data.grupoGestaoId ? mockGruposGestao.find(g => g.id === data.grupoGestaoId) : null;
    if (!grupo && data.grupoGestaoId) {
      const grupos = await this.getGruposGestao();
      grupo = grupos.find(g => g.id === data.grupoGestaoId) || null;
    }

    const obra = data.centroCustoId ? mockCentrosCusto.find(c => c.id === data.centroCustoId) : null;

    mockLinhasGestao[idx] = {
      ...mockLinhasGestao[idx],
      ...data,
      grupoGestaoNome: grupo ? grupo.nome : mockLinhasGestao[idx].grupoGestaoNome,
      // Sem isto o nome da obra continuaria o da obra anterior depois da troca.
      centroCustoCodigo: 'centroCustoId' in data ? obra?.codigo : mockLinhasGestao[idx].centroCustoCodigo,
      centroCustoNome: 'centroCustoId' in data ? obra?.nome : mockLinhasGestao[idx].centroCustoNome,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    return mockLinhasGestao[idx];
  }

  async deleteLinhaGestao(id: string): Promise<boolean> {
    const idx = mockLinhasGestao.findIndex(l => l.id === id);
    if (idx !== -1) {
      const temTitulos = mockTitulos.some(t => t.linhaGestaoId === id);
      if (temTitulos) {
        mockLinhasGestao[idx].ativo = false;
      } else {
        mockLinhasGestao.splice(idx, 1);
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // 4.1 SUBEMPRESA (UNIDADES / FILIAIS)
  // ---------------------------------------------------------------------------
  async getSubempresas(filtro?: { apenasAtivos?: boolean }): Promise<Subempresa[]> {
    let result = [...mockSubempresas];
    if (filtro?.apenasAtivos !== false) result = result.filter(s => s.ativo);
    return result;
  }
  async getSubempresaById(id: string): Promise<Subempresa | null> {
    return mockSubempresas.find(s => s.id === id) || null;
  }
  async createSubempresa(data: Omit<Subempresa, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subempresa> {
    const newSub: Subempresa = {
      ...data,
      id: `sub-${Date.now()}`,
      ativo: data.ativo ?? true,
      createdAt: new Date().toISOString().split('T')[0]
    };
    mockSubempresas.unshift(newSub);
    return newSub;
  }
  async updateSubempresa(id: string, data: Partial<Subempresa>): Promise<Subempresa> {
    const idx = mockSubempresas.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Subempresa não encontrada');
    mockSubempresas[idx] = { ...mockSubempresas[idx], ...data };
    return mockSubempresas[idx];
  }
  async deleteSubempresa(id: string): Promise<boolean> {
    const idx = mockSubempresas.findIndex(s => s.id === id);
    if (idx !== -1) mockSubempresas[idx].ativo = false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // 4.2 GRUPO DE LINHA DE CUSTO
  // ---------------------------------------------------------------------------
  async getGruposLinhaCusto(subempresaId?: string, filtro?: { apenasAtivos?: boolean }): Promise<GrupoLinhaCusto[]> {
    let result = [...mockGruposLinhaCusto];
    if (filtro?.apenasAtivos !== false) result = result.filter(g => g.ativo);
    if (subempresaId) result = result.filter(g => g.subempresaId === subempresaId);
    return result;
  }
  async createGrupoLinhaCusto(data: Omit<GrupoLinhaCusto, 'id' | 'createdAt' | 'updatedAt'>): Promise<GrupoLinhaCusto> {
    const sub = mockSubempresas.find(s => s.id === data.subempresaId);
    const newG: GrupoLinhaCusto = {
      ...data,
      id: `glc-${Date.now()}`,
      subempresaNome: sub?.nome,
      ativo: data.ativo ?? true,
      createdAt: new Date().toISOString().split('T')[0]
    };
    mockGruposLinhaCusto.unshift(newG);
    return newG;
  }
  async updateGrupoLinhaCusto(id: string, data: Partial<GrupoLinhaCusto>): Promise<GrupoLinhaCusto> {
    const idx = mockGruposLinhaCusto.findIndex(g => g.id === id);
    if (idx === -1) throw new Error('Grupo de linha de custo não encontrado');
    mockGruposLinhaCusto[idx] = { ...mockGruposLinhaCusto[idx], ...data };
    return mockGruposLinhaCusto[idx];
  }
  async deleteGrupoLinhaCusto(id: string): Promise<boolean> {
    const idx = mockGruposLinhaCusto.findIndex(g => g.id === id);
    if (idx !== -1) mockGruposLinhaCusto[idx].ativo = false;

    // As linhas do grupo saem junto — sem o grupo pai elas ficariam órfãs e ativas.
    mockLinhasCusto.forEach(l => {
      if (l.grupoLinhaCustoId === id) l.ativo = false;
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // 4.3 LINHA DE CUSTO
  // ---------------------------------------------------------------------------
  async getLinhasCusto(grupoLinhaCustoId?: string, filtro?: { apenasAtivos?: boolean }): Promise<LinhaCusto[]> {
    let result = [...mockLinhasCusto];
    if (filtro?.apenasAtivos !== false) result = result.filter(l => l.ativo);
    if (grupoLinhaCustoId) result = result.filter(l => l.grupoLinhaCustoId === grupoLinhaCustoId);
    return result;
  }
  async createLinhaCusto(data: Omit<LinhaCusto, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinhaCusto> {
    const grupo = mockGruposLinhaCusto.find(g => g.id === data.grupoLinhaCustoId);
    const cc = data.centroCustoId ? mockCentrosCusto.find(c => c.id === data.centroCustoId) : null;
    const newL: LinhaCusto = {
      ...data,
      id: `lc-${Date.now()}`,
      grupoLinhaCustoNome: grupo?.nome,
      centroCustoCodigo: cc?.codigo,
      centroCustoNome: cc?.nome,
      ativo: data.ativo ?? true,
      createdAt: new Date().toISOString().split('T')[0]
    };
    mockLinhasCusto.unshift(newL);
    return newL;
  }
  async updateLinhaCusto(id: string, data: Partial<LinhaCusto>): Promise<LinhaCusto> {
    const idx = mockLinhasCusto.findIndex(l => l.id === id);
    if (idx === -1) throw new Error('Linha de custo não encontrada');
    mockLinhasCusto[idx] = { ...mockLinhasCusto[idx], ...data };
    return mockLinhasCusto[idx];
  }
  async deleteLinhaCusto(id: string): Promise<boolean> {
    const idx = mockLinhasCusto.findIndex(l => l.id === id);
    if (idx !== -1) mockLinhasCusto[idx].ativo = false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // 5. MOTOR DE TÍTULOS E PARCELAS
  // ---------------------------------------------------------------------------
  async createTitulo(data: TituloInput): Promise<Titulo> {
    let pessoa = mockPessoas.find(p => p.id === data.pessoaId);
    if (!pessoa && data.pessoaId) {
      const todas = await this.getPessoas();
      pessoa = todas.find(p => p.id === data.pessoaId);
    }
    const plano = mockPlanoContas.find(pc => pc.id === data.planoContaId);
    const subempresa = data.subempresaId ? mockSubempresas.find(s => s.id === data.subempresaId) : null;
    const grupo = data.grupoLinhaCustoId ? mockGruposLinhaCusto.find(g => g.id === data.grupoLinhaCustoId) : null;
    const linha = data.linhaCustoId ? mockLinhasCusto.find(l => l.id === data.linhaCustoId) : null;
    const grupoGestao = data.grupoGestaoId ? mockGruposGestao.find(g => g.id === data.grupoGestaoId) : null;
    const linhaGestao = data.linhaGestaoId ? mockLinhasGestao.find(l => l.id === data.linhaGestaoId) : null;

    const seq = nextTituloSeqCounter++;
    const codigoUnico = String(seq).padStart(6, '0');
    const tituloId = `tit-${Date.now()}`;
    const usuarioLog = (data as any).usuario || 'Fabrício (Administrador)';
    const dataHoraFormatada = new Date().toLocaleString('pt-BR');

    const logCriacao = {
      id: `log-${Date.now()}-1`,
      dataHora: dataHoraFormatada,
      usuario: usuarioLog,
      acao: 'criacao' as const,
      descricao: 'Título criado no sistema',
      detalhes: `Documento nº ${data.numeroDocumento || 'S/N'} registrado por ${usuarioLog}`
    };

    const newTitulo: Titulo = {
      id: tituloId,
      codigo: codigoUnico,
      tipo: data.tipo,
      pessoaId: data.pessoaId,
      pessoaNome: pessoa?.nome || data.pessoaNome || 'Pessoa Desconhecida',
      subempresaId: data.subempresaId,
      subempresaNome: subempresa?.nome,
      grupoLinhaCustoId: data.grupoLinhaCustoId,
      grupoLinhaCustoNome: grupo?.nome,
      linhaCustoId: data.linhaCustoId,
      linhaCustoNome: linha?.nome,
      grupoGestaoId: data.grupoGestaoId,
      grupoGestaoNome: grupoGestao?.nome,
      linhaGestaoId: data.linhaGestaoId,
      linhaGestaoNome: linhaGestao?.nome,
      planoContaId: data.planoContaId,
      planoContaNome: plano ? `${plano.codigo} ${plano.nome}` : 'Plano Desconhecido',
      numeroDocumento: data.numeroDocumento,
      serie: data.serie,
      dataEmissao: data.dataEmissao,
      dataCompetencia: data.dataCompetencia,
      valorBrutoCentavos: data.valorBrutoCentavos,
      qtdParcelas: data.qtdParcelas,
      descricao: data.descricao?.trim() || (plano ? plano.nome : (pessoa ? `Lançamento para ${pessoa.nome}` : 'Lançamento financeiro')),
      observacao: data.observacao,
      ativo: true,
      createdAt: dataHoraFormatada,
      createdBy: usuarioLog,
      logsAudit: [logCriacao],
      parcelas: data.parcelas.map(p => ({
        id: `parc-${Date.now()}-${p.numero}`,
        tituloId,
        numero: p.numero,
        dataVencimento: p.dataVencimento,
        valorCentavos: p.valorCentavos,
        observacao: p.observacao,
        ativo: true,
        rateios: p.rateios.map(r => {
          const cc = mockCentrosCusto.find(c => c.id === r.centroCustoId);
          return {
            id: `rat-${Date.now()}-${Math.random()}`,
            centroCustoId: r.centroCustoId,
            centroCustoCodigo: cc?.codigo || '999',
            centroCustoNome: cc?.nome || 'Não alocado',
            percentual: r.percentual,
            valorCentavos: r.valorCentavos
          };
        })
      }))
    };

    mockTitulos.unshift(newTitulo);
    return newTitulo;
  }

  async getTituloById(id: string): Promise<Titulo | null> {
    return mockTitulos.find(t => t.id === id) || null;
  }

  /**
   * Quantas parcelas do título já têm baixa válida (movimento não estornado).
   * Título com baixa não pode ser alterado nem excluído — o caixa já foi movimentado.
   */
  private contarParcelasComBaixa(titulo: Titulo): number {
    return (titulo.parcelas || []).filter(p =>
      mockMovimentos.some(m => m.parcelaId === p.id && !m.estornado)
    ).length;
  }

  async updateTitulo(id: string, data: TituloInput): Promise<Titulo> {
    const idx = mockTitulos.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Título não encontrado');
    const anterior = mockTitulos[idx];

    const comBaixa = this.contarParcelasComBaixa(anterior);
    if (comBaixa > 0) {
      throw new Error(
        `Este título tem ${comBaixa} parcela(s) já baixada(s). Estorne as baixas antes de alterá-lo.`
      );
    }

    let pessoa = mockPessoas.find(p => p.id === data.pessoaId);
    if (!pessoa && data.pessoaId) {
      const todas = await this.getPessoas();
      pessoa = todas.find(p => p.id === data.pessoaId);
    }
    const plano = mockPlanoContas.find(pc => pc.id === data.planoContaId);
    const subempresa = data.subempresaId ? mockSubempresas.find(s => s.id === data.subempresaId) : null;
    const grupo = data.grupoLinhaCustoId ? mockGruposLinhaCusto.find(g => g.id === data.grupoLinhaCustoId) : null;
    const linha = data.linhaCustoId ? mockLinhasCusto.find(l => l.id === data.linhaCustoId) : null;
    const grupoGestao = data.grupoGestaoId ? mockGruposGestao.find(g => g.id === data.grupoGestaoId) : null;
    const linhaGestao = data.linhaGestaoId ? mockLinhasGestao.find(l => l.id === data.linhaGestaoId) : null;

    const usuarioLog = (data as any).usuario || 'Fabrício (Administrador)';
    const dataHoraFormatada = new Date().toLocaleString('pt-BR');

    const logEdicao = {
      id: `log-${Date.now()}-${Math.random()}`,
      dataHora: dataHoraFormatada,
      usuario: usuarioLog,
      acao: 'edicao' as const,
      descricao: 'Título alterado no sistema',
      detalhes: `Dados e parcelas alterados por ${usuarioLog}`
    };

    const logsAnteriores = anterior.logsAudit || [];
    if (logsAnteriores.length === 0 && anterior.createdBy) {
      logsAnteriores.push({
        id: `log-${Date.now()}-init`,
        dataHora: anterior.createdAt || dataHoraFormatada,
        usuario: anterior.createdBy || 'Fabrício (Administrador)',
        acao: 'criacao',
        descricao: 'Título criado no sistema'
      });
    }

    // Código e data de criação são do registro original; o resto é regravado.
    const atualizado: Titulo = {
      ...anterior,
      tipo: data.tipo,
      pessoaId: data.pessoaId,
      pessoaNome: pessoa?.nome || data.pessoaNome || 'Pessoa Desconhecida',
      subempresaId: data.subempresaId,
      subempresaNome: subempresa?.nome,
      grupoLinhaCustoId: data.grupoLinhaCustoId,
      grupoLinhaCustoNome: grupo?.nome,
      linhaCustoId: data.linhaCustoId,
      linhaCustoNome: linha?.nome,
      grupoGestaoId: data.grupoGestaoId,
      grupoGestaoNome: grupoGestao?.nome,
      linhaGestaoId: data.linhaGestaoId,
      linhaGestaoNome: linhaGestao?.nome,
      planoContaId: data.planoContaId,
      planoContaNome: plano ? `${plano.codigo} ${plano.nome}` : 'Plano Desconhecido',
      numeroDocumento: data.numeroDocumento,
      serie: data.serie,
      dataEmissao: data.dataEmissao,
      dataCompetencia: data.dataCompetencia,
      valorBrutoCentavos: data.valorBrutoCentavos,
      qtdParcelas: data.qtdParcelas,
      descricao: data.descricao?.trim() || anterior.descricao || (plano ? plano.nome : (pessoa ? `Lançamento para ${pessoa.nome}` : 'Lançamento financeiro')),
      observacao: data.observacao,
      updatedAt: dataHoraFormatada,
      updatedBy: usuarioLog,
      logsAudit: [logEdicao, ...logsAnteriores],
      parcelas: data.parcelas.map((p, i) => ({
        // Reaproveita o id da parcela na mesma posição para não quebrar referências.
        id: anterior.parcelas?.[i]?.id || `parc-${Date.now()}-${p.numero}`,
        tituloId: id,
        numero: p.numero,
        dataVencimento: p.dataVencimento,
        valorCentavos: p.valorCentavos,
        observacao: p.observacao,
        ativo: true,
        rateios: p.rateios.map(r => {
          const cc = mockCentrosCusto.find(c => c.id === r.centroCustoId);
          return {
            id: `rat-${Date.now()}-${Math.random()}`,
            centroCustoId: r.centroCustoId,
            centroCustoCodigo: cc?.codigo || '999',
            centroCustoNome: cc?.nome || 'Não alocado',
            percentual: r.percentual,
            valorCentavos: r.valorCentavos
          };
        })
      }))
    };

    mockTitulos[idx] = atualizado;
    return atualizado;
  }

  async deleteTitulo(id: string): Promise<boolean> {
    const idx = mockTitulos.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Título não encontrado');

    const comBaixa = this.contarParcelasComBaixa(mockTitulos[idx]);
    if (comBaixa > 0) {
      throw new Error(
        `Lançamentos que foram baixados não podem ser excluídos. Este título possui ${comBaixa} parcela(s) baixada(s). Estorne as baixas antes de excluí-lo.`
      );
    }

    mockTitulos[idx].ativo = false;
    mockTitulos[idx].parcelas?.forEach(p => {
      p.ativo = false;
    });

    return true;
  }

  async getParcelasView(tipo: TipoTitulo, filtro?: FiltroParcelas): Promise<ParcelaView[]> {
    const hoje = new Date().toISOString().split('T')[0];
    const views: ParcelaView[] = [];

    mockTitulos
      .filter(t => t.tipo === tipo && t.ativo)
      .forEach(t => {
        const pessoa = mockPessoas.find(p => p.id === t.pessoaId);
        const plano = mockPlanoContas.find(pc => pc.id === t.planoContaId);

        t.parcelas?.forEach(p => {
          if (filtro?.apenasAtivos !== false && p.ativo === false) return;

          const movimentosValidos = mockMovimentos.filter(m => m.parcelaId === p.id && !m.estornado);
          const valorBaixadoCentavos = movimentosValidos.reduce((sum, m) => sum + m.valorPagoCentavos, 0);
          const saldoCentavos = p.valorCentavos - valorBaixadoCentavos;

          let status: StatusParcela = 'aberto';
          let diasAtraso = 0;

          if (p.ativo === false) {
            status = 'cancelado';
          } else if (saldoCentavos <= 0) {
            status = 'pago';
          } else if (valorBaixadoCentavos > 0) {
            status = 'parcial';
          } else if (p.dataVencimento < hoje) {
            status = 'vencido';
            const diffTime = Math.abs(new Date(hoje).getTime() - new Date(p.dataVencimento).getTime());
            diasAtraso = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          } else {
            status = 'aberto';
          }

          const rateioStr = (p.rateios || [])
            .map(r => `${r.centroCustoNome || 'Não alocado'} (${r.percentual.toFixed(0)}%)`)
            .join(', ') || 'Não alocado (100%)';

          views.push({
            parcelaId: p.id || '',
            tituloId: t.id,
            tituloCodigo: t.codigo || '000000',
            tipo: t.tipo,
            pessoaId: t.pessoaId,
            pessoaNome: pessoa?.nome || t.pessoaNome || 'Desconhecido',
            pessoaCpfCnpj: pessoa?.cpfCnpj || '',
            subempresaId: t.subempresaId,
            subempresaNome: t.subempresaNome,
            grupoLinhaCustoNome: t.grupoLinhaCustoNome,
            linhaCustoNome: t.linhaCustoNome,
            grupoGestaoNome: t.grupoGestaoNome,
            linhaGestaoNome: t.linhaGestaoNome,
            planoContaId: t.planoContaId,
            planoContaCodigo: plano?.codigo || '',
            planoContaNome: plano?.nome || t.planoContaNome || '',
            planoContaNatureza: plano?.natureza,
            numeroDocumento: t.numeroDocumento,
            serie: t.serie,
            descricao: t.descricao,
            dataEmissao: t.dataEmissao,
            dataCompetencia: t.dataCompetencia,
            parcelaNumero: p.numero,
            qtdParcelas: t.qtdParcelas,
            dataVencimento: p.dataVencimento,
            valorCentavos: p.valorCentavos,
            valorBaixadoCentavos,
            saldoCentavos,
            status,
            diasAtraso,
            centrosCustoFormatado: rateioStr,
            ativo: p.ativo !== false,
            createdAt: t.createdAt,
            createdBy: t.createdBy,
            updatedAt: t.updatedAt,
            updatedBy: t.updatedBy,
            logsAudit: t.logsAudit
          });
        });
      });

    let result = views;
    if (filtro?.pessoaId) result = result.filter(v => v.pessoaId === filtro.pessoaId);
    if (filtro?.subempresaId) result = result.filter(v => v.subempresaId === filtro.subempresaId);
    if (filtro?.grupoLinhaCustoId) {
      const g = mockGruposLinhaCusto.find(x => x.id === filtro.grupoLinhaCustoId);
      if (g) result = result.filter(v => v.grupoLinhaCustoNome === g.nome);
    }
    if (filtro?.linhaCustoId) {
      const l = mockLinhasCusto.find(x => x.id === filtro.linhaCustoId);
      if (l) result = result.filter(v => v.linhaCustoNome === l.nome);
    }
    if (filtro?.status) result = result.filter(v => v.status === filtro.status);
    if (filtro?.planoContaId) result = result.filter(v => v.planoContaId === filtro.planoContaId);
    if (filtro?.dataVencimentoDe) result = result.filter(v => v.dataVencimento >= filtro.dataVencimentoDe!);
    if (filtro?.dataVencimentoAte) result = result.filter(v => v.dataVencimento <= filtro.dataVencimentoAte!);
    if (filtro?.searchTerm) {
      const st = filtro.searchTerm.toLowerCase();
      result = result.filter(
        v =>
          v.tituloCodigo.toLowerCase().includes(st) ||
          v.pessoaNome.toLowerCase().includes(st) ||
          v.pessoaCpfCnpj.includes(st) ||
          (v.subempresaNome && v.subempresaNome.toLowerCase().includes(st)) ||
          (v.linhaCustoNome && v.linhaCustoNome.toLowerCase().includes(st)) ||
          (v.numeroDocumento && v.numeroDocumento.toLowerCase().includes(st)) ||
          (v.descricao && v.descricao.toLowerCase().includes(st))
      );
    }

    result.sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));
    return result;
  }

  async getTitulos(): Promise<Titulo[]> {
    return mockTitulos.filter(t => t.ativo);
  }


  // ---------------------------------------------------------------------------
  // 6. CAIXA & MOVIMENTOS
  // ---------------------------------------------------------------------------

  async createMovimento(data: {
    parcelaId: string;
    dataPagamento: string;
    valorPagoCentavos: number;
    jurosCentavos?: number;
    multaCentavos?: number;
    descontoCentavos?: number;
    contaBancariaId: string;
    formaPagamento: FormaPagamentoMovimento;
    numeroDocumento?: string;
    observacao?: string;
  }): Promise<Movimento> {
    let targetParcela: TituloParcela | null = null;
    for (const t of mockTitulos) {
      const found = t.parcelas?.find(p => p.id === data.parcelaId);
      if (found) {
        targetParcela = found;
        break;
      }
    }

    if (!targetParcela) throw new Error('Parcela não encontrada');

    const movimentosExistentes = mockMovimentos.filter(m => m.parcelaId === data.parcelaId && !m.estornado);
    const valorJaBaixadoCentavos = movimentosExistentes.reduce((sum, m) => sum + m.valorPagoCentavos, 0);
    const saldoRemanescenteCentavos = targetParcela.valorCentavos - valorJaBaixadoCentavos;

    if (data.valorPagoCentavos > saldoRemanescenteCentavos) {
      throw new Error(`O valor pago (R$ ${(data.valorPagoCentavos/100).toFixed(2)}) não pode ser maior que o saldo em aberto (R$ ${(saldoRemanescenteCentavos/100).toFixed(2)}). Excesso deve ser lançado em Juros ou Multa.`);
    }

    const juros = data.jurosCentavos || 0;
    const multa = data.multaCentavos || 0;
    const desconto = data.descontoCentavos || 0;
    const valorLiquidoCentavos = data.valorPagoCentavos + juros + multa - desconto;

    const cb = mockContasBancarias.find(c => c.id === data.contaBancariaId);

    const newMov: Movimento = {
      id: `mov-${Date.now()}-${Math.random()}`,
      parcelaId: data.parcelaId,
      dataPagamento: data.dataPagamento,
      valorPagoCentavos: data.valorPagoCentavos,
      jurosCentavos: juros,
      multaCentavos: multa,
      descontoCentavos: desconto,
      valorLiquidoCentavos,
      contaBancariaId: data.contaBancariaId,
      contaBancariaNome: cb?.nome || 'Conta Bancária',
      formaPagamento: data.formaPagamento,
      numeroDocumento: data.numeroDocumento,
      observacao: data.observacao,
      estornado: false,
      createdAt: new Date().toISOString(),
      createdBy: 'Fabrício (Administrador)'
    };

    mockMovimentos.unshift(newMov);
    return newMov;
  }

  async createBaixaEmLote(data: {
    parcelaIds: string[];
    dataPagamento: string;
    contaBancariaId: string;
    formaPagamento: FormaPagamentoMovimento;
  }): Promise<Movimento[]> {
    const criados: Movimento[] = [];
    for (const pId of data.parcelaIds) {
      let targetParcela: TituloParcela | null = null;
      for (const t of mockTitulos) {
        const found = t.parcelas?.find(p => p.id === pId);
        if (found) {
          targetParcela = found;
          break;
        }
      }
      if (!targetParcela) continue;

      const movs = mockMovimentos.filter(m => m.parcelaId === pId && !m.estornado);
      const baixado = movs.reduce((sum, m) => sum + m.valorPagoCentavos, 0);
      const saldo = targetParcela.valorCentavos - baixado;

      if (saldo > 0) {
        const mov = await this.createMovimento({
          parcelaId: pId,
          dataPagamento: data.dataPagamento,
          valorPagoCentavos: saldo,
          contaBancariaId: data.contaBancariaId,
          formaPagamento: data.formaPagamento,
          observacao: 'Baixa efetuada em Lote.'
        });
        criados.push(mov);
      }
    }
    return criados;
  }

  async estornarMovimento(movimentoId: string, motivo: string, usuario = 'Fabrício (Administrador)'): Promise<Movimento> {
    const idx = mockMovimentos.findIndex(m => m.id === movimentoId);
    if (idx === -1) throw new Error('Movimento de caixa não encontrado');
    if (mockMovimentos[idx].estornado) throw new Error('Este movimento já foi estornado.');

    mockMovimentos[idx] = {
      ...mockMovimentos[idx],
      estornado: true,
      estornadoEm: new Date().toISOString(),
      estornadoPor: usuario,
      motivoEstorno: motivo
    };

    return mockMovimentos[idx];
  }

  async getMovimentosPorParcela(parcelaId: string): Promise<Movimento[]> {
    return mockMovimentos.filter(m => m.parcelaId === parcelaId);
  }

  // ---------------------------------------------------------------------------
  // 7. MOTOR CONSOLIDADO DE FLUXO DE CAIXA
  // ---------------------------------------------------------------------------
  async getFluxoCaixa(filtro: FiltroFluxoCaixa): Promise<FluxoCaixaResultado> {
    const contas = mockContasBancarias.filter(cb => cb.ativo);
    const saldoInicialContasCentavos = contas.reduce((sum, cb) => sum + cb.saldoInicialCentavos, 0);

    let saldoMovimentosAnterioresCentavos = 0;
    mockMovimentos
      .filter(m => !m.estornado && m.dataPagamento < filtro.dataDe)
      .forEach(m => {
        if (filtro.contaBancariaId && m.contaBancariaId !== filtro.contaBancariaId) return;

        let parentTitulo: Titulo | null = null;
        let parentParcela: TituloParcela | null = null;
        for (const t of mockTitulos) {
          const p = t.parcelas?.find(par => par.id === m.parcelaId);
          if (p) {
            parentTitulo = t;
            parentParcela = p;
            break;
          }
        }
        if (!parentTitulo || !parentParcela) return;

        let fatorRateio = 1.0;
        if (filtro.centroCustoId) {
          const r = parentParcela.rateios?.find(rat => rat.centroCustoId === filtro.centroCustoId);
          if (!r) return;
          fatorRateio = r.percentual / 100;
        }

        const valLiquido = Math.round(m.valorLiquidoCentavos * fatorRateio);
        if (parentTitulo.tipo === 'R') {
          saldoMovimentosAnterioresCentavos += valLiquido;
        } else {
          saldoMovimentosAnterioresCentavos -= valLiquido;
        }
      });

    const saldoInicialPeriodoCentavos = saldoInicialContasCentavos + saldoMovimentosAnterioresCentavos;
    const rawLancamentos: FluxoCaixaLancamento[] = [];

    if (filtro.camada !== 'previsto') {
      mockMovimentos
        .filter(m => !m.estornado && m.dataPagamento >= filtro.dataDe && m.dataPagamento <= filtro.dataAte)
        .forEach(m => {
          if (filtro.contaBancariaId && m.contaBancariaId !== filtro.contaBancariaId) return;

          let parentTitulo: Titulo | null = null;
          let parentParcela: TituloParcela | null = null;
          for (const t of mockTitulos) {
            const p = t.parcelas?.find(par => par.id === m.parcelaId);
            if (p) {
              parentTitulo = t;
              parentParcela = p;
              break;
            }
          }
          if (!parentTitulo || !parentParcela) return;

          let fatorRateio = 1.0;
          let ccNome = 'Vários';
          if (filtro.centroCustoId) {
            const r = parentParcela.rateios?.find(rat => rat.centroCustoId === filtro.centroCustoId);
            if (!r) return;
            fatorRateio = r.percentual / 100;
            ccNome = r.centroCustoNome || 'Não alocado';
          } else if (parentParcela.rateios && parentParcela.rateios.length > 0) {
            ccNome = parentParcela.rateios[0].centroCustoNome || 'Não alocado';
          }

          rawLancamentos.push({
            id: m.id,
            data: m.dataPagamento,
            tipo: parentTitulo.tipo,
            descricao: parentTitulo.descricao || 'Movimento Realizado em Caixa',
            pessoaNome: parentTitulo.pessoaNome || 'Pessoa Desconhecida',
            centroCustoNome: ccNome,
            valorCentavos: Math.round(m.valorLiquidoCentavos * fatorRateio),
            camada: 'realizado',
            parcelaId: m.parcelaId,
            numeroDocumento: parentTitulo.numeroDocumento
          });
        });
    }

    if (filtro.camada !== 'realizado') {
      mockTitulos
        .filter(t => t.ativo && !t.aguardandoValor)

        .forEach(t => {
          t.parcelas?.forEach(p => {
            if (!p.ativo) return;
            if (p.dataVencimento < filtro.dataDe || p.dataVencimento > filtro.dataAte) return;

            const movs = mockMovimentos.filter(m => m.parcelaId === p.id && !m.estornado);
            const baixado = movs.reduce((sum, m) => sum + m.valorPagoCentavos, 0);
            const saldoParcelaCentavos = p.valorCentavos - baixado;

            if (saldoParcelaCentavos <= 0) return;

            let fatorRateio = 1.0;
            let ccNome = 'Vários';
            if (filtro.centroCustoId) {
              const r = p.rateios?.find(rat => rat.centroCustoId === filtro.centroCustoId);
              if (!r) return;
              fatorRateio = r.percentual / 100;
              ccNome = r.centroCustoNome || 'Não alocado';
            } else if (p.rateios && p.rateios.length > 0) {
              ccNome = p.rateios[0].centroCustoNome || 'Não alocado';
            }

            rawLancamentos.push({
              id: `prev-${p.id}`,
              data: p.dataVencimento,
              tipo: t.tipo,
              descricao: t.descricao || `Parcela ${p.numero}/${t.qtdParcelas}`,
              pessoaNome: t.pessoaNome || 'Pessoa Desconhecida',
              centroCustoNome: ccNome,
              valorCentavos: Math.round(saldoParcelaCentavos * fatorRateio),
              camada: 'previsto',
              parcelaId: p.id,
              numeroDocumento: t.numeroDocumento
            });
          });
        });
    }

    const bucketMap: Record<string, FluxoCaixaBucket> = {};
    const datesList: string[] = [];
    let curDate = new Date(filtro.dataDe);
    const endDate = new Date(filtro.dataAte);

    while (curDate <= endDate) {
      const dStr = curDate.toISOString().split('T')[0];
      datesList.push(dStr);
      curDate.setDate(curDate.getDate() + 1);
    }

    datesList.forEach(dStr => {
      let key = dStr;
      let rotulo = dStr.split('-').reverse().join('/');

      if (filtro.agrupamento === 'semana') {
        const d = new Date(dStr);
        const dayOfWeek = d.getDay();
        const firstDayOfWeek = new Date(d);
        firstDayOfWeek.setDate(d.getDate() - dayOfWeek);
        key = firstDayOfWeek.toISOString().split('T')[0];
        rotulo = `Semana de ${key.split('-').reverse().join('/')}`;
      } else if (filtro.agrupamento === 'mes') {
        key = dStr.substring(0, 7);
        const [yyyy, mm] = key.split('-');
        rotulo = `${mm}/${yyyy}`;
      }

      if (!bucketMap[key]) {
        bucketMap[key] = {
          periodoRotulo: rotulo,
          dataInicioPeriodo: dStr,
          saldoInicialCentavos: 0,
          entradasCentavos: 0,
          saidasCentavos: 0,
          resultadoCentavos: 0,
          saldoFinalCentavos: 0,
          isFuroCaixa: false,
          lancamentos: []
        };
      }
    });

    rawLancamentos.forEach(l => {
      let key = l.data;
      if (filtro.agrupamento === 'semana') {
        const d = new Date(l.data);
        const dayOfWeek = d.getDay();
        const firstDayOfWeek = new Date(d);
        firstDayOfWeek.setDate(d.getDate() - dayOfWeek);
        key = firstDayOfWeek.toISOString().split('T')[0];
      } else if (filtro.agrupamento === 'mes') {
        key = l.data.substring(0, 7);
      }

      if (bucketMap[key]) {
        bucketMap[key].lancamentos.push(l);
        if (l.tipo === 'R') {
          bucketMap[key].entradasCentavos += l.valorCentavos;
        } else {
          bucketMap[key].saidasCentavos += l.valorCentavos;
        }
      }
    });

    const orderedKeys = Object.keys(bucketMap).sort();
    let accum = saldoInicialPeriodoCentavos;
    let primeiraDataFuro: string | null = null;
    let menorSaldoCentavos = saldoInicialPeriodoCentavos;
    let dataMenorSaldo: string | null = orderedKeys.length > 0 ? bucketMap[orderedKeys[0]].dataInicioPeriodo : null;

    let totalEntradasPrevistas = 0;
    let totalSaidasPrevistas = 0;

    const resultBuckets: FluxoCaixaBucket[] = orderedKeys.map(key => {
      const b = bucketMap[key];
      b.saldoInicialCentavos = accum;
      b.resultadoCentavos = b.entradasCentavos - b.saidasCentavos;
      b.saldoFinalCentavos = b.saldoInicialCentavos + b.resultadoCentavos;
      accum = b.saldoFinalCentavos;

      if (b.saldoFinalCentavos < 0) {
        b.isFuroCaixa = true;
        if (!primeiraDataFuro) {
          primeiraDataFuro = b.dataInicioPeriodo;
        }
      }

      if (b.saldoFinalCentavos < menorSaldoCentavos) {
        menorSaldoCentavos = b.saldoFinalCentavos;
        dataMenorSaldo = b.dataInicioPeriodo;
      }

      totalEntradasPrevistas += b.entradasCentavos;
      totalSaidasPrevistas += b.saidasCentavos;

      return b;
    });

    return {
      saldoHojeCentavos: saldoInicialContasCentavos,
      totalEntradasPrevistasCentavos: totalEntradasPrevistas,
      totalSaidasPrevistasCentavos: totalSaidasPrevistas,
      menorSaldoProjetadoCentavos: menorSaldoCentavos,
      dataMenorSaldoProjetado: dataMenorSaldo,
      primeiraDataFuroCaixa: primeiraDataFuro,
      buckets: resultBuckets
    };
  }

  // ---------------------------------------------------------------------------
  // 8. MOTOR DE DASHBOARD EXECUTIVO EM 6 BLOCOS (ETAPA 5)
  // ---------------------------------------------------------------------------
  async getDashboardExecutiveData(filtro: FiltroDashboard): Promise<DashboardExecutiveData> {
    const hojeStr = new Date().toISOString().split('T')[0];
    const em30DiasStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // BLOCO 1: Cards Topo (30 Dias)
    const parcelasReceber30 = await this.getParcelasView('R', {
      apenasAtivos: true,
      dataVencimentoDe: hojeStr,
      dataVencimentoAte: em30DiasStr,
      centroCustoId: filtro.centroCustoId
    });

    const parcelasPagar30 = await this.getParcelasView('P', {
      apenasAtivos: true,
      dataVencimentoDe: hojeStr,
      dataVencimentoAte: em30DiasStr,
      centroCustoId: filtro.centroCustoId
    });

    const contas = mockContasBancarias.filter(cb => cb.ativo);
    const saldoConsolidadoHojeCentavos = contas.reduce((sum, cb) => sum + cb.saldoInicialCentavos, 0);

    const aReceber30DiasCentavos = parcelasReceber30.reduce((sum, p) => sum + p.saldoCentavos, 0);
    const aPagar30DiasCentavos = parcelasPagar30.reduce((sum, p) => sum + p.saldoCentavos, 0);
    const resultadoProjetado30DiasCentavos = aReceber30DiasCentavos - aPagar30DiasCentavos;

    // BLOCO 2: Vencidos (Caixa/Vencimento)
    const todasReceberVencidas = await this.getParcelasView('R', {
      apenasAtivos: true,
      status: 'vencido',
      centroCustoId: filtro.centroCustoId
    });

    const todasPagarVencidas = await this.getParcelasView('P', {
      apenasAtivos: true,
      status: 'vencido',
      centroCustoId: filtro.centroCustoId
    });

    const totalReceberVencidoCentavos = todasReceberVencidas.reduce((sum, p) => sum + p.saldoCentavos, 0);
    const qtdTitulosReceberVencidos = todasReceberVencidas.length;
    const maiorAtrasoReceberDias = todasReceberVencidas.reduce((max, p) => (p.diasAtraso > max ? p.diasAtraso : max), 0);

    const totalPagarVencidoCentavos = todasPagarVencidas.reduce((sum, p) => sum + p.saldoCentavos, 0);
    const qtdTitulosPagarVencidos = todasPagarVencidas.length;
    const maiorAtrasoPagarDias = todasPagarVencidas.reduce((max, p) => (p.diasAtraso > max ? p.diasAtraso : max), 0);

    // BLOCO 3: Curva de Caixa 90 Dias
    const fluxo90 = await this.getFluxoCaixa({
      dataDe: hojeStr,
      dataAte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      agrupamento: 'semana',
      camada: 'ambos',
      centroCustoId: filtro.centroCustoId
    });

    const curva90Dias = fluxo90.buckets.map(b => ({
      data: b.dataInicioPeriodo,
      periodoRotulo: b.periodoRotulo,
      saldoAcumuladoCentavos: b.saldoFinalCentavos
    }));

    // BLOCO 4: Despesa por Centro de Custo (Data de Competência)
    const ccMap: Record<string, { codigo: string; nome: string; valorCentavos: number }> = {};

    mockTitulos
      .filter(t => t.tipo === 'P' && t.ativo && t.dataCompetencia >= filtro.dataDe && t.dataCompetencia <= filtro.dataAte)
      .forEach(t => {
        t.parcelas?.forEach(p => {
          if (!p.ativo) return;
          p.rateios?.forEach(r => {
            if (filtro.centroCustoId && r.centroCustoId !== filtro.centroCustoId) return;
            const ccId = r.centroCustoId;
            if (!ccMap[ccId]) {
              const cc = mockCentrosCusto.find(c => c.id === ccId);
              ccMap[ccId] = {
                codigo: cc?.codigo || '999',
                nome: cc?.nome || 'Não alocado',
                valorCentavos: 0
              };
            }
            ccMap[ccId].valorCentavos += r.valorCentavos;
          });
        });
      });

    const despesasPorCentroCusto: DespesaCentroCustoItem[] = Object.keys(ccMap)
      .map(ccId => ({
        centroCustoId: ccId,
        codigo: ccMap[ccId].codigo,
        nome: ccMap[ccId].nome,
        valorCentavos: ccMap[ccId].valorCentavos
      }))
      .sort((a, b) => b.valorCentavos - a.valorCentavos)
      .slice(0, 8);

    // BLOCO 5: Despesa por Plano de Contas Nível 2 (Data de Competência)
    const pcNivel2Map: Record<string, { grupoId: string; codigo: string; nome: string; valorCentavos: number; folhasMap: Record<string, { codigo: string; nome: string; valorCentavos: number }> }> = {};

    mockTitulos
      .filter(t => t.tipo === 'P' && t.ativo && t.dataCompetencia >= filtro.dataDe && t.dataCompetencia <= filtro.dataAte)
      .forEach(t => {
        const pcFolha = mockPlanoContas.find(pc => pc.id === t.planoContaId);
        if (!pcFolha) return;

        /*
         * Conta que JÁ É nível 2 é o próprio grupo — não sobe para o pai.
         *
         * Sem esta primeira linha, um título classificado em "2.1 Mão de obra"
         * subia para "2 CUSTOS DIRETOS" enquanto outro em "2.1.01 Salários de
         * obra" caía em "2.1": o mesmo custo em dois grupos diferentes. Acontece
         * porque a Apropriação copia para o título o plano do item de orçamento,
         * e item de orçamento carrega conta de nível 2 por definição.
         */
        let pcPaiNivel2 = pcFolha.nivel === 2
          ? pcFolha
          : mockPlanoContas.find(pc => pc.id === pcFolha.parentId);
        if (pcPaiNivel2 && pcPaiNivel2.nivel > 2) {
          pcPaiNivel2 = mockPlanoContas.find(pc => pc.id === pcPaiNivel2?.parentId);
        }
        if (!pcPaiNivel2) pcPaiNivel2 = pcFolha;

        const gId = pcPaiNivel2.id;
        if (!pcNivel2Map[gId]) {
          pcNivel2Map[gId] = {
            grupoId: gId,
            codigo: pcPaiNivel2.codigo,
            nome: pcPaiNivel2.nome,
            valorCentavos: 0,
            folhasMap: {}
          };
        }

        let fatorRateio = 1.0;
        if (filtro.centroCustoId) {
          let hasCC = false;
          t.parcelas?.forEach(p => {
            const r = p.rateios?.find(rat => rat.centroCustoId === filtro.centroCustoId);
            if (r) {
              hasCC = true;
              fatorRateio = r.percentual / 100;
            }
          });
          if (!hasCC) return;
        }

        const val = Math.round(t.valorBrutoCentavos * fatorRateio);
        pcNivel2Map[gId].valorCentavos += val;

        const folhaId = pcFolha.id;
        if (!pcNivel2Map[gId].folhasMap[folhaId]) {
          pcNivel2Map[gId].folhasMap[folhaId] = {
            codigo: pcFolha.codigo,
            nome: pcFolha.nome,
            valorCentavos: 0
          };
        }
        pcNivel2Map[gId].folhasMap[folhaId].valorCentavos += val;
      });

    const despesasPorPlanoContaNivel2: DespesaPlanoContaGroup[] = Object.keys(pcNivel2Map)
      .map(gId => ({
        grupoId: gId,
        codigo: pcNivel2Map[gId].codigo,
        nome: pcNivel2Map[gId].nome,
        valorCentavos: pcNivel2Map[gId].valorCentavos,
        folhas: Object.keys(pcNivel2Map[gId].folhasMap).map(fId => ({
          planoContaId: fId,
          codigo: pcNivel2Map[gId].folhasMap[fId].codigo,
          nome: pcNivel2Map[gId].folhasMap[fId].nome,
          valorCentavos: pcNivel2Map[gId].folhasMap[fId].valorCentavos
        }))
      }))
      .sort((a, b) => b.valorCentavos - a.valorCentavos);

    // BLOCO 6: Top 5 Fornecedores & Top 5 Clientes (Data de Competência)
    const fornMap: Record<string, { nome: string; valorCentavos: number; qtd: number }> = {};
    const cliMap: Record<string, { nome: string; valorCentavos: number; qtd: number }> = {};

    mockTitulos
      .filter(t => t.ativo && t.dataCompetencia >= filtro.dataDe && t.dataCompetencia <= filtro.dataAte)
      .forEach(t => {
        let fatorRateio = 1.0;
        if (filtro.centroCustoId) {
          let hasCC = false;
          t.parcelas?.forEach(p => {
            const r = p.rateios?.find(rat => rat.centroCustoId === filtro.centroCustoId);
            if (r) {
              hasCC = true;
              fatorRateio = r.percentual / 100;
            }
          });
          if (!hasCC) return;
        }

        const val = Math.round(t.valorBrutoCentavos * fatorRateio);

        if (t.tipo === 'P') {
          if (!fornMap[t.pessoaId]) fornMap[t.pessoaId] = { nome: t.pessoaNome || 'Desconhecido', valorCentavos: 0, qtd: 0 };
          fornMap[t.pessoaId].valorCentavos += val;
          fornMap[t.pessoaId].qtd += 1;
        } else {
          if (!cliMap[t.pessoaId]) cliMap[t.pessoaId] = { nome: t.pessoaNome || 'Desconhecido', valorCentavos: 0, qtd: 0 };
          cliMap[t.pessoaId].valorCentavos += val;
          cliMap[t.pessoaId].qtd += 1;
        }
      });

    const top5Fornecedores: TopPessoaItem[] = Object.keys(fornMap)
      .map(pId => ({ pessoaId: pId, nome: fornMap[pId].nome, valorCentavos: fornMap[pId].valorCentavos, qtdTitulos: fornMap[pId].qtd }))
      .sort((a, b) => b.valorCentavos - a.valorCentavos)
      .slice(0, 5);

    const top5Clientes: TopPessoaItem[] = Object.keys(cliMap)
      .map(pId => ({ pessoaId: pId, nome: cliMap[pId].nome, valorCentavos: cliMap[pId].valorCentavos, qtdTitulos: cliMap[pId].qtd }))
      .sort((a, b) => b.valorCentavos - a.valorCentavos)
      .slice(0, 5);

    return {
      saldoConsolidadoHojeCentavos,
      aReceber30DiasCentavos,
      aPagar30DiasCentavos,
      resultadoProjetado30DiasCentavos,
      vencidos: {
        totalReceberVencidoCentavos,
        qtdTitulosReceberVencidos,
        maiorAtrasoReceberDias,
        totalPagarVencidoCentavos,
        qtdTitulosPagarVencidos,
        maiorAtrasoPagarDias
      },
      curva90Dias,
      despesasPorCentroCusto,
      despesasPorPlanoContaNivel2,
      top5Fornecedores,
      top5Clientes
    };
  }

  // ---------------------------------------------------------------------------
  // MÉTODOS RETROCOMPATÍVEIS
  // ---------------------------------------------------------------------------
  async getClientes(): Promise<Cliente[]> {
    const pessoas = await this.getPessoas({ apenasClientes: true, apenasAtivos: true });
    return pessoas.map(p => ({
      id: p.id,
      nome: p.nome,
      documento: p.cpfCnpj,
      email: p.email || '',
      telefone: p.telefone || '',
      cidade: p.cidade || 'Não informada',
      status: p.ativo ? 'ATIVO' : 'INATIVO',
      criadoEm: p.createdAt || ''
    }));
  }

  async createCliente(data: Omit<Cliente, 'id' | 'criadoEm'>): Promise<Cliente> {
    const p = await this.createPessoa({
      cpfCnpj: data.documento,
      tipoPessoa: data.documento.length > 14 ? 'J' : 'F',
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      cidade: data.cidade,
      isCliente: true,
      isFornecedor: false,
      ativo: true
    });
    return {
      id: p.id,
      nome: p.nome,
      documento: p.cpfCnpj,
      email: p.email || '',
      telefone: p.telefone || '',
      cidade: p.cidade || '',
      status: 'ATIVO',
      criadoEm: p.createdAt || ''
    };
  }

  async updateCliente(id: string, data: Partial<Omit<Cliente, 'id' | 'criadoEm'>>): Promise<Cliente> {
    const p = await this.updatePessoa(id, {
      ...(data.nome !== undefined && { nome: data.nome }),
      ...(data.documento !== undefined && {
        cpfCnpj: data.documento,
        tipoPessoa: data.documento.replace(/\D/g, '').length > 11 ? 'J' : 'F',
      }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.telefone !== undefined && { telefone: data.telefone }),
      ...(data.cidade !== undefined && { cidade: data.cidade }),
      ...(data.status !== undefined && { ativo: data.status === 'ATIVO' }),
    });
    return {
      id: p.id,
      nome: p.nome,
      documento: p.cpfCnpj,
      email: p.email || '',
      telefone: p.telefone || '',
      cidade: p.cidade || 'Não informada',
      status: p.ativo ? 'ATIVO' : 'INATIVO',
      criadoEm: p.createdAt || ''
    };
  }

  async deleteCliente(id: string): Promise<boolean> {
    return this.deletePessoa(id);
  }

  async getFornecedores(): Promise<Fornecedor[]> {
    const pessoas = await this.getPessoas({ apenasFornecedores: true, apenasAtivos: true });
    return pessoas.map(p => ({
      id: p.id,
      razaoSocial: p.nome,
      cnpj: p.cpfCnpj,
      email: p.email || '',
      telefone: p.telefone || '',
      categoria: p.categoriaFornecedor || 'Geral',
      status: p.ativo ? 'ATIVO' : 'INATIVO',
      criadoEm: p.createdAt || ''
    }));
  }

  async createFornecedor(data: Omit<Fornecedor, 'id' | 'criadoEm'>): Promise<Fornecedor> {
    const p = await this.createPessoa({
      cpfCnpj: data.cnpj,
      tipoPessoa: 'J',
      nome: data.razaoSocial,
      email: data.email,
      telefone: data.telefone,
      categoriaFornecedor: data.categoria,
      isCliente: false,
      isFornecedor: true,
      ativo: true
    });
    return {
      id: p.id,
      razaoSocial: p.nome,
      cnpj: p.cpfCnpj,
      email: p.email || '',
      telefone: p.telefone || '',
      categoria: p.categoriaFornecedor || 'Geral',
      status: 'ATIVO',
      criadoEm: p.createdAt || ''
    };
  }

  async updateFornecedor(id: string, data: Partial<Omit<Fornecedor, 'id' | 'criadoEm'>>): Promise<Fornecedor> {
    const p = await this.updatePessoa(id, {
      ...(data.razaoSocial !== undefined && { nome: data.razaoSocial }),
      ...(data.cnpj !== undefined && { cpfCnpj: data.cnpj }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.telefone !== undefined && { telefone: data.telefone }),
      ...(data.categoria !== undefined && { categoriaFornecedor: data.categoria }),
      ...(data.status !== undefined && { ativo: data.status === 'ATIVO' }),
    });
    return {
      id: p.id,
      razaoSocial: p.nome,
      cnpj: p.cpfCnpj,
      email: p.email || '',
      telefone: p.telefone || '',
      categoria: p.categoriaFornecedor || 'Geral',
      status: p.ativo ? 'ATIVO' : 'INATIVO',
      criadoEm: p.createdAt || ''
    };
  }

  async deleteFornecedor(id: string): Promise<boolean> {
    return this.deletePessoa(id);
  }

  async getContasPagar(): Promise<ContaPagar[]> { return [...mockContasPagar]; }
  async createContaPagar(data: Omit<ContaPagar, 'id'>): Promise<ContaPagar> {
    const newCp = { ...data, id: `cp-${Date.now()}` };
    mockContasPagar.unshift(newCp);
    return newCp;
  }
  async updateContaPagar(id: string, data: Partial<ContaPagar>): Promise<ContaPagar> {
    const idx = mockContasPagar.findIndex(cp => cp.id === id);
    if (idx === -1) throw new Error('Conta a pagar não encontrada');
    mockContasPagar[idx] = { ...mockContasPagar[idx], ...data };
    return mockContasPagar[idx];
  }
  async deleteContaPagar(id: string): Promise<boolean> {
    const cp = mockContasPagar.find(item => item.id === id);
    if (cp && cp.status === 'PAGO') {
      throw new Error('Lançamentos que foram baixados não podem ser excluídos. Estorne as baixas primeiro.');
    }
    mockContasPagar = mockContasPagar.filter(cp => cp.id !== id);
    return true;
  }

  async getContasReceber(): Promise<ContaReceber[]> { return [...mockContasReceber]; }
  async createContaReceber(data: Omit<ContaReceber, 'id'>): Promise<ContaReceber> {
    const newCr = { ...data, id: `cr-${Date.now()}` };
    mockContasReceber.unshift(newCr);
    return newCr;
  }
  async updateContaReceber(id: string, data: Partial<ContaReceber>): Promise<ContaReceber> {
    const idx = mockContasReceber.findIndex(cr => cr.id === id);
    if (idx === -1) throw new Error('Conta a receber não encontrada');
    mockContasReceber[idx] = { ...mockContasReceber[idx], ...data };
    return mockContasReceber[idx];
  }
  async deleteContaReceber(id: string): Promise<boolean> {
    const cr = mockContasReceber.find(item => item.id === id);
    if (cr && cr.status === 'RECEBIDO') {
      throw new Error('Lançamentos que foram baixados não podem ser excluídos. Estorne as baixas primeiro.');
    }
    mockContasReceber = mockContasReceber.filter(cr => cr.id !== id);
    return true;
  }

  async getOrcamentosDAV(): Promise<OrcamentoDAV[]> { return [...mockOrcamentos]; }
  async createOrcamentoDAV(data: Omit<OrcamentoDAV, 'id'>): Promise<OrcamentoDAV> {
    const newOrc = { ...data, id: `orc-${Date.now()}` };
    mockOrcamentos.unshift(newOrc);
    return newOrc;
  }
  async updateOrcamentoDAV(id: string, data: Partial<OrcamentoDAV>): Promise<OrcamentoDAV> {
    const idx = mockOrcamentos.findIndex(o => o.id === id);
    if (idx === -1) throw new Error('Orçamento não encontrado');
    mockOrcamentos[idx] = { ...mockOrcamentos[idx], ...data };
    return mockOrcamentos[idx];
  }
  async deleteOrcamentoDAV(id: string): Promise<boolean> {
    mockOrcamentos = mockOrcamentos.filter(o => o.id !== id);
    return true;
  }


  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const parcelasPagar = await this.getParcelasView('P', { apenasAtivos: true });
    const parcelasReceber = await this.getParcelasView('R', { apenasAtivos: true });

    const totalPagarCentavos = parcelasPagar.reduce((acc, curr) => acc + curr.saldoCentavos, 0);
    const totalReceberCentavos = parcelasReceber.reduce((acc, curr) => acc + curr.saldoCentavos, 0);
    const saldoProjetadoCentavos = totalReceberCentavos - totalPagarCentavos;
    const orcamentosPendentesCount = mockOrcamentos.filter(o => o.status !== 'RECEBIDO').length;

    return {
      totalPagarCentavos,
      totalReceberCentavos,
      saldoProjetadoCentavos,
      orcamentosPendentesCount,
      orcamentosPorStatus: [
        { name: 'Faturado', count: mockOrcamentos.filter(o => o.status === 'FATURADO').length },
        { name: 'Expedido', count: mockOrcamentos.filter(o => o.status === 'EXPEDIDO').length },
        { name: 'Entregue', count: mockOrcamentos.filter(o => o.status === 'ENTREGUE').length },
        { name: 'Recebido', count: mockOrcamentos.filter(o => o.status === 'RECEBIDO').length },
      ],
      fluxoMensal: [
        { mes: 'Fev', entradas: 12000, saídas: 7500 },
        { mes: 'Mar', entradas: 19000, saídas: 9000 },
        { mes: 'Abr', entradas: 15500, saídas: 8200 },
        { mes: 'Mai', entradas: 22000, saídas: 11000 },
        { mes: 'Jun', entradas: 24500, saídas: 13400 },
        { mes: 'Jul', entradas: 28200, saídas: 14650 },
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // 9. CADASTRO E ESTRUTURA DO ORÇAMENTO (ETAPA 6)
  // ---------------------------------------------------------------------------
  async getOrcamentos(filtro?: { centroCustoId?: string; status?: string; dataInicioDe?: string; dataFimAte?: string }): Promise<Orcamento[]> {
    let list = [...mockOrcamentosEmpreendimento];
    if (filtro?.centroCustoId) list = list.filter(o => o.centroCustoId === filtro.centroCustoId);
    if (filtro?.status) list = list.filter(o => o.status === filtro.status);
    if (filtro?.dataInicioDe) list = list.filter(o => o.dataInicio >= filtro.dataInicioDe!);
    if (filtro?.dataFimAte) list = list.filter(o => o.dataFim <= filtro.dataFimAte!);
    return list;
  }

  async getOrcamentoById(id: string): Promise<Orcamento | null> {
    return mockOrcamentosEmpreendimento.find(o => o.id === id) || null;
  }

  async createOrcamento(data: {
    centroCustoId: string;
    nome: string;
    dataInicio: string;
    dataFim: string;
    observacao?: string;
    itens: {
      planoContaId: string;
      centroCustoId?: string;
      descricao?: string;
      quantidade?: number;
      unidade?: string;
      valorUnitarioCentavos?: number;
      valorTotalCentavos: number;
      periodos: { mesReferencia: string; valorCentavos: number }[];
    }[];
  }): Promise<Orcamento> {
    const cc = mockCentrosCusto.find(c => c.id === data.centroCustoId);

    // Validação de sobreposição de orçamento aprovado vigente
    const sobreposto = mockOrcamentosEmpreendimento.find(o => 
      o.centroCustoId === data.centroCustoId &&
      o.status === 'aprovado' &&
      ((data.dataInicio >= o.dataInicio && data.dataInicio <= o.dataFim) ||
       (data.dataFim >= o.dataInicio && data.dataFim <= o.dataFim))
    );

    if (sobreposto) {
      throw new Error(`O Centro de Custo ${cc?.nome || ''} já possui um Orçamento Aprovado no período de ${sobreposto.dataInicio} a ${sobreposto.dataFim}. Para alterar, crie uma revisão.`);
    }

    // Validação de fechamento da distribuição periódica de cada item
    for (const item of data.itens) {
      const pc = mockPlanoContas.find(p => p.id === item.planoContaId);
      const somaPeriodos = item.periodos.reduce((sum, p) => sum + p.valorCentavos, 0);
      if (somaPeriodos !== item.valorTotalCentavos) {
        throw new Error(`A soma dos meses (R$ ${(somaPeriodos/100).toFixed(2)}) não confere com o valor total do item "${pc?.codigo} ${pc?.nome}" (R$ ${(item.valorTotalCentavos/100).toFixed(2)}). Ajuste os meses antes de salvar.`);
      }
    }

    const id = `orc-emp-${Date.now()}`;
    let valorTotalGeral = 0;

    const itensConvertidos: OrcamentoItem[] = data.itens.map((it, idx) => {
      const pc = mockPlanoContas.find(p => p.id === it.planoContaId);
      const ccItem = it.centroCustoId ? mockCentrosCusto.find(c => c.id === it.centroCustoId) : null;
      valorTotalGeral += it.valorTotalCentavos;

      // Matriz retrocompatível
      const distribuicaoMensal: Record<string, number> = {};
      const periodosConvertidos = it.periodos.map(p => {
        const key = p.mesReferencia.substring(0, 7);
        distribuicaoMensal[key] = p.valorCentavos;
        return {
          id: `per-${Date.now()}-${Math.random()}`,
          mesReferencia: p.mesReferencia,
          valorCentavos: p.valorCentavos
        };
      });

      return {
        id: `item-${Date.now()}-${idx}`,
        orcamentoId: id,
        codigo: (it as { codigo?: string }).codigo,
        planoContaId: it.planoContaId,
        planoContaCodigo: pc?.codigo || '2.1',
        planoContaNome: pc?.nome || 'Despesa',
        centroCustoId: it.centroCustoId,
        centroCustoCodigo: ccItem?.codigo,
        centroCustoNome: ccItem?.nome,
        descricao: it.descricao,
        quantidade: it.quantidade,
        unidade: it.unidade,
        valorUnitarioCentavos: it.valorUnitarioCentavos,
        valorTotalCentavos: it.valorTotalCentavos,
        ordem: idx + 1,
        periodos: periodosConvertidos,
        // Retrocompatível
        planoContaNivel2Id: it.planoContaId,
        planoContaNivel2Codigo: pc?.codigo || '2.1',
        planoContaNivel2Nome: pc?.nome || 'Despesa',
        distribuicaoMensal
      };
    });

    const newOrc: Orcamento = {
      id,
      centroCustoId: data.centroCustoId,
      centroCustoCodigo: cc?.codigo || '999',
      centroCustoNome: cc?.nome || 'Não alocado',
      nome: data.nome,
      descricao: data.nome,
      versao: 1,
      dataInicio: data.dataInicio,
      dataFim: data.dataFim,
      status: 'rascunho',
      isVigente: false,
      valorTotalCentavos: valorTotalGeral,
      observacao: data.observacao,
      ativo: true,
      createdAt: new Date().toISOString().split('T')[0],
      itens: itensConvertidos
    };

    mockOrcamentosEmpreendimento.unshift(newOrc);
    return newOrc;
  }

  async updateOrcamento(id: string, data: {
    nome?: string;
    observacao?: string;
    itens?: {
      id?: string;
      planoContaId: string;
      centroCustoId?: string;
      descricao?: string;
      quantidade?: number;
      unidade?: string;
      valorUnitarioCentavos?: number;
      valorTotalCentavos: number;
      periodos: { mesReferencia: string; valorCentavos: number }[];
    }[];
  }): Promise<Orcamento> {
    const idx = mockOrcamentosEmpreendimento.findIndex(o => o.id === id);
    if (idx === -1) throw new Error('Orçamento não encontrado');

    const target = mockOrcamentosEmpreendimento[idx];

    // Regra: Orçamento Aprovado é Congelado
    if (target.status === 'aprovado') {
      throw new Error('Este orçamento já está APROVADO e congelado. Não é possível alterar itens. Crie uma revisão para modificar.');
    }

    if (data.nome) {
      target.nome = data.nome;
      target.descricao = data.nome;
    }
    if (data.observacao !== undefined) target.observacao = data.observacao;

    if (data.itens) {
      // Validação de fechamento da distribuição periódica de cada item
      for (const item of data.itens) {
        const pc = mockPlanoContas.find(p => p.id === item.planoContaId);
        const somaPeriodos = item.periodos.reduce((sum, p) => sum + p.valorCentavos, 0);
        if (somaPeriodos !== item.valorTotalCentavos) {
          throw new Error(`A soma dos meses (R$ ${(somaPeriodos/100).toFixed(2)}) não confere com o valor total do item "${pc?.codigo} ${pc?.nome}" (R$ ${(item.valorTotalCentavos/100).toFixed(2)}). Ajuste os meses antes de salvar.`);
        }
      }

      let valorTotalGeral = 0;
      target.itens = data.itens.map((it, itemIdx) => {
        const pc = mockPlanoContas.find(p => p.id === it.planoContaId);
        const ccItem = it.centroCustoId ? mockCentrosCusto.find(c => c.id === it.centroCustoId) : null;
        valorTotalGeral += it.valorTotalCentavos;

        const distribuicaoMensal: Record<string, number> = {};
        const periodosConvertidos = it.periodos.map(p => {
          const key = p.mesReferencia.substring(0, 7);
          distribuicaoMensal[key] = p.valorCentavos;
          return {
            id: `per-${Date.now()}-${Math.random()}`,
            orcamentoItemId: it.id,
            mesReferencia: p.mesReferencia,
            valorCentavos: p.valorCentavos
          };
        });

        return {
          id: it.id || `item-${Date.now()}-${itemIdx}`,
          orcamentoId: target.id,
          codigo: (it as { codigo?: string }).codigo,
          planoContaId: it.planoContaId,
          planoContaCodigo: pc?.codigo || '2.1',
          planoContaNome: pc?.nome || 'Despesa',
          centroCustoId: it.centroCustoId,
          centroCustoCodigo: ccItem?.codigo,
          centroCustoNome: ccItem?.nome,
          descricao: it.descricao,
          quantidade: it.quantidade,
          unidade: it.unidade,
          valorUnitarioCentavos: it.valorUnitarioCentavos,
          valorTotalCentavos: it.valorTotalCentavos,
          ordem: itemIdx + 1,
          periodos: periodosConvertidos,
          planoContaNivel2Id: it.planoContaId,
          planoContaNivel2Codigo: pc?.codigo || '2.1',
          planoContaNivel2Nome: pc?.nome || 'Despesa',
          distribuicaoMensal
        };
      });

      target.valorTotalCentavos = valorTotalGeral;
    }

    target.updatedAt = new Date().toISOString().split('T')[0];
    return target;
  }

  async aprovarOrcamento(id: string, usuario = 'Fabrício (Engenharia)'): Promise<Orcamento> {
    const idx = mockOrcamentosEmpreendimento.findIndex(o => o.id === id);
    if (idx === -1) throw new Error('Orçamento não encontrado');

    const target = mockOrcamentosEmpreendimento[idx];

    mockOrcamentosEmpreendimento.forEach(o => {
      if (o.centroCustoId === target.centroCustoId && o.id !== target.id) {
        o.isVigente = false;
      }
    });

    target.status = 'aprovado';
    target.isVigente = true;
    target.aprovadoEm = new Date().toISOString();
    target.aprovadoPor = usuario;

    return target;
  }

  async criarRevisaoOrcamento(id: string, motivoRevisao: string, usuario = 'Fabrício (Engenharia)'): Promise<Orcamento> {
    if (!motivoRevisao || motivoRevisao.trim() === '') {
      throw new Error('Informe obrigatoriamente o motivo da revisão do orçamento.');
    }

    const base = await this.getOrcamentoById(id);
    if (!base) throw new Error('Orçamento base não encontrado');

    // Mudar status do orçamento anterior para 'revisado'
    const idxOriginal = mockOrcamentosEmpreendimento.findIndex(o => o.id === id);
    if (idxOriginal !== -1) {
      mockOrcamentosEmpreendimento[idxOriginal].status = 'revisado';
      mockOrcamentosEmpreendimento[idxOriginal].isVigente = false;
    }

    const proxVersao = base.versao + 1;
    const newId = `orc-emp-${Date.now()}`;
    const baseId = base.versao === 1 ? base.id : (base.orcamentoBaseId || base.id);

    const novaRevisao: Orcamento = {
      ...base,
      id: newId,
      nome: `${base.nome} (Revisão v${proxVersao})`,
      descricao: `${base.nome} (Revisão v${proxVersao})`,
      versao: proxVersao,
      orcamentoBaseId: baseId,
      status: 'rascunho',
      isVigente: true,
      motivoRevisao,
      aprovadoEm: undefined,
      aprovadoPor: undefined,
      createdAt: new Date().toISOString().split('T')[0],
      itens: base.itens.map(it => ({
        ...it,
        id: `item-${Date.now()}-${Math.random()}`,
        orcamentoId: newId,
        periodos: it.periodos.map(p => ({
          ...p,
          id: `per-${Date.now()}-${Math.random()}`
        }))
      }))
    };

    mockOrcamentosEmpreendimento.unshift(novaRevisao);
    return novaRevisao;
  }

  async getOrcamentosEmpreendimento(filtro?: { centroCustoId?: string; apenasVigentes?: boolean }): Promise<OrcamentoEmpreendimento[]> {
    return this.getOrcamentos(filtro);
  }

  async createOrcamentoEmpreendimento(data: {
    centroCustoId: string;
    descricao: string;
    dataInicio: string;
    dataFim: string;
    itens: {
      planoContaNivel2Id: string;
      distribuicaoMensal: Record<string, number>;
    }[];
  }): Promise<OrcamentoEmpreendimento> {
    return this.createOrcamento({
      centroCustoId: data.centroCustoId,
      nome: data.descricao,
      dataInicio: data.dataInicio,
      dataFim: data.dataFim,
      itens: data.itens.map(it => {
        const periodos = Object.keys(it.distribuicaoMensal).map(mesKey => ({
          mesReferencia: `${mesKey}-01`,
          valorCentavos: it.distribuicaoMensal[mesKey]
        }));
        const valorTotalCentavos = Object.values(it.distribuicaoMensal).reduce((a, b) => a + b, 0);
        return {
          planoContaId: it.planoContaNivel2Id,
          valorTotalCentavos,
          periodos
        };
      })
    });
  }

  async updateOrcamentoEmpreendimento(id: string, data: Partial<OrcamentoEmpreendimento>): Promise<OrcamentoEmpreendimento> {
    return this.updateOrcamento(id, {
      nome: data.nome || data.descricao,
      observacao: data.observacao
    });
  }

  async aprovarOrcamentoEmpreendimento(id: string, usuario = 'Diretoria de Engenharia'): Promise<OrcamentoEmpreendimento> {
    return this.aprovarOrcamento(id, usuario);
  }

  async criarNovaVersaoOrcamento(id: string): Promise<OrcamentoEmpreendimento> {
    return this.criarRevisaoOrcamento(id, 'Nova revisão solicitada via ERP.', 'Diretoria');
  }


  async getOrcamentoExecucao(orcamentoId: string, dataCorte?: string): Promise<OrcamentoExecucaoView> {
    const dataCorteEfetiva = dataCorte || new Date().toISOString().split('T')[0];
    const orcamento = await this.getOrcamentoById(orcamentoId);
    if (!orcamento) throw new Error('Orçamento não encontrado');

    const centroCustoId = orcamento.centroCustoId;
    const cc = mockCentrosCusto.find(c => c.id === centroCustoId);

    // Identificar árvore de centros de custo (inclui o próprio e eventuais filhos)
    const centroCustoTreeIds = [centroCustoId];
    mockCentrosCusto.filter(c => c.parentId === centroCustoId).forEach(c => centroCustoTreeIds.push(c.id));

    // Buscar orçamento V1 para comparação de linha base se versao > 1
    let orcamentoV1: Orcamento | null = null;
    if (orcamento.versao > 1) {
      if (orcamento.orcamentoBaseId) {
        orcamentoV1 = mockOrcamentosEmpreendimento.find(o => o.id === orcamento.orcamentoBaseId) || null;
      }
      if (!orcamentoV1) {
        orcamentoV1 = mockOrcamentosEmpreendimento.find(o => o.centroCustoId === centroCustoId && o.versao === 1) || null;
      }
    }

    const itensExecucao: OrcamentoExecucaoItemView[] = [];
    let totalOrcadoCentavos = 0;
    let totalComprometidoCentavos = 0;
    let totalRealizadoCentavos = 0;
    let totalOrcadoV1Centavos = 0;

    /**
     * Varre títulos e movimentos somando o que os rateios escolhidos consomem.
     *
     * `escolherRateios` é a única coisa que muda entre um item de orçamento e o
     * bloco "sem item de orçamento" — espelha `coletarConsumo` do repositório
     * Supabase, que fazia a mesma conta com um predicado ligeiramente diferente
     * (aqui o fallback por centro de custo ainda checava plano de contas, lá
     * não). Com o casamento só por item, a divergência deixa de existir.
     */
    const coletarConsumo = (escolherRateios: (rateios: TituloRateio[] | undefined) => RateioCasado<TituloRateio>[]) => {
      const comprometidoTitulos: ComprometidoTituloItem[] = [];
      const realizadoMovimentos: RealizadoMovimentoItem[] = [];

      let comprometidoCentavos = 0;
      let realizadoCentavos = 0;

      // 1. COMPROMETIDO (Títulos de despesa em aberto com competência no período do orçamento)
      mockTitulos
        .filter(t => t.tipo === 'P' && t.ativo && !t.aguardandoValor && t.dataCompetencia >= orcamento.dataInicio && t.dataCompetencia <= orcamento.dataFim)
        .forEach(t => {
          t.parcelas?.forEach(p => {
            if (!p.ativo) return;
            const movs = mockMovimentos.filter(m => m.parcelaId === p.id && !m.estornado);
            const baixadoCentavos = movs.reduce((sum, m) => sum + m.valorPagoCentavos, 0);
            const saldoParcelaCentavos = p.valorCentavos - baixadoCentavos;

            if (saldoParcelaCentavos <= 0) return;

            // Uma parcela pode ser rateada entre dois itens do mesmo orçamento —
            // por isso somamos todos os rateios que casam, não só o primeiro.
            for (const { percentual } of escolherRateios(p.rateios)) {
              const valorRateadoCentavos = Math.round(saldoParcelaCentavos * (percentual / 100));
              comprometidoCentavos += valorRateadoCentavos;

              const pessoa = mockPessoas.find(pe => pe.id === t.pessoaId);
              comprometidoTitulos.push({
                tituloId: t.id,
                parcelaId: p.id || '',
                numeroDocumento: t.numeroDocumento,
                descricao: t.descricao,
                pessoaNome: pessoa?.nome || 'Fornecedor',
                dataCompetencia: t.dataCompetencia,
                dataVencimento: p.dataVencimento,
                valorTotalParcelaCentavos: p.valorCentavos,
                valorRateadoCentavos,
                saldoParcelaCentavos,
                percentualRateio: percentual
              });
            }
          });
        });

      // 2. REALIZADO (Movimentos de caixa pagos efetivados)
      mockMovimentos
        .filter(m => !m.estornado && m.dataPagamento >= orcamento.dataInicio && m.dataPagamento <= dataCorteEfetiva)
        .forEach(m => {
          let parentTitulo: Titulo | null = null;
          let parentParcela: TituloParcela | null = null;
          for (const t of mockTitulos) {
            const p = t.parcelas?.find(par => par.id === m.parcelaId);
            if (p) {
              parentTitulo = t;
              parentParcela = p;
              break;
            }
          }
          if (!parentTitulo || parentTitulo.tipo !== 'P' || !parentParcela) return;

          for (const { percentual } of escolherRateios(parentParcela.rateios)) {
            const valorRateadoMovimentoCentavos = Math.round(m.valorLiquidoCentavos * (percentual / 100));
            realizadoCentavos += valorRateadoMovimentoCentavos;

            const pessoa = mockPessoas.find(pe => pe.id === parentTitulo.pessoaId);
            realizadoMovimentos.push({
              movimentoId: m.id,
              parcelaId: m.parcelaId || '',
              numeroDocumento: parentTitulo.numeroDocumento,
              descricao: parentTitulo.descricao,
              pessoaNome: pessoa?.nome || 'Fornecedor',
              dataPagamento: m.dataPagamento,
              formaPagamento: m.formaPagamento,
              valorPagoMovimentoCentavos: m.valorLiquidoCentavos,
              valorRateadoMovimentoCentavos,
              percentualRateio: percentual
            });
          }
        });

      return { comprometidoCentavos, realizadoCentavos, comprometidoTitulos, realizadoMovimentos };
    };

    for (const item of orcamento.itens) {
      const pcGrupoId = item.planoContaId || item.planoContaNivel2Id || '';
      const pcCodigo = item.planoContaCodigo || item.planoContaNivel2Codigo || '';
      const pcNome = item.planoContaNome || item.planoContaNivel2Nome || '';
      const orcadoCentavos = item.valorTotalCentavos;
      totalOrcadoCentavos += orcadoCentavos;

      const unidade = item.centroCustoId ? mockCentrosCusto.find(c => c.id === item.centroCustoId) : null;

      const { comprometidoCentavos, realizadoCentavos, comprometidoTitulos, realizadoMovimentos } =
        coletarConsumo((rateios) => rateiosDoItem(rateios, item.id));

      totalComprometidoCentavos += comprometidoCentavos;
      totalRealizadoCentavos += realizadoCentavos;

      const saldoCentavos = orcadoCentavos - comprometidoCentavos - realizadoCentavos;
      const consumido = comprometidoCentavos + realizadoCentavos;
      const percentualConsumido = orcadoCentavos > 0 ? (consumido / orcadoCentavos) * 100 : (consumido > 0 ? 100 : 0);
      const isEstourado = consumido > orcadoCentavos;
      const valorExcedenteCentavos = isEstourado ? consumido - orcadoCentavos : 0;

      // V1 Comparison
      let itemV1Centavos = 0;
      if (orcamentoV1) {
        const itemV1 = orcamentoV1.itens.find(it => (it.planoContaId === pcGrupoId || it.planoContaCodigo === pcCodigo));
        if (itemV1) itemV1Centavos = itemV1.valorTotalCentavos;
      }
      totalOrcadoV1Centavos += itemV1Centavos;

      const variacaoReaisCentavos = orcadoCentavos - itemV1Centavos;
      const variacaoPercentual = itemV1Centavos > 0 ? (variacaoReaisCentavos / itemV1Centavos) * 100 : 0;

      itensExecucao.push({
        itemId: item.id,
        itemCodigo: item.codigo,
        itemDescricao: item.descricao,
        centroCustoId: item.centroCustoId,
        centroCustoCodigo: unidade?.codigo,
        centroCustoNome: unidade ? unidade.nome : 'Toda a obra',
        planoContaNivel2Id: pcGrupoId,
        planoContaNivel2Codigo: pcCodigo,
        planoContaNivel2Nome: pcNome,
        orcadoCentavos,
        comprometidoCentavos,
        realizadoCentavos,
        saldoCentavos,
        percentualConsumido,
        isEstourado,
        valorExcedenteCentavos,
        comprometidoTitulos,
        realizadoMovimentos,
        orcadoV1Centavos: itemV1Centavos,
        variacaoReaisCentavos,
        variacaoPercentual
      });
    }

    /*
     * Lançado no centro de custo, mas sem item de orçamento apontado. Fica de
     * fora dos totais: como o centro de custo pode ter mais de um orçamento,
     * atribuir esse valor a um deles seria escolher no chute — e era isso que
     * fazia o mesmo dinheiro aparecer consumido nos dois.
     */
    const semItemOrcamento = coletarConsumo((rateios) => rateiosSemItem(rateios, centroCustoTreeIds));

    const totalSaldoCentavos = totalOrcadoCentavos - totalComprometidoCentavos - totalRealizadoCentavos;
    const totalConsumido = totalComprometidoCentavos + totalRealizadoCentavos;
    const totalPercentualConsumido = totalOrcadoCentavos > 0 ? (totalConsumido / totalOrcadoCentavos) * 100 : (totalConsumido > 0 ? 100 : 0);
    const isEstouradoGeral = totalConsumido > totalOrcadoCentavos;
    const totalExcedenteCentavos = isEstouradoGeral ? totalConsumido - totalOrcadoCentavos : 0;

    // GERAR CURVA S MÊS A MÊS DO PERÍODO
    const curvaS: OrcamentoCurvaSPonto[] = [];
    let acumOrcado = 0;
    let acumComprometido = 0;
    let acumRealizado = 0;

    const mesSet = new Set<string>();
    orcamento.itens.forEach(it => {
      if (it.periodos) {
        it.periodos.forEach(p => mesSet.add(p.mesReferencia.substring(0, 7)));
      } else if (it.distribuicaoMensal) {
        Object.keys(it.distribuicaoMensal).forEach(m => mesSet.add(m));
      }
    });
    const mesesOrdenados = Array.from(mesSet).sort();

    mesesOrdenados.forEach(mesAno => {
      let orcadoMes = 0;
      orcamento.itens.forEach(it => {
        if (it.periodos) {
          const found = it.periodos.find(p => p.mesReferencia.substring(0, 7) === mesAno);
          if (found) orcadoMes += found.valorCentavos;
        } else if (it.distribuicaoMensal) {
          orcadoMes += it.distribuicaoMensal[mesAno] || 0;
        }
      });
      acumOrcado += orcadoMes;

      let comprometidoMes = 0;
      itensExecucao.forEach(it => {
        it.comprometidoTitulos?.forEach(t => {
          if (t.dataCompetencia.startsWith(mesAno)) comprometidoMes += t.valorRateadoCentavos;
        });
      });
      acumComprometido += comprometidoMes;

      let realizadoMes = 0;
      itensExecucao.forEach(it => {
        it.realizadoMovimentos?.forEach(m => {
          if (m.dataPagamento.startsWith(mesAno)) realizadoMes += m.valorRateadoMovimentoCentavos;
        });
      });
      acumRealizado += realizadoMes;

      const acumConsumidoMes = acumComprometido + acumRealizado;
      const desvioMesCentavos = acumConsumidoMes - acumOrcado;
      const desvioMesPercentual = acumOrcado > 0 ? (desvioMesCentavos / acumOrcado) * 100 : 0;

      const [yyyy, mm] = mesAno.split('-');
      curvaS.push({
        mesAno,
        rotuloMes: `${mm}/${yyyy.substring(2)}`,
        orcadoMesCentavos: orcadoMes,
        comprometidoMesCentavos: comprometidoMes,
        realizadoMesCentavos: realizadoMes,
        desvioMesCentavos,
        desvioMesPercentual,
        orcadoAcumuladoCentavos: acumOrcado,
        comprometidoAcumuladoCentavos: acumComprometido,
        realizadoAcumuladoCentavos: acumRealizado,
        consumidoAcumuladoCentavos: acumConsumidoMes
      });
    });

    // Frase Analítica Direta da Curva S
    const desvioGeralCentavos = totalConsumido - totalOrcadoCentavos;
    const diffPercentualAbs = totalOrcadoCentavos > 0 ? (Math.abs(desvioGeralCentavos) / totalOrcadoCentavos) * 100 : 0;
    const statusDesvio = desvioGeralCentavos > 0 ? 'acima' : 'abaixo';

    const fraseStatusCurvaS = `Você deveria ter gasto R$ ${(totalOrcadoCentavos/100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} até hoje e gastou R$ ${(totalConsumido/100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — está ${diffPercentualAbs.toFixed(1)}% ${statusDesvio} do planejado.`;

    const variacaoV1TotalCentavos = totalOrcadoCentavos - totalOrcadoV1Centavos;
    const variacaoV1TotalPercentual = totalOrcadoV1Centavos > 0 ? (variacaoV1TotalCentavos / totalOrcadoV1Centavos) * 100 : 0;

    return {
      orcamentoId: orcamento.id,
      versao: orcamento.versao,
      status: orcamento.status,
      centroCustoId: orcamento.centroCustoId,
      centroCustoCodigo: cc?.codigo || '999',
      centroCustoNome: orcamento.centroCustoNome,
      dataInicio: orcamento.dataInicio,
      dataFim: orcamento.dataFim,
      dataCorte: dataCorteEfetiva,
      totalOrcadoCentavos,
      totalComprometidoCentavos,
      totalRealizadoCentavos,
      totalSaldoCentavos,
      totalPercentualConsumido,
      isEstouradoGeral,
      totalExcedenteCentavos,
      fraseStatusCurvaS,
      temLinhaBaseV1: !!orcamentoV1,
      totalOrcadoV1Centavos,
      variacaoV1TotalCentavos,
      variacaoV1TotalPercentual,
      itensExecucao,
      semItemOrcamento,
      curvaS
    };
  }

  async validarDisponibilidadeOrcamentaria(
    centroCustoId: string,
    planoContaId: string,
    valorCentavos: number
  ): Promise<DisponibilidadeOrcamentariaResultado> {
    const orc = mockOrcamentosEmpreendimento.find(o => o.centroCustoId === centroCustoId && o.status === 'aprovado' && o.isVigente);
    if (!orc) {
      return {
        hasOrcamentoVigente: false,
        orcadoCentavos: 0,
        consumidoCentavos: 0,
        disponivelCentavos: 0,
        isEstouro: false,
        estouroCentavos: 0
      };
    }

    const pcFolha = mockPlanoContas.find(pc => pc.id === planoContaId);
    let pcNivel2 = pcFolha;
    if (pcFolha) {
      let curP = mockPlanoContas.find(pc => pc.id === pcFolha.parentId);
      if (curP && curP.nivel > 2) curP = mockPlanoContas.find(pc => pc.id === curP?.parentId);
      if (curP) pcNivel2 = curP;
    }

    const exec = await this.getOrcamentoExecucao(orc.id);
    const itemExec = exec.itensExecucao.find(i => i.planoContaNivel2Id === pcNivel2?.id || i.planoContaNivel2Codigo === pcNivel2?.codigo);

    const orcadoCentavos = itemExec ? itemExec.orcadoCentavos : 0;
    const consumidoCentavos = itemExec ? (itemExec.comprometidoCentavos + itemExec.realizadoCentavos) : 0;
    const disponivelCentavos = Math.max(0, orcadoCentavos - consumidoCentavos);

    const isEstouro = (consumidoCentavos + valorCentavos) > orcadoCentavos;
    const estouroCentavos = isEstouro ? (consumidoCentavos + valorCentavos) - orcadoCentavos : 0;

    return {
      hasOrcamentoVigente: true,
      orcamentoId: orc.id,
      versao: orc.versao,
      planoContaNivel2Codigo: pcNivel2?.codigo,
      planoContaNivel2Nome: pcNivel2?.nome,
      orcadoCentavos,
      consumidoCentavos,
      disponivelCentavos,
      isEstouro,
      estouroCentavos
    };
  }

  // ---------------------------------------------------------------------------
  // 10. GESTÃO & GERADOR DE RECORRÊNCIAS (ETAPA 8 COMPLETO)
  // ---------------------------------------------------------------------------


  async getRecorrencias(filtro?: { tipo?: TipoTitulo; status?: StatusRecorrencia; pessoaId?: string; frequencia?: string }): Promise<Recorrencia[]> {
    let list = [...mockRecorrencias].filter(r => r.ativo);
    if (filtro?.tipo) list = list.filter(r => r.tipo === filtro.tipo);
    if (filtro?.status) list = list.filter(r => r.status === filtro.status);
    if (filtro?.pessoaId) list = list.filter(r => r.pessoaId === filtro.pessoaId);
    if (filtro?.frequencia) list = list.filter(r => r.frequencia === filtro.frequencia);
    return list;
  }

  async getRecorrenciaById(id: string): Promise<Recorrencia | null> {
    return mockRecorrencias.find(r => r.id === id && r.ativo) || null;
  }

  async createRecorrencia(data: Omit<Recorrencia, 'id' | 'createdAt' | 'proximaCompetencia'>): Promise<Recorrencia> {
    const pes = mockPessoas.find(p => p.id === data.pessoaId);
    const pc = mockPlanoContas.find(p => p.id === data.planoContaId);

    const id = `rec-${Date.now()}`;
    const dataIni = data.dataInicio || new Date().toISOString().split('T')[0];
    const proximaCompetencia = `${dataIni.substring(0, 7)}-01`;

    const newRec: Recorrencia = {
      ...data,
      id,
      pessoaNome: pes?.nome,
      planoContaNome: pc?.nome,
      proximaCompetencia,
      status: data.status || 'ativa',
      ativo: true,
      createdAt: new Date().toISOString().split('T')[0]
    };

    mockRecorrencias.unshift(newRec);
    return newRec;
  }

  async updateRecorrencia(id: string, data: Partial<Recorrencia>): Promise<Recorrencia> {
    const idx = mockRecorrencias.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Recorrência não encontrada');

    // Regra de Ouro 2: Alteração vale para ocorrências futuras. Títulos já gerados não mudam!
    mockRecorrencias[idx] = {
      ...mockRecorrencias[idx],
      ...data,
      updatedAt: new Date().toISOString().split('T')[0]
    };
    return mockRecorrencias[idx];
  }

  async pausarRecorrencia(id: string): Promise<Recorrencia> {
    return this.updateRecorrencia(id, { status: 'pausada' });
  }

  async reativarRecorrencia(id: string): Promise<Recorrencia> {
    return this.updateRecorrencia(id, { status: 'ativa' });
  }

  async encerrarRecorrencia(id: string): Promise<Recorrencia> {
    // Regra de Ouro 3: Encerrar nunca apaga títulos já gerados por ela
    return this.updateRecorrencia(id, { status: 'encerrada' });
  }

  // PRÉVIA DAS PRÓXIMAS N OCORRÊNCIAS EM TEMPO REAL (EDITOR)
  async calcularProximasOcorrencias(recorrencia: Partial<Recorrencia>, qtd: number = 12): Promise<ProximaOcorrenciaPrevia[]> {
    const previas: ProximaOcorrenciaPrevia[] = [];
    if (!recorrencia.dataInicio) return previas;

    const dataIni = new Date(recorrencia.dataInicio);
    let curY = dataIni.getFullYear();
    let curM = dataIni.getMonth(); // 0-based
    let curD = recorrencia.diaVencimento || 10;
    const frequencia = recorrencia.frequencia || 'mensal';
    const ajuste = recorrencia.ajusteDiaUtil || 'nenhum';
    const diaSemana = recorrencia.diaSemana ?? 1;

    let totalCalculadas = 0;
    let dataAtualIteracao = new Date(curY, curM, 1);

    while (totalCalculadas < qtd) {
      if (recorrencia.dataFim && dataAtualIteracao.toISOString().split('T')[0] > recorrencia.dataFim) break;
      if (recorrencia.qtdOcorrencias && totalCalculadas >= recorrencia.qtdOcorrencias) break;

      const yyyy = dataAtualIteracao.getFullYear();
      const mm = dataAtualIteracao.getMonth();
      const competenciaStr = `${yyyy}-${(mm + 1) < 10 ? '0' + (mm + 1) : (mm + 1)}-01`;

      // 1. Data Vencimento Base
      let dataVenc: Date;
      if (frequencia === 'semanal' || frequencia === 'quinzenal') {
        const d = new Date(dataAtualIteracao);
        const diffDays = (diaSemana + 7 - d.getDay()) % 7;
        d.setDate(d.getDate() + diffDays + (totalCalculadas * (frequencia === 'quinzenal' ? 14 : 7)));
        dataVenc = d;
      } else {
        const ultimoDiaMes = new Date(yyyy, mm + 1, 0).getDate();
        const diaEf = Math.min(curD, ultimoDiaMes);
        dataVenc = new Date(yyyy, mm, diaEf);
      }

      // 2. Ajuste de Dia Útil e Feriado
      const dataAjustada = ajustarDiaUtilEFeriado(dataVenc, ajuste, mockFeriados);
      const isAjustado = dataAjustada.toISOString().split('T')[0] !== dataVenc.toISOString().split('T')[0];

      const nomesDias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const diaSemanaRotulo = nomesDias[dataAjustada.getDay()];

      previas.push({
        competencia: competenciaStr,
        dataVencimento: dataAjustada.toISOString().split('T')[0],
        diaSemanaRotulo,
        valorCentavos: recorrencia.tipoValor === 'variavel' ? 0 : (recorrencia.valorBrutoCentavos || 0),
        isAjustadoDiaUtil: isAjustado
      });

      totalCalculadas++;

      // Incremento de mês por frequência
      let stepMonths = 1;
      if (frequencia === 'bimestral') stepMonths = 2;
      else if (frequencia === 'trimestral') stepMonths = 3;
      else if (frequencia === 'semestral') stepMonths = 6;
      else if (frequencia === 'anual') stepMonths = 12;

      dataAtualIteracao.setMonth(dataAtualIteracao.getMonth() + stepMonths);
    }

    return previas;
  }

  // GERAÇÃO IDEMPOTENTE DA OCORRÊNCIA (GERADO / PULADO / CANCELADO)
  async gerarOcorrencia(
    recorrenciaId: string, 
    competencia: string, 
    origem: 'automatico' | 'manual', 
    motivo?: string
  ): Promise<{ status: 'gerado' | 'ja_gerado' | 'erro'; titulo?: Titulo }> {
    const rec = mockRecorrencias.find(r => r.id === recorrenciaId);
    if (!rec) throw new Error('Recorrência não encontrada');

    // ANTI-DUPLICIDADE / IDEMPOTÊNCIA ESTREITA (UNIQUE Constraint recorrencia_id, competencia)
    const jaGerado = mockRecorrenciaOcorrencias.some(o => o.recorrenciaId === recorrenciaId && o.competencia === competencia);
    if (jaGerado) {
      return { status: 'ja_gerado' };
    }

    const previas = await this.calcularProximasOcorrencias(rec, 1);
    const previa = previas[0] || {
      competencia,
      dataVencimento: competencia,
      diaSemanaRotulo: 'Segunda-feira',
      valorCentavos: rec.valorBrutoCentavos,
      isAjustadoDiaUtil: false
    };

    const isVariavel = rec.tipoValor === 'variavel';
    const valorCentavos = isVariavel ? 0 : rec.valorBrutoCentavos;

    const pes = mockPessoas.find(p => p.id === rec.pessoaId);
    const pc = mockPlanoContas.find(p => p.id === rec.planoContaId);

    const tituloId = `t-rec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const periodoRotulo = competencia.substring(0, 7);

    const seqRec = nextTituloSeqCounter++;
    const newTitulo: Titulo = {
      id: tituloId,
      codigo: String(seqRec).padStart(6, '0'),
      tipo: rec.tipo,
      pessoaId: rec.pessoaId,
      pessoaNome: pes?.nome,
      planoContaId: rec.planoContaId,
      planoContaNome: pc?.nome,
      numeroDocumento: `REC-${periodoRotulo.replace('-', '')}`,
      dataEmissao: new Date().toISOString().split('T')[0],
      dataCompetencia: competencia,
      valorBrutoCentavos: valorCentavos,
      qtdParcelas: 1,
      descricao: `${rec.descricao} (${periodoRotulo})${isVariavel ? ' [Aguardando Valor]' : ''}`,
      observacao: `Ocorrência gerada via Recorrência #${rec.id}`,
      ativo: true,
      recorrenciaId: rec.id,
      recorrenciaPeriodo: periodoRotulo,
      aguardandoValor: isVariavel,
      createdAt: new Date().toISOString().split('T')[0],
      parcelas: [
        {
          id: `p-${tituloId}-1`,
          tituloId,
          numero: 1,
          dataVencimento: previa.dataVencimento,
          valorCentavos: valorCentavos,
          observacao: `Parcela Recorrente ${periodoRotulo}`,
          ativo: true,
          rateios: rec.rateios && rec.rateios.length > 0 ? rec.rateios.map(r => ({
            centroCustoId: r.centroCustoId,
            centroCustoNome: r.centroCustoNome,
            percentual: r.percentual,
            valorCentavos: Math.round(valorCentavos * (r.percentual / 100))
          })) : [
            {
              centroCustoId: 'cc-999',
              centroCustoNome: 'Não alocado',
              percentual: 100,
              valorCentavos
            }
          ]
        }
      ]
    };

    mockTitulos.unshift(newTitulo);

    const newOcorrencia: RecorrenciaOcorrencia = {
      id: `ocor-${Date.now()}`,
      recorrenciaId,
      recorrenciaDescricao: rec.descricao,
      competencia,
      tituloId,
      valorGeradoCentavos: valorCentavos,
      dataVencimento: previa.dataVencimento,
      origem,
      status: 'gerado',
      geradoEm: new Date().toISOString(),
      geradoPor: origem === 'automatico' ? 'Gerador Automático (Cron)' : 'Usuário (Manual)',
      motivo
    };

    mockRecorrenciaOcorrencias.unshift(newOcorrencia);

    // Atualiza competências na recorrência master
    rec.ultimaCompetenciaGerada = competencia;
    const proxPrevias = await this.calcularProximasOcorrencias({ ...rec, dataInicio: previa.dataVencimento }, 2);
    if (proxPrevias.length > 1) {
      rec.proximaCompetencia = proxPrevias[1].competencia;
    }

    return { status: 'gerado', titulo: newTitulo };
  }

  // PROCESSAR FILA DE RECORRÊNCIAS NO PERÍODO
  async processarFila(dataReferencia?: string): Promise<LogExecucaoFila> {
    const dataRefStr = dataReferencia || new Date().toISOString().split('T')[0];
    const dataRefDate = new Date(dataRefStr);

    let qtdGeradas = 0;
    let qtdPuladas = 0;
    const erros: string[] = [];

    const ativas = mockRecorrencias.filter(r => r.status === 'ativa' && r.ativo);

    for (const rec of ativas) {
      const dataCompDate = new Date(rec.proximaCompetencia);
      const diffDays = Math.round((dataCompDate.getTime() - dataRefDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays <= rec.antecedenciaGeracao) {
        if (rec.gerarAutomatico) {
          try {
            const res = await this.gerarOcorrencia(rec.id, rec.proximaCompetencia, 'automatico');
            if (res.status === 'gerado') qtdGeradas++;
            else if (res.status === 'ja_gerado') qtdPuladas++;
          } catch (err: any) {
            erros.push(`Erro na recorrência ${rec.descricao}: ${err.message}`);
          }
        } else {
          qtdPuladas++;
        }
      }
    }

    const logItem: LogExecucaoFila = {
      id: `log-${Date.now()}`,
      dataExecucao: new Date().toISOString().replace('T', ' ').substring(0, 19),
      qtdGeradas,
      qtdPuladas,
      erros
    };

    mockRecorrenciaLogs.unshift(logItem);
    return logItem;
  }

  // PULAR OCORRÊNCIA
  async pularOcorrencia(recorrenciaId: string, competencia: string, motivo: string): Promise<RecorrenciaOcorrencia> {
    const rec = mockRecorrencias.find(r => r.id === recorrenciaId);

    const ocor: RecorrenciaOcorrencia = {
      id: `ocor-${Date.now()}`,
      recorrenciaId,
      recorrenciaDescricao: rec?.descricao,
      competencia,
      valorGeradoCentavos: 0,
      dataVencimento: competencia,
      origem: 'manual',
      status: 'pulado',
      geradoEm: new Date().toISOString(),
      motivo
    };

    mockRecorrenciaOcorrencias.unshift(ocor);

    if (rec) {
      const proxPrevias = await this.calcularProximasOcorrencias({ ...rec, dataInicio: competencia }, 2);
      if (proxPrevias.length > 1) {
        rec.proximaCompetencia = proxPrevias[1].competencia;
      }
    }

    return ocor;
  }

  // PREENCHER VALOR DE TÍTULO VARIÁVEL (ABU AGUARDANDO VALOR)
  async preencherValorTituloVariavel(tituloId: string, valorBrutoCentavos: number): Promise<Titulo> {
    const tit = mockTitulos.find(t => t.id === tituloId);
    if (!tit) throw new Error('Título não encontrado');

    tit.valorBrutoCentavos = valorBrutoCentavos;
    tit.aguardandoValor = false;
    tit.descricao = tit.descricao?.replace(' [Aguardando Valor]', '');

    if (tit.parcelas && tit.parcelas.length > 0) {
      tit.parcelas[0].valorCentavos = valorBrutoCentavos;
      if (tit.parcelas[0].rateios) {
        tit.parcelas[0].rateios.forEach(r => {
          r.valorCentavos = Math.round(valorBrutoCentavos * (r.percentual / 100));
        });
      }
    }

    const ocor = mockRecorrenciaOcorrencias.find(o => o.tituloId === tituloId);
    if (ocor) {
      ocor.valorGeradoCentavos = valorBrutoCentavos;
    }

    return tit;
  }

  // AÇÃO EM LOTE DE REAJUSTE
  async aplicarReajusteEmLote(recorrenciaIds: string[], percentual: number, indice: string = 'IGPM', observacao?: string): Promise<RecorrenciaReajuste[]> {
    const reajustes: RecorrenciaReajuste[] = [];
    const hojeStr = new Date().toISOString().split('T')[0];

    for (const id of recorrenciaIds) {
      const rec = mockRecorrencias.find(r => r.id === id);
      if (!rec) continue;

      const valorAnteriorCentavos = rec.valorBrutoCentavos;
      const valorNovoCentavos = Math.round(valorAnteriorCentavos * (1 + percentual / 100));

      rec.valorBrutoCentavos = valorNovoCentavos;
      rec.percentualReajuste = percentual;
      rec.indiceReajuste = (indice as any) || 'fixo';
      rec.updatedAt = hojeStr;

      const reaj: RecorrenciaReajuste = {
        id: `reaj-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        recorrenciaId: id,
        recorrenciaDescricao: rec.descricao,
        dataReajuste: hojeStr,
        valorAnteriorCentavos,
        valorNovoCentavos,
        percentual,
        indice,
        observacao,
        createdAt: hojeStr
      };

      mockRecorrenciaReajustes.unshift(reaj);
      reajustes.push(reaj);
    }

    return reajustes;
  }

  // CONSULTAS AUXILIARES
  async getOcorrenciasByRecorrencia(recorrenciaId: string): Promise<RecorrenciaOcorrencia[]> {
    return mockRecorrenciaOcorrencias.filter(o => o.recorrenciaId === recorrenciaId);
  }

  async getReajustesByRecorrencia(recorrenciaId: string): Promise<RecorrenciaReajuste[]> {
    return mockRecorrenciaReajustes.filter(r => r.recorrenciaId === recorrenciaId);
  }

  async getLogsExecucaoFila(): Promise<LogExecucaoFila[]> {
    return mockRecorrenciaLogs;
  }

  async getFeriados(): Promise<Feriado[]> {
    return mockFeriados;
  }

  // MÉTODOS RETROCOMPATÍVEIS DA ETAPA ANTERIOR
  async simularGeracaoRetroativa(recorrenciaId?: string, ateData?: string): Promise<GeracaoRetroativaSimulacaoResultado> {
    const dataLimiteStr = ateData || new Date().toISOString().split('T')[0];
    const recorrenciasAlvo = recorrenciaId 
      ? mockRecorrencias.filter(r => r.id === recorrenciaId && r.status === 'ativa' && r.ativo)
      : mockRecorrencias.filter(r => r.status === 'ativa' && r.ativo);

    const ocorrencias: GeracaoRetroativaOcorrenciaItem[] = [];
    let valorTotalCentavos = 0;

    for (const rec of recorrenciasAlvo) {
      let curComp = rec.proximaCompetencia || rec.dataInicio;

      while (curComp <= dataLimiteStr) {
        if (rec.dataFim && curComp > rec.dataFim) break;

        const jaExiste = mockRecorrenciaOcorrencias.some(o => o.recorrenciaId === rec.id && o.competencia === curComp);
        if (!jaExiste) {
          const pes = mockPessoas.find(p => p.id === rec.pessoaId);
          ocorrencias.push({
            recorrenciaId: rec.id,
            descricao: `${rec.descricao} (${curComp.substring(0, 7)})`,
            pessoaNome: pes?.nome || rec.pessoaNome || 'Pessoa',
            dataVencimento: curComp,
            periodoRotulo: curComp.substring(0, 7),
            valorCentavos: rec.valorBrutoCentavos
          });
          valorTotalCentavos += rec.valorBrutoCentavos;
        }

        const prevs = await this.calcularProximasOcorrencias({ ...rec, dataInicio: curComp }, 2);
        if (prevs.length > 1) curComp = prevs[1].competencia;
        else break;
      }
    }

    return {
      ocorrencias,
      totalTitulos: ocorrencias.length,
      valorTotalCentavos
    };
  }

  async gerarTitulosRecorrentes(recorrenciaId?: string, ateData?: string): Promise<{ titulosGerados: Titulo[]; qtdGerados: number; valorTotalCentavos: number }> {
    const dataLimiteStr = ateData || new Date().toISOString().split('T')[0];
    const recorrenciasAlvo = recorrenciaId 
      ? mockRecorrencias.filter(r => r.id === recorrenciaId && r.status === 'ativa' && r.ativo)
      : mockRecorrencias.filter(r => r.status === 'ativa' && r.ativo);

    const titulosGerados: Titulo[] = [];
    let valorTotalCentavos = 0;

    for (const rec of recorrenciasAlvo) {
      let curComp = rec.proximaCompetencia || rec.dataInicio;

      while (curComp <= dataLimiteStr) {
        if (rec.dataFim && curComp > rec.dataFim) break;

        const res = await this.gerarOcorrencia(rec.id, curComp, 'manual');
        if (res.status === 'gerado' && res.titulo) {
          titulosGerados.push(res.titulo);
          valorTotalCentavos += res.titulo.valorBrutoCentavos;
        }

        const prevs = await this.calcularProximasOcorrencias({ ...rec, dataInicio: curComp }, 2);
        if (prevs.length > 1) curComp = prevs[1].competencia;
        else break;
      }
    }

    return {
      titulosGerados,
      qtdGerados: titulosGerados.length,
      valorTotalCentavos
    };
  }

  // ---------------------------------------------------------------------------
  // 11. CONCILIAÇÃO BANCÁRIA (ETAPA 9 COMPLETA)
  // ---------------------------------------------------------------------------
  async parseEPreviewOFX(contaBancariaId: string, conteudoOFXText: string, arquivoNome: string): Promise<PreviewImportacaoOFX> {
    // 1. PARSER OFX SIMPLES E ROBUSTO (Extrai TRNTYPE, DTPOSTED, TRNAMT, FITID, MEMO)
    const rawLines = conteudoOFXText.split('\n');
    const itensRaw: { fitid: string; dataLancamento: string; valorCentavos: number; descricao: string }[] = [];
    
    let curFitid = '';
    let curDate = '';
    let curVal = 0;
    let curMemo = '';

    for (let line of rawLines) {
      line = line.trim();
      if (line.includes('<FITID>')) {
        curFitid = line.replace(/<FITID>/g, '').replace(/<\/FITID>/g, '').trim();
      } else if (line.includes('<DTPOSTED>')) {
        const rawD = line.replace(/<DTPOSTED>/g, '').replace(/<\/DTPOSTED>/g, '').trim();
        if (rawD.length >= 8) {
          curDate = `${rawD.slice(0,4)}-${rawD.slice(4,6)}-${rawD.slice(6,8)}`;
        }
      } else if (line.includes('<TRNAMT>')) {
        const rawV = line.replace(/<TRNAMT>/g, '').replace(/<\/TRNAMT>/g, '').trim();
        curVal = Math.round(parseFloat(rawV) * 100);
      } else if (line.includes('<MEMO>') || line.includes('<NAME>')) {
        curMemo = line.replace(/<MEMO>/g, '').replace(/<\/MEMO>/g, '').replace(/<NAME>/g, '').replace(/<\/NAME>/g, '').trim();
      } else if (line.includes('</STMTTRN>')) {
        if (curFitid) {
          itensRaw.push({
            fitid: curFitid,
            dataLancamento: curDate || new Date().toISOString().split('T')[0],
            valorCentavos: curVal,
            descricao: curMemo || 'Lançamento Extrato OFX'
          });
        }
        curFitid = '';
        curDate = '';
        curVal = 0;
        curMemo = '';
      }
    }

    // Se o texto não for um arquivo OFX completo, cria dados fictícios baseados no nome do arquivo
    if (itensRaw.length === 0) {
      const hoje = new Date().toISOString().split('T')[0];
      itensRaw.push(
        { fitid: `FIT-${Date.now()}-1`, dataLancamento: hoje, valorCentavos: -4500, descricao: 'TARIFA MANUTENCAO CONTA CORRENTE' },
        { fitid: `FIT-${Date.now()}-2`, dataLancamento: hoje, valorCentavos: 1800000, descricao: 'PIX RECEBIDO CONSTRUTORA ALFA' },
        { fitid: `FIT-${Date.now()}-3`, dataLancamento: hoje, valorCentavos: -225000, descricao: 'TED CONCRETOS BRASIL SA' }
      );
    }

    // Ordena por data para determinar período
    itensRaw.sort((a, b) => a.dataLancamento.localeCompare(b.dataLancamento));
    const dataInicio = itensRaw[0]?.dataLancamento || new Date().toISOString().split('T')[0];
    const dataFim = itensRaw[itensRaw.length - 1]?.dataLancamento || dataInicio;

    // PREVIEW: Verifica quais já existem por FITID (Regra 1 Anti-Duplicidade)
    let qtdExistentesFitid = 0;
    let qtdNovosImportar = 0;
    const novosItensPreview: Omit<ExtratoLancamento, 'id' | 'contaBancariaId' | 'status' | 'confiancaSugestao'>[] = [];

    for (const item of itensRaw) {
      const jaExiste = mockExtratoItems.some(e => e.contaBancariaId === contaBancariaId && e.fitid === item.fitid);
      if (jaExiste) {
        qtdExistentesFitid++;
      } else {
        qtdNovosImportar++;
        novosItensPreview.push({
          fitid: item.fitid,
          dataLancamento: item.dataLancamento,
          valorCentavos: item.valorCentavos,
          descricao: item.descricao
        });
      }
    }

    // Validação de buraco na sequência em relação à última importação
    const ultimasImps = mockExtratoImportacoes.filter(i => i.contaBancariaId === contaBancariaId);
    let temBuracoSequencia = false;
    let mensagemAlertaBuraco: string | undefined = undefined;

    if (ultimasImps.length > 0) {
      const ultimaFim = ultimasImps[0].dataFim;
      const diffDays = Math.ceil(
        (new Date(dataInicio).getTime() - new Date(ultimaFim).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays > 7) {
        temBuracoSequencia = true;
        mensagemAlertaBuraco = `Atenção: Existe um intervalo de ${diffDays} dias sem extrato importado entre a última importação (${ultimaFim}) e a atual (${dataInicio}).`;
      }
    }

    return {
      arquivoNome,
      dataInicio,
      dataFim,
      saldoInicialCentavos: 15000000,
      saldoFinalCentavos: 16100000,
      qtdTotalInFile: itensRaw.length,
      qtdExistentesFitid,
      qtdNovosImportar,
      temBuracoSequencia,
      mensagemAlertaBuraco,
      itensPreview: novosItensPreview
    };
  }

  async confirmarImportacaoOFX(contaBancariaId: string, preview: PreviewImportacaoOFX): Promise<ExtratoImportacao> {
    const idImp = `imp-${Date.now()}`;
    const novaImp: ExtratoImportacao = {
      id: idImp,
      contaBancariaId,
      arquivoNome: preview.arquivoNome,
      formato: 'ofx',
      dataInicio: preview.dataInicio,
      dataFim: preview.dataFim,
      saldoInicialArquivoCentavos: preview.saldoInicialCentavos,
      saldoFinalArquivoCentavos: preview.saldoFinalCentavos,
      qtdLancamentos: preview.qtdNovosImportar,
      qtdConciliados: 0,
      importadoEm: new Date().toISOString(),
      importadoPor: 'Fabrício (Engenharia)',
      status: 'concluida'
    };

    mockExtratoImportacoes.unshift(novaImp);

    // Grava apenas os itens novos
    for (const raw of preview.itensPreview) {
      const idItem = `ext-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newItem: ExtratoLancamento = {
        ...raw,
        id: idItem,
        importacaoId: idImp,
        contaBancariaId,
        status: 'nao_conciliado',
        confiancaSugestao: 0
      };
      mockExtratoItems.unshift(newItem);
    }

    // Executa o motor em cascata logo após a importação
    await this.executarMotorCasamento(contaBancariaId);

    return novaImp;
  }

  // MOTOR DE CASAMENTO EM CASCATA (NÍVEIS 1 A 5)
  async executarMotorCasamento(contaBancariaId: string): Promise<{ sugestoes: SugestaoCasamento[]; qtdAutoConciliadosNivel1: number }> {
    const sugestoes: SugestaoCasamento[] = [];
    let qtdAutoConciliadosNivel1 = 0;

    const extratoPendentes = mockExtratoItems.filter(
      e => e.contaBancariaId === contaBancariaId && e.status === 'nao_conciliado'
    );
    const movimentosPendentes = mockMovimentos.filter(
      m => m.contaBancariaId === contaBancariaId && !m.estornado && !m.conciliado
    );
    const regrasAtivas = mockConciliacaoRegras.filter(
      r => r.ativo && (!r.contaBancariaId || r.contaBancariaId === contaBancariaId)
    );

    for (const item of extratoPendentes) {
      const valSignedExtrato = item.valorCentavos;
      const valAbsExtrato = Math.abs(valSignedExtrato);
      const dataExtrato = new Date(item.dataLancamento).getTime();

      // NÍVEL 1: Mesma conta, mesmo valor exato, mesma data, CANDIDATO ÚNICO (Confiança 100%, Auto)
      const candidatosNivel1 = movimentosPendentes.filter(m => {
        if (m.conciliado) return false;
        if (m.dataPagamento !== item.dataLancamento) return false;
        return m.valorLiquidoCentavos === valAbsExtrato;
      });

      if (candidatosNivel1.length === 1) {
        const match = candidatosNivel1[0];
        item.status = 'conciliado';
        item.movimentoId = match.id;
        item.confiancaSugestao = 100;
        item.nivelSugestao = 1;
        item.motivoSugestao = 'Nível 1 (100%): Auto-conciliado por valor e data exatos (Candidato único)';
        item.conciliadoEm = new Date().toISOString();
        item.conciliadoPor = 'Sistema (Motor Cascata Nível 1)';

        match.conciliado = true;
        match.fitid = item.fitid;
        match.extratoLancamentoId = item.id;
        match.dataConciliacao = item.conciliadoEm;

        mockConciliacaoLogs.unshift({
          id: `log-${Date.now()}-${Math.random()}`,
          contaBancariaId,
          extratoItemId: item.id,
          movimentoId: match.id,
          acao: 'conciliado_auto',
          motivo: item.motivoSugestao,
          realizadoEm: item.conciliadoEm,
          realizadoPor: 'Sistema (Auto Nível 1)'
        });

        qtdAutoConciliadosNivel1++;
        continue;
      }

      // NÍVEL 2: Mesma conta, valor exato, data até 3 dias (Confiança 85%)
      const candidatosNivel2 = movimentosPendentes.filter(m => {
        if (m.conciliado) return false;
        if (m.valorLiquidoCentavos !== valAbsExtrato) return false;
        const diffDays = Math.abs(
          (new Date(m.dataPagamento).getTime() - dataExtrato) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= 3;
      });

      if (candidatosNivel2.length > 0) {
        item.confiancaSugestao = 85;
        item.nivelSugestao = 2;
        item.motivoSugestao = `Nível 2 (85%): Sugestão de valor exato de R$ ${(valAbsExtrato/100).toFixed(2)} com até 3 dias de diferença`;
        sugestoes.push({
          extratoLancamentoId: item.id,
          nivel: 2,
          confiancaPercentual: 85,
          movimentoId: candidatosNivel2[0].id,
          motivo: item.motivoSugestao
        });
        continue;
      }

      // NÍVEL 3: Valor com diferença de até R$ 0,05, data até 5 dias (Confiança 70%)
      const candidatosNivel3 = movimentosPendentes.filter(m => {
        if (m.conciliado) return false;
        const diffValor = Math.abs(m.valorLiquidoCentavos - valAbsExtrato);
        const diffDays = Math.abs(
          (new Date(m.dataPagamento).getTime() - dataExtrato) / (1000 * 60 * 60 * 24)
        );
        return diffValor <= 5 && diffDays <= 5;
      });

      if (candidatosNivel3.length > 0) {
        item.confiancaSugestao = 70;
        item.nivelSugestao = 3;
        item.motivoSugestao = `Nível 3 (70%): Sugestão por valor aproximado (diferença de R$ ${(Math.abs(candidatosNivel3[0].valorLiquidoCentavos - valAbsExtrato)/100).toFixed(2)}) e até 5 dias`;
        sugestoes.push({
          extratoLancamentoId: item.id,
          nivel: 3,
          confiancaPercentual: 70,
          movimentoId: candidatosNivel3[0].id,
          motivo: item.motivoSugestao
        });
        continue;
      }

      // NÍVEL 4: Agrupamento Borderô (Soma de N movimentos = 1 lançamento extrato) (Confiança 60%)
      const candidatosNivel4 = movimentosPendentes.filter(m => {
        if (m.conciliado) return false;
        const diffDays = Math.abs(
          (new Date(m.dataPagamento).getTime() - dataExtrato) / (1000 * 60 * 60 * 24)
        );
        return diffDays <= 3;
      }).slice(0, 20);

      const somaGroup = candidatosNivel4.reduce((sum, m) => sum + m.valorLiquidoCentavos, 0);
      if (candidatosNivel4.length > 1 && somaGroup === valAbsExtrato) {
        item.confiancaSugestao = 60;
        item.nivelSugestao = 4;
        item.motivoSugestao = `Nível 4 (60%): Sugestão de agrupamento em lote (Borderô de ${candidatosNivel4.length} movimentos do ERP sumando R$ ${(valAbsExtrato/100).toFixed(2)})`;
        sugestoes.push({
          extratoLancamentoId: item.id,
          nivel: 4,
          confiancaPercentual: 60,
          movimentosIdsAgrupados: candidatosNivel4.map(m => m.id),
          motivo: item.motivoSugestao
        });
        continue;
      }

      // NÍVEL 5: Aplica conciliacao_regra por trecho de descrição
      const descUpper = item.descricao.toUpperCase();
      const regraMatch = regrasAtivas.find(r => descUpper.includes(r.padraoDescricao.toUpperCase()));

      if (regraMatch) {
        item.confiancaSugestao = 50;
        item.nivelSugestao = 5;
        item.regraAplicadaId = regraMatch.id;
        item.motivoSugestao = `Nível 5: Regra Aplicada ("${regraMatch.padraoDescricao}" -> Sugerir ${regraMatch.planoContaNome || 'Despesa/Receita'})`;
        sugestoes.push({
          extratoLancamentoId: item.id,
          nivel: 5,
          confiancaPercentual: 50,
          motivo: item.motivoSugestao,
          sugestaoAvulsoRegra: {
            pessoaId: regraMatch.pessoaId,
            planoContaId: regraMatch.planoContaId,
            centroCustoId: regraMatch.centroCustoId,
            regraId: regraMatch.id
          }
        });
      }
    }

    return { sugestoes, qtdAutoConciliadosNivel1 };
  }

  // Conciliação em lote dos de 100%
  async conciliarTodosNivel1_100Percent(contaBancariaId: string): Promise<{ conciliacoesEfetuadas: number }> {
    const res = await this.executarMotorCasamento(contaBancariaId);
    return { conciliacoesEfetuadas: res.qtdAutoConciliadosNivel1 };
  }

  // Conciliar Agrupados (Nível 4 - Borderô)
  async conciliarAgrupados(extratoLancamentoId: string, movimentoIds: string[]): Promise<void> {
    const item = mockExtratoItems.find(e => e.id === extratoLancamentoId);
    if (!item) throw new Error('Lançamento do extrato não encontrado');

    item.status = 'conciliado';
    item.movimentosAgrupadosIds = movimentoIds;
    item.conciliadoEm = new Date().toISOString();
    item.conciliadoPor = 'Usuário (Agrupamento Borderô)';

    movimentoIds.forEach(mId => {
      const mov = mockMovimentos.find(m => m.id === mId);
      if (mov) {
        mov.conciliado = true;
        mov.fitid = item.fitid;
        mov.extratoLancamentoId = item.id;
        mov.dataConciliacao = item.conciliadoEm;
      }
    });

    mockConciliacaoLogs.unshift({
      id: `log-${Date.now()}`,
      contaBancariaId: item.contaBancariaId,
      extratoItemId: item.id,
      acao: 'conciliado_manual',
      motivo: `Conciliado agrupamento de ${movimentoIds.length} movimentos em lote (Borderô)`,
      realizadoEm: new Date().toISOString(),
      realizadoPor: 'Usuário (Manual)'
    });
  }

  async ignorarLancamentoExtrato(extratoLancamentoId: string, motivo: string): Promise<void> {
    const item = mockExtratoItems.find(e => e.id === extratoLancamentoId);
    if (!item) throw new Error('Lançamento do extrato não encontrado');

    item.status = 'ignorado';
    item.observacao = motivo;

    mockConciliacaoLogs.unshift({
      id: `log-${Date.now()}`,
      contaBancariaId: item.contaBancariaId,
      extratoItemId: item.id,
      acao: 'desconciliado',
      motivo: `Lançamento ignorado pelo usuário: ${motivo}`,
      realizadoEm: new Date().toISOString(),
      realizadoPor: 'Usuário (Manual)'
    });
  }

  async criarRegraConciliacao(data: Omit<ConciliacaoRegra, 'id' | 'vezesAplicada' | 'createdAt'>): Promise<ConciliacaoRegra> {
    const pes = mockPessoas.find(p => p.id === data.pessoaId);
    const pc = mockPlanoContas.find(p => p.id === data.planoContaId);
    const cc = mockCentrosCusto.find(c => c.id === data.centroCustoId);

    const newRegra: ConciliacaoRegra = {
      ...data,
      id: `reg-${Date.now()}`,
      pessoaNome: pes?.nome,
      planoContaNome: pc?.nome,
      centroCustoNome: cc?.nome,
      vezesAplicada: 0,
      ativo: true,
      createdAt: new Date().toISOString().split('T')[0]
    };

    mockConciliacaoRegras.unshift(newRegra);
    return newRegra;
  }

  async getRegrasConciliacao(contaBancariaId?: string): Promise<ConciliacaoRegra[]> {
    let list = [...mockConciliacaoRegras].filter(r => r.ativo);
    if (contaBancariaId) {
      list = list.filter(r => !r.contaBancariaId || r.contaBancariaId === contaBancariaId);
    }
    return list;
  }

  async getResumoSaldosConciliacaoEtapa9(contaBancariaId: string): Promise<ResumoSaldosConciliacaoEtapa9> {
    const cb = mockContasBancarias.find(c => c.id === contaBancariaId);
    const cbNome = cb ? cb.nome : 'Conta Bancária';
    const saldoInicialExtratoCentavos = cb ? cb.saldoInicialCentavos : 0;

    // Movimentos no ERP
    let saldoMovimentosCentavos = 0;
    const movsConta = mockMovimentos.filter(m => m.contaBancariaId === contaBancariaId && !m.estornado);
    movsConta.forEach(m => {
      let tipo = 'P';
      for (const t of mockTitulos) {
        if (t.parcelas?.some(p => p.id === m.parcelaId)) {
          tipo = t.tipo;
          break;
        }
      }
      if (m.parcelaId === undefined) {
        saldoMovimentosCentavos += m.valorLiquidoCentavos;
      } else if (tipo === 'R') {
        saldoMovimentosCentavos += m.valorLiquidoCentavos;
      } else {
        saldoMovimentosCentavos -= m.valorLiquidoCentavos;
      }
    });

    const saldoContabilCentavos = saldoInicialExtratoCentavos + saldoMovimentosCentavos;

    // Extrato bancário
    const extratoConta = mockExtratoItems.filter(e => e.contaBancariaId === contaBancariaId);
    const somaCasadosCentavos = extratoConta
      .filter(e => e.status === 'conciliado')
      .reduce((sum, e) => sum + e.valorCentavos, 0);

    const saldoConciliadoCentavos = saldoInicialExtratoCentavos + somaCasadosCentavos;
    const diferencaCentavos = saldoContabilCentavos - saldoConciliadoCentavos;

    // Composição da diferença
    const soNoBancoItens = extratoConta.filter(e => e.status === 'nao_conciliado');
    const soNoBancoValorCentavos = soNoBancoItens.reduce((sum, e) => sum + e.valorCentavos, 0);

    const soNoSistemaItens = movsConta.filter(m => !m.conciliado);
    const soNoSistemaValorCentavos = soNoSistemaItens.reduce((sum, m) => sum + m.valorLiquidoCentavos, 0);

    const divergenciasItens = extratoConta.filter(e => e.status === 'divergente');
    const divergenciasValorCentavos = divergenciasItens.reduce((sum, e) => sum + e.valorCentavos, 0);

    // Lançamentos Nível 1 com 100% de confiança para auto-conciliação rápida
    const qtdNivel1Auto100Percent = extratoConta.filter(
      e => e.status === 'nao_conciliado' && (e.confiancaSugestao === 100 || e.nivelSugestao === 1)
    ).length;

    return {
      contaBancariaId,
      contaBancariaNome: cbNome,
      saldoInicialExtratoCentavos,
      saldoConciliadoCentavos,
      saldoContabilCentavos,
      diferencaCentavos,
      composicao: {
        soNoBancoCount: soNoBancoItens.length,
        soNoBancoValorCentavos,
        soNoSistemaCount: soNoSistemaItens.length,
        soNoSistemaValorCentavos,
        divergenciasCount: divergenciasItens.length,
        divergenciasValorCentavos
      },
      qtdNivel1Auto100Percent
    };
  }

  // MÉTODOS RETROCOMPATÍVEIS
  async importarExtratoOFX(
    contaBancariaId: string, 
    itens: Omit<ExtratoBancarioItem, 'id' | 'contaBancariaId' | 'status'>[]
  ): Promise<{ itensImportados: number; duplicadosIgnorados: number }> {
    const preview = await this.parseEPreviewOFX(contaBancariaId, '', 'extrato.ofx');
    await this.confirmarImportacaoOFX(contaBancariaId, preview);
    return { itensImportados: preview.qtdNovosImportar, duplicadosIgnorados: preview.qtdExistentesFitid };
  }

  async getExtratoBancario(
    contaBancariaId: string, 
    filtro?: { status?: StatusConciliacaoItem; dataDe?: string; dataAte?: string }
  ): Promise<ExtratoLancamento[]> {
    let list = mockExtratoItems.filter(e => e.contaBancariaId === contaBancariaId);
    if (filtro?.status) list = list.filter(e => e.status === filtro.status);
    if (filtro?.dataDe) list = list.filter(e => e.dataLancamento >= filtro.dataDe!);
    if (filtro?.dataAte) list = list.filter(e => e.dataLancamento <= filtro.dataAte!);
    list.sort((a, b) => b.dataLancamento.localeCompare(a.dataLancamento));
    return list;
  }

  async getResumoSaldosConciliacao(contaBancariaId: string): Promise<ResumoSaldosConciliacao> {
    const res9 = await this.getResumoSaldosConciliacaoEtapa9(contaBancariaId);
    return {
      contaBancariaId,
      contaBancariaNome: res9.contaBancariaNome,
      saldoContabilCentavos: res9.saldoContabilCentavos,
      saldoConciliadoCentavos: res9.saldoConciliadoCentavos,
      diferencaCentavos: res9.diferencaCentavos,
      qtdCasados: mockExtratoItems.filter(e => e.contaBancariaId === contaBancariaId && e.status === 'conciliado').length,
      qtdSoNoBanco: res9.composicao.soNoBancoCount,
      qtdSoNoSistema: res9.composicao.soNoSistemaCount,
      qtdDivergentes: res9.composicao.divergenciasCount
    };
  }

  async autoConciliarInteligente(contaBancariaId: string): Promise<{ conciliados: number }> {
    const res = await this.conciliarTodosNivel1_100Percent(contaBancariaId);
    return { conciliados: res.conciliacoesEfetuadas };
  }


  async conciliarManual(extratoItemId: string, movimentoId: string): Promise<void> {
    const item = mockExtratoItems.find(e => e.id === extratoItemId);
    const mov = mockMovimentos.find(m => m.id === movimentoId);

    if (!item) throw new Error('Lançamento do extrato não encontrado');
    if (!mov) throw new Error('Movimento do sistema não encontrado');

    const valAbsExtrato = Math.abs(item.valorCentavos);
    const isDivergente = mov.valorLiquidoCentavos !== valAbsExtrato;

    item.status = isDivergente ? 'divergente' : 'conciliado';
    item.movimentoId = mov.id;
    item.conciliadoEm = new Date().toISOString();
    item.conciliadoPor = 'Usuário (Manual)';

    mov.conciliado = true;
    mov.fitid = item.fitid;
    mov.extratoLancamentoId = item.id;
    mov.dataConciliacao = item.conciliadoEm;

    mockConciliacaoLogs.unshift({
      id: `log-${Date.now()}`,
      contaBancariaId: item.contaBancariaId,
      extratoItemId: item.id,
      movimentoId: mov.id,
      acao: 'conciliado_manual',
      motivo: isDivergente ? 'Conciliado manualmente com DIVERGÊNCIA de valor' : 'Conciliado manualmente pelo usuário',
      realizadoEm: new Date().toISOString(),
      realizadoPor: 'Usuário (Manual)'
    });
  }

  async desconciliar(extratoItemId: string, motivo = 'Desconciliado pelo usuário'): Promise<void> {
    const item = mockExtratoItems.find(e => e.id === extratoItemId);
    if (!item) throw new Error('Lançamento do extrato não encontrado');

    const oldMovId = item.movimentoId;
    if (oldMovId) {
      const mov = mockMovimentos.find(m => m.id === oldMovId);
      if (mov) {
        mov.conciliado = false;
        mov.fitid = undefined;
        mov.extratoLancamentoId = undefined;
        mov.dataConciliacao = undefined;
      }
    }

    item.status = 'nao_conciliado';
    item.movimentoId = undefined;
    item.conciliadoEm = undefined;
    item.conciliadoPor = undefined;

    mockConciliacaoLogs.unshift({
      id: `log-${Date.now()}`,
      contaBancariaId: item.contaBancariaId,
      extratoItemId: item.id,
      movimentoId: oldMovId,
      acao: 'desconciliado',
      motivo,
      realizadoEm: new Date().toISOString(),
      realizadoPor: 'Usuário (Manual)'
    });
  }

  async criarMovimentoAvulso(data: {
    contaBancariaId: string;
    dataPagamento: string;
    valorPagoCentavos: number;
    tipo: TipoTitulo;
    planoContaId: string;
    centroCustoId?: string;
    descricao: string;
    fitid?: string;
    extratoItemId?: string;
  }): Promise<Movimento> {
    const pc = mockPlanoContas.find(p => p.id === data.planoContaId);
    const cb = mockContasBancarias.find(c => c.id === data.contaBancariaId);

    const isDespesa = data.tipo === 'P';
    const valSignedCentavos = isDespesa ? -Math.abs(data.valorPagoCentavos) : Math.abs(data.valorPagoCentavos);

    const newMov: Movimento = {
      id: `mov-avulso-${Date.now()}`,
      parcelaId: undefined, // Sem parcela vinculada!
      planoContaId: data.planoContaId,
      centroCustoId: data.centroCustoId,
      tipoMovimento: 'avulso',
      dataPagamento: data.dataPagamento,
      valorPagoCentavos: Math.abs(data.valorPagoCentavos),
      jurosCentavos: 0,
      multaCentavos: 0,
      descontoCentavos: 0,
      valorLiquidoCentavos: valSignedCentavos,
      contaBancariaId: data.contaBancariaId,
      contaBancariaNome: cb?.nome,
      formaPagamento: 'pix',
      numeroDocumento: data.fitid || Date.now().toString().slice(-6),
      observacao: `Movimento Avulso (${pc?.nome || 'Sem Categoria'}): ${data.descricao}`,
      fitid: data.fitid,
      conciliado: true,
      dataConciliacao: new Date().toISOString(),
      extratoLancamentoId: data.extratoItemId,
      estornado: false,
      createdAt: new Date().toISOString()
    };

    mockMovimentos.unshift(newMov);

    if (data.extratoItemId) {
      const item = mockExtratoItems.find(e => e.id === data.extratoItemId);
      if (item) {
        item.status = 'conciliado';
        item.movimentoId = newMov.id;
        item.conciliadoEm = newMov.dataConciliacao;
        item.conciliadoPor = 'Usuário (Movimento Avulso)';
      }
    }

    mockConciliacaoLogs.unshift({
      id: `log-${Date.now()}`,
      contaBancariaId: data.contaBancariaId,
      extratoItemId: data.extratoItemId,
      movimentoId: newMov.id,
      acao: 'movimento_avulso_criado',
      motivo: `Criado movimento avulso sem parcela (${data.descricao})`,
      realizadoEm: new Date().toISOString(),
      realizadoPor: 'Usuário (Manual)'
    });

    return newMov;
  }

  async getLogsConciliacao(contaBancariaId?: string): Promise<ConciliacaoLog[]> {
    let list = [...mockConciliacaoLogs];
    if (contaBancariaId) list = list.filter(l => l.contaBancariaId === contaBancariaId);
    list.sort((a, b) => b.realizadoEm.localeCompare(a.realizadoEm));
    return list;
  }
}

// HELPER DE AJUSTE DE DIA ÚTIL E FERIADOS (REGRA DE OURO FERIADOS & FIM DE SEMANA)

function ajustarDiaUtilEFeriado(dataOriginal: Date, modoAjuste: AjusteDiaUtilRecorrencia, feriados: Feriado[]): Date {
  if (modoAjuste === 'nenhum') return new Date(dataOriginal);

  let cur = new Date(dataOriginal);
  const feriadosSet = new Set(feriados.map(f => f.data));

  function isInvalido(d: Date): boolean {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Dom ou Sáb
    const dateStr = d.toISOString().split('T')[0];
    const isHoliday = feriadosSet.has(dateStr);
    return isWeekend || isHoliday;
  }

  if (!isInvalido(cur)) return cur;

  const delta = modoAjuste === 'antecipa' ? -1 : 1;
  while (isInvalido(cur)) {
    cur.setDate(cur.getDate() + delta);
  }

  return cur;
}




/* ------------------------------------------------------------------
 * Snapshot / Hydrate do estado em memória
 *
 * Estas funções existem apenas para a camada de persistência local
 * (src/data/persistence/local-storage.repository.ts) e são DESCARTÁVEIS
 * no Passo 4 (Supabase), junto com aquela pasta.
 *
 * Precisam morar neste arquivo porque os métodos de exclusão REATRIBUEM
 * as bindings do módulo (ex.: `mockContasPagar = mockContasPagar.filter(...)`),
 * e ES Modules não permitem atribuir a uma binding importada de fora.
 * ------------------------------------------------------------------ */

export interface MockStateSnapshot {
  feriados: Feriado[];
  recorrencias: Recorrencia[];
  recorrenciaOcorrencias: RecorrenciaOcorrencia[];
  recorrenciaReajustes: RecorrenciaReajuste[];
  recorrenciaLogs: LogExecucaoFila[];
  orcamentosEmpreendimento: Orcamento[];
  planoContas: PlanoConta[];
  centrosCusto: CentroCusto[];
  pessoas: Pessoa[];
  gruposGestao: GrupoGestao[];
  linhasGestao: LinhaGestao[];
  contasBancarias: ContaBancaria[];
  extratoImportacoes: ExtratoImportacao[];
  conciliacaoRegras: ConciliacaoRegra[];
  extratoItems: ExtratoLancamento[];
  conciliacaoLogs: ConciliacaoLog[];
  subempresas: Subempresa[];
  gruposLinhaCusto: GrupoLinhaCusto[];
  linhasCusto: LinhaCusto[];
  contasPagar: ContaPagar[];
  contasReceber: ContaReceber[];
  orcamentos: OrcamentoDAV[];
  titulos: Titulo[];
  movimentos: Movimento[];
  nextTituloSeq: number;
}

export function snapshotMockState(): MockStateSnapshot {
  return {
    feriados: mockFeriados,
    recorrencias: mockRecorrencias,
    recorrenciaOcorrencias: mockRecorrenciaOcorrencias,
    recorrenciaReajustes: mockRecorrenciaReajustes,
    recorrenciaLogs: mockRecorrenciaLogs,
    orcamentosEmpreendimento: mockOrcamentosEmpreendimento,
    planoContas: mockPlanoContas,
    centrosCusto: mockCentrosCusto,
    pessoas: mockPessoas,
    gruposGestao: mockGruposGestao,
    linhasGestao: mockLinhasGestao,
    contasBancarias: mockContasBancarias,
    extratoImportacoes: mockExtratoImportacoes,
    conciliacaoRegras: mockConciliacaoRegras,
    extratoItems: mockExtratoItems,
    conciliacaoLogs: mockConciliacaoLogs,
    subempresas: mockSubempresas,
    gruposLinhaCusto: mockGruposLinhaCusto,
    linhasCusto: mockLinhasCusto,
    contasPagar: mockContasPagar,
    contasReceber: mockContasReceber,
    orcamentos: mockOrcamentos,
    titulos: mockTitulos,
    movimentos: mockMovimentos,
    nextTituloSeq: nextTituloSeqCounter,
  };
}

/**
 * Repõe o estado a partir de um snapshot.
 * Cada chave usa `?? valorAtual` para que um snapshot gravado por uma versão
 * anterior (sem aquela chave) mantenha o seed em vez de zerar o array.
 */
export function hydrateMockState(s: Partial<MockStateSnapshot>): void {
  mockFeriados = s.feriados ?? mockFeriados;
  mockRecorrencias = s.recorrencias ?? mockRecorrencias;
  mockRecorrenciaOcorrencias = s.recorrenciaOcorrencias ?? mockRecorrenciaOcorrencias;
  mockRecorrenciaReajustes = s.recorrenciaReajustes ?? mockRecorrenciaReajustes;
  mockRecorrenciaLogs = s.recorrenciaLogs ?? mockRecorrenciaLogs;
  mockOrcamentosEmpreendimento = s.orcamentosEmpreendimento ?? mockOrcamentosEmpreendimento;
  mockPlanoContas = s.planoContas ?? mockPlanoContas;
  mockCentrosCusto = s.centrosCusto ?? mockCentrosCusto;
  mockPessoas = s.pessoas ?? mockPessoas;
  mockGruposGestao = s.gruposGestao ?? mockGruposGestao;
  mockLinhasGestao = s.linhasGestao ?? mockLinhasGestao;
  mockContasBancarias = s.contasBancarias ?? mockContasBancarias;
  mockExtratoImportacoes = s.extratoImportacoes ?? mockExtratoImportacoes;
  mockConciliacaoRegras = s.conciliacaoRegras ?? mockConciliacaoRegras;
  mockExtratoItems = s.extratoItems ?? mockExtratoItems;
  mockConciliacaoLogs = s.conciliacaoLogs ?? mockConciliacaoLogs;
  mockSubempresas = s.subempresas ?? mockSubempresas;
  mockGruposLinhaCusto = s.gruposLinhaCusto ?? mockGruposLinhaCusto;
  mockLinhasCusto = s.linhasCusto ?? mockLinhasCusto;
  mockContasPagar = s.contasPagar ?? mockContasPagar;
  mockContasReceber = s.contasReceber ?? mockContasReceber;
  mockOrcamentos = s.orcamentos ?? mockOrcamentos;
  mockTitulos = s.titulos ?? mockTitulos;
  mockMovimentos = s.movimentos ?? mockMovimentos;
  // O contador é estado tanto quanto os arrays: sem ele, todo reload
  // reinicia em 10010 e os códigos de título passam a colidir.
  nextTituloSeqCounter = s.nextTituloSeq ?? nextTituloSeqCounter;
}

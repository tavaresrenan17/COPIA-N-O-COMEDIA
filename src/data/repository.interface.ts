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
  Movimento,
  ParcelaView,
  TipoTitulo,
  StatusParcela,
  FormaPagamentoMovimento,
  FiltroFluxoCaixa,
  FluxoCaixaResultado,
  FiltroDashboard,
  DashboardExecutiveData,
  Cliente, 
  Fornecedor, 
  ContaPagar, 
  ContaReceber, 
  OrcamentoDAV, 
  DashboardMetrics,
  OrcamentoEmpreendimento,
  OrcamentoExecucaoView,
  Orcamento,
  OrcamentoItem,
  OrcamentoItemPeriodo,
  DisponibilidadeOrcamentariaResultado,
  Recorrencia,
  StatusRecorrencia,
  GeracaoRetroativaSimulacaoResultado,
  ProximaOcorrenciaPrevia,
  RecorrenciaOcorrencia,
  RecorrenciaReajuste,
  LogExecucaoFila,
  Feriado,
  StatusConciliacaoItem,
  ExtratoBancarioItem,
  ResumoSaldosConciliacao,
  ConciliacaoLog,
  PreviewImportacaoOFX,
  ExtratoImportacao,
  ConciliacaoRegra,
  SugestaoCasamento,
  ResumoSaldosConciliacaoEtapa9
} from './types';

/**
 * Payload completo de um título — usado tanto na inclusão quanto na alteração,
 * para que os dois caminhos não saiam de sincronia.
 */
export interface TituloInput {
  tipo: TipoTitulo;
  pessoaId: string;
  pessoaNome?: string;
  subempresaId?: string;
  grupoLinhaCustoId?: string;
  linhaCustoId?: string;
  grupoGestaoId?: string;
  linhaGestaoId?: string;
  planoContaId: string;
  numeroDocumento?: string;
  serie?: string;
  dataEmissao: string;
  dataCompetencia: string;
  valorBrutoCentavos: number;
  qtdParcelas: number;
  descricao?: string;
  observacao?: string;
  usuario?: string;
  /** Rateio gerencial por grupo/linha de gestão; deve somar 100%. */
  rateiosGestao?: {
    grupoGestaoId: string;
    linhaGestaoId?: string;
    percentual: number;
    valorCentavos: number;
  }[];
  parcelas: {
    numero: number;
    dataVencimento: string;
    valorCentavos: number;
    observacao?: string;
    rateios: {
      /** Unidade Construtiva (ou a própria obra, quando ela não tem unidades). */
      centroCustoId: string;
      /** Item de orçamento apropriado nesta linha. */
      orcamentoItemId?: string;
      /** Plano de contas específico da linha de rateio; sem ele, herda o do título. */
      planoContaId?: string;
      percentual: number;
      valorCentavos: number;
    }[];
  }[];
}

export interface FiltroParcelas {
  apenasAtivos?: boolean;
  dataVencimentoDe?: string;
  dataVencimentoAte?: string;
  pessoaId?: string;
  subempresaId?: string;
  grupoLinhaCustoId?: string;
  linhaCustoId?: string;
  grupoGestaoId?: string;
  linhaGestaoId?: string;
  status?: StatusParcela;
  centroCustoId?: string;
  planoContaId?: string;
  searchTerm?: string;
}

export interface IErpRepository {
  // 1. PESSOA
  getPessoas(filtro?: { apenasAtivos?: boolean; apenasClientes?: boolean; apenasFornecedores?: boolean }): Promise<Pessoa[]>;
  getPessoaById(id: string): Promise<Pessoa | null>;
  createPessoa(data: Omit<Pessoa, 'id' | 'createdAt' | 'updatedAt'>): Promise<Pessoa>;
  updatePessoa(id: string, data: Partial<Pessoa>): Promise<Pessoa>;
  deletePessoa(id: string): Promise<boolean>;

  // 2. PLANO DE CONTAS
  getPlanoContas(filtro?: { apenasAtivos?: boolean }): Promise<PlanoConta[]>;
  /** `natureza` aceita uma ou várias — títulos a pagar usam três (custo/despesa/investimento). */
  getPlanoContasFolhas(natureza?: string | string[]): Promise<PlanoConta[]>;
  getPlanoContaById(id: string): Promise<PlanoConta | null>;
  createPlanoConta(data: Omit<PlanoConta, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlanoConta>;
  updatePlanoConta(id: string, data: Partial<PlanoConta>): Promise<PlanoConta>;
  deletePlanoConta(id: string): Promise<boolean>;

  // 3. CENTRO DE CUSTOS
  getCentrosCusto(filtro?: { apenasAtivos?: boolean; subempresaId?: string }): Promise<CentroCusto[]>;
  getCentroCustosFolhas(subempresaId?: string): Promise<CentroCusto[]>;
  getCentroCustoById(id: string): Promise<CentroCusto | null>;
  createCentroCusto(data: Omit<CentroCusto, 'id' | 'createdAt' | 'updatedAt' | 'gastoCentavos'>): Promise<CentroCusto>;
  updateCentroCusto(id: string, data: Partial<CentroCusto>): Promise<CentroCusto>;
  deleteCentroCusto(id: string): Promise<boolean>;

  // 4. CONTA BANCÁRIA
  getContasBancarias(filtro?: { apenasAtivos?: boolean }): Promise<ContaBancaria[]>;
  getContaBancariaById(id: string): Promise<ContaBancaria | null>;
  createContaBancaria(data: Omit<ContaBancaria, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContaBancaria>;
  updateContaBancaria(id: string, data: Partial<ContaBancaria>): Promise<ContaBancaria>;
  deleteContaBancaria(id: string): Promise<boolean>;

  // 4.1 SUBEMPRESA (UNIDADES / FILIAIS)
  getSubempresas(filtro?: { apenasAtivos?: boolean }): Promise<Subempresa[]>;
  getSubempresaById(id: string): Promise<Subempresa | null>;
  createSubempresa(data: Omit<Subempresa, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subempresa>;
  updateSubempresa(id: string, data: Partial<Subempresa>): Promise<Subempresa>;
  deleteSubempresa(id: string): Promise<boolean>;

  // 4.2 GRUPO DE LINHA DE CUSTO
  getGruposLinhaCusto(subempresaId?: string, filtro?: { apenasAtivos?: boolean }): Promise<GrupoLinhaCusto[]>;
  createGrupoLinhaCusto(data: Omit<GrupoLinhaCusto, 'id' | 'createdAt' | 'updatedAt'>): Promise<GrupoLinhaCusto>;
  updateGrupoLinhaCusto(id: string, data: Partial<GrupoLinhaCusto>): Promise<GrupoLinhaCusto>;
  deleteGrupoLinhaCusto(id: string): Promise<boolean>;

  // 4.3 LINHA DE CUSTO
  getLinhasCusto(grupoLinhaCustoId?: string, filtro?: { apenasAtivos?: boolean }): Promise<LinhaCusto[]>;
  createLinhaCusto(data: Omit<LinhaCusto, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinhaCusto>;
  updateLinhaCusto(id: string, data: Partial<LinhaCusto>): Promise<LinhaCusto>;
  deleteLinhaCusto(id: string): Promise<boolean>;

  // 4.4 GRUPO DE GESTÃO
  getGruposGestao(filtro?: { apenasAtivos?: boolean }): Promise<GrupoGestao[]>;
  getGrupoGestaoById(id: string): Promise<GrupoGestao | null>;
  createGrupoGestao(data: Omit<GrupoGestao, 'id' | 'createdAt' | 'updatedAt'>): Promise<GrupoGestao>;
  updateGrupoGestao(id: string, data: Partial<GrupoGestao>): Promise<GrupoGestao>;
  deleteGrupoGestao(id: string): Promise<boolean>;

  // 4.5 LINHA DE GESTÃO
  getLinhasGestao(grupoGestaoId?: string, filtro?: { apenasAtivos?: boolean }): Promise<LinhaGestao[]>;
  getLinhaGestaoById(id: string): Promise<LinhaGestao | null>;
  createLinhaGestao(data: Omit<LinhaGestao, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinhaGestao>;
  updateLinhaGestao(id: string, data: Partial<LinhaGestao>): Promise<LinhaGestao>;
  deleteLinhaGestao(id: string): Promise<boolean>;

  // 5. MOTOR UNIFICADO DE TÍTULOS E PARCELAS
  createTitulo(data: TituloInput): Promise<Titulo>;

  /**
   * Regrava o título por completo (dados + parcelas + rateios).
   * Rejeita se alguma parcela já tiver baixa não estornada.
   */
  updateTitulo(id: string, data: TituloInput): Promise<Titulo>;

  /**
   * Desativa o título e suas parcelas.
   * Rejeita se alguma parcela já tiver baixa não estornada.
   */
  deleteTitulo(id: string): Promise<boolean>;

  getParcelasView(tipo: TipoTitulo, filtro?: FiltroParcelas): Promise<ParcelaView[]>;
  getTitulos(): Promise<Titulo[]>;
  getTituloById(id: string): Promise<Titulo | null>;


  // 6. CAIXA & MOVIMENTOS
  createMovimento(data: {
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
    /** Operador logado — grava em movimento.created_by. */
    usuario?: string;
  }): Promise<Movimento>;

  createBaixaEmLote(data: {
    parcelaIds: string[];
    dataPagamento: string;
    contaBancariaId: string;
    formaPagamento: FormaPagamentoMovimento;
    usuario?: string;
  }): Promise<Movimento[]>;

  estornarMovimento(movimentoId: string, motivo: string, usuario?: string): Promise<Movimento>;
  getMovimentosPorParcela(parcelaId: string): Promise<Movimento[]>;

  // 7. FLUXO DE CAIXA (ETAPA 4)
  getFluxoCaixa(filtro: FiltroFluxoCaixa): Promise<FluxoCaixaResultado>;

  // 8. DASHBOARD EXECUTIVO (ETAPA 5)
  getDashboardExecutiveData(filtro: FiltroDashboard): Promise<DashboardExecutiveData>;

  // 9. CADASTRO E ESTRUTURA DO ORÇAMENTO (ETAPA 6)
  getOrcamentos(filtro?: { centroCustoId?: string; status?: string; dataInicioDe?: string; dataFimAte?: string }): Promise<Orcamento[]>;
  getOrcamentoById(id: string): Promise<Orcamento | null>;
  createOrcamento(data: {
    centroCustoId: string;
    nome: string;
    dataInicio: string;
    dataFim: string;
    observacao?: string;
    itens: {
      codigo?: string;
      planoContaId: string;
      /** Unidade Construtiva do item (nó filho da obra). */
      centroCustoId?: string;
      descricao?: string;
      quantidade?: number;
      unidade?: string;
      valorUnitarioCentavos?: number;
      valorTotalCentavos: number;
      periodos: { mesReferencia: string; valorCentavos: number }[];
    }[];
  }): Promise<Orcamento>;
  updateOrcamento(id: string, data: {
    nome?: string;
    observacao?: string;
    itens?: {
      id?: string;
      codigo?: string;
      planoContaId: string;
      /** Unidade Construtiva do item (nó filho da obra). */
      centroCustoId?: string;
      descricao?: string;
      quantidade?: number;
      unidade?: string;
      valorUnitarioCentavos?: number;
      valorTotalCentavos: number;
      periodos: { mesReferencia: string; valorCentavos: number }[];
    }[];
  }): Promise<Orcamento>;
  aprovarOrcamento(id: string, usuario?: string): Promise<Orcamento>;
  criarRevisaoOrcamento(id: string, motivoRevisao: string, usuario?: string): Promise<Orcamento>;

  // Métodos retrocompatíveis de orçamentos
  getOrcamentosEmpreendimento(filtro?: { centroCustoId?: string; apenasVigentes?: boolean }): Promise<OrcamentoEmpreendimento[]>;
  createOrcamentoEmpreendimento(data: {
    centroCustoId: string;
    descricao: string;
    dataInicio: string;
    dataFim: string;
    itens: {
      planoContaNivel2Id: string;
      distribuicaoMensal: Record<string, number>;
    }[];
  }): Promise<OrcamentoEmpreendimento>;
  updateOrcamentoEmpreendimento(id: string, data: Partial<OrcamentoEmpreendimento>): Promise<OrcamentoEmpreendimento>;
  aprovarOrcamentoEmpreendimento(id: string, usuario?: string): Promise<OrcamentoEmpreendimento>;
  getOrcamentoExecucao(orcamentoId: string, dataCorte?: string): Promise<OrcamentoExecucaoView>;
  validarDisponibilidadeOrcamentaria(centroCustoId: string, planoContaId: string, valorCentavos: number): Promise<DisponibilidadeOrcamentariaResultado>;

  // 10. GESTÃO & GERADOR DE RECORRÊNCIAS (ETAPA 8)
  getRecorrencias(filtro?: { tipo?: TipoTitulo; status?: StatusRecorrencia; pessoaId?: string; frequencia?: string }): Promise<Recorrencia[]>;
  getRecorrenciaById(id: string): Promise<Recorrencia | null>;
  createRecorrencia(data: Omit<Recorrencia, 'id' | 'createdAt' | 'proximaCompetencia'>): Promise<Recorrencia>;
  updateRecorrencia(id: string, data: Partial<Recorrencia>): Promise<Recorrencia>;
  pausarRecorrencia(id: string): Promise<Recorrencia>;
  reativarRecorrencia(id: string): Promise<Recorrencia>;
  encerrarRecorrencia(id: string): Promise<Recorrencia>;

  // Motor Backend Etapa 8
  calcularProximasOcorrencias(recorrencia: Partial<Recorrencia>, qtd?: number): Promise<ProximaOcorrenciaPrevia[]>;
  gerarOcorrencia(recorrenciaId: string, competencia: string, origem: 'automatico' | 'manual', motivo?: string): Promise<{ status: 'gerado' | 'ja_gerado' | 'erro'; titulo?: Titulo }>;
  processarFila(dataReferencia?: string): Promise<LogExecucaoFila>;
  pularOcorrencia(recorrenciaId: string, competencia: string, motivo: string): Promise<RecorrenciaOcorrencia>;
  preencherValorTituloVariavel(tituloId: string, valorBrutoCentavos: number): Promise<Titulo>;
  aplicarReajusteEmLote(recorrenciaIds: string[], percentual: number, indice?: string, observacao?: string): Promise<RecorrenciaReajuste[]>;

  // Consultas de Auditoria e Fila
  getOcorrenciasByRecorrencia(recorrenciaId: string): Promise<RecorrenciaOcorrencia[]>;
  getReajustesByRecorrencia(recorrenciaId: string): Promise<RecorrenciaReajuste[]>;
  getLogsExecucaoFila(): Promise<LogExecucaoFila[]>;
  getFeriados(): Promise<Feriado[]>;

  // 11. CONCILIAÇÃO BANCÁRIA (ETAPA 9 COMPLETA)
  parseEPreviewOFX(contaBancariaId: string, conteudoOFXText: string, arquivoNome: string): Promise<PreviewImportacaoOFX>;
  confirmarImportacaoOFX(contaBancariaId: string, preview: PreviewImportacaoOFX): Promise<ExtratoImportacao>;
  
  executarMotorCasamento(contaBancariaId: string): Promise<{ sugestoes: SugestaoCasamento[]; qtdAutoConciliadosNivel1: number }>;
  conciliarTodosNivel1_100Percent(contaBancariaId: string): Promise<{ conciliacoesEfetuadas: number }>;

  conciliarAgrupados(extratoLancamentoId: string, movimentoIds: string[]): Promise<void>;
  ignorarLancamentoExtrato(extratoLancamentoId: string, motivo: string): Promise<void>;

  criarRegraConciliacao(data: Omit<ConciliacaoRegra, 'id' | 'vezesAplicada' | 'createdAt'>): Promise<ConciliacaoRegra>;
  getRegrasConciliacao(contaBancariaId?: string): Promise<ConciliacaoRegra[]>;
  getResumoSaldosConciliacaoEtapa9(contaBancariaId: string): Promise<ResumoSaldosConciliacaoEtapa9>;

  importarExtratoOFX(
    contaBancariaId: string, 
    itens: Omit<ExtratoBancarioItem, 'id' | 'contaBancariaId' | 'status'>[]
  ): Promise<{ itensImportados: number; duplicadosIgnorados: number }>;
  
  getExtratoBancario(
    contaBancariaId: string, 
    filtro?: { status?: StatusConciliacaoItem; dataDe?: string; dataAte?: string }
  ): Promise<ExtratoBancarioItem[]>;

  getResumoSaldosConciliacao(contaBancariaId: string): Promise<ResumoSaldosConciliacao>;
  autoConciliarInteligente(contaBancariaId: string): Promise<{ conciliados: number }>;
  conciliarManual(extratoItemId: string, movimentoId: string): Promise<void>;
  desconciliar(extratoItemId: string, motivo?: string): Promise<void>;

  criarMovimentoAvulso(data: {
    contaBancariaId: string;
    dataPagamento: string;
    valorPagoCentavos: number;
    tipo: TipoTitulo;
    planoContaId: string;
    centroCustoId?: string;
    descricao: string;
    fitid?: string;
    extratoItemId?: string;
  }): Promise<Movimento>;

  getLogsConciliacao(contaBancariaId?: string): Promise<ConciliacaoLog[]>;


  // Métodos de Geração Retroativa
  simularGeracaoRetroativa(recorrenciaId?: string, ateData?: string): Promise<GeracaoRetroativaSimulacaoResultado>;
  gerarTitulosRecorrentes(recorrenciaId?: string, ateData?: string): Promise<{ titulosGerados: Titulo[]; qtdGerados: number; valorTotalCentavos: number }>;







  // Retrocompatibilidade

  getClientes(): Promise<Cliente[]>;
  createCliente(data: Omit<Cliente, 'id' | 'criadoEm'>): Promise<Cliente>;
  updateCliente(id: string, data: Partial<Omit<Cliente, 'id' | 'criadoEm'>>): Promise<Cliente>;
  deleteCliente(id: string): Promise<boolean>;
  getFornecedores(): Promise<Fornecedor[]>;
  createFornecedor(data: Omit<Fornecedor, 'id' | 'criadoEm'>): Promise<Fornecedor>;
  updateFornecedor(id: string, data: Partial<Omit<Fornecedor, 'id' | 'criadoEm'>>): Promise<Fornecedor>;
  deleteFornecedor(id: string): Promise<boolean>;

  getContasPagar(): Promise<ContaPagar[]>;
  createContaPagar(data: Omit<ContaPagar, 'id'>): Promise<ContaPagar>;
  updateContaPagar(id: string, data: Partial<ContaPagar>): Promise<ContaPagar>;
  deleteContaPagar(id: string): Promise<boolean>;

  getContasReceber(): Promise<ContaReceber[]>;
  createContaReceber(data: Omit<ContaReceber, 'id'>): Promise<ContaReceber>;
  updateContaReceber(id: string, data: Partial<ContaReceber>): Promise<ContaReceber>;
  deleteContaReceber(id: string): Promise<boolean>;

  getOrcamentosDAV(): Promise<OrcamentoDAV[]>;
  createOrcamentoDAV(data: Omit<OrcamentoDAV, 'id'>): Promise<OrcamentoDAV>;
  updateOrcamentoDAV(id: string, data: Partial<OrcamentoDAV>): Promise<OrcamentoDAV>;
  deleteOrcamentoDAV(id: string): Promise<boolean>;


  getDashboardMetrics(): Promise<DashboardMetrics>;
}

export type StatusOrcamento = 'FATURADO' | 'EXPEDIDO' | 'ENTREGUE' | 'RECEBIDO';
export type FormaPagamento = 'PIX' | 'BOLETO' | 'TRANSFERENCIA' | 'DINHEIRO' | 'CARTAO';
export type FormaPagamentoMovimento = 'dinheiro' | 'pix' | 'ted' | 'boleto' | 'cartao' | 'cheque' | 'permuta';
export type NaturezaPlanoConta = 'receita' | 'custo' | 'despesa' | 'investimento';
export type TipoCentroCusto = 'obra' | 'administrativo' | 'frota' | 'comercial';
export type TipoContaBancaria = 'corrente' | 'poupanca' | 'caixa' | 'aplicacao';
export type TipoPessoa = 'F' | 'J';
export type TipoTitulo = 'P' | 'R';
export type StatusParcela = 'aberto' | 'parcial' | 'pago' | 'vencido' | 'cancelado';

export type CamadaFluxoCaixa = 'realizado' | 'previsto' | 'ambos';
export type AgrupamentoFluxoCaixa = 'dia' | 'semana' | 'mes';

/**
 * 1. DIMENSÃO: PLANO DE CONTAS
 */
export interface PlanoConta {
  id: string;
  codigo: string;
  nome: string;
  parentId?: string | null;
  natureza: NaturezaPlanoConta;
  nivel: number;
  aceitaLancamento: boolean;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
  filhos?: PlanoConta[];
}

/**
 * 2. DIMENSÃO: CENTRO DE CUSTOS
 */
export interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  /**
   * Linha de Gestão a que este centro de custo pertence.
   *
   * É este vínculo que a Apropriação usa: alocar uma linha no título faz
   * aparecer as obras (orçamentos) dos centros de custo dela. Antes o vínculo
   * morava do outro lado, em `linha_gestao.centro_custo_id`, que é 1:1 — o
   * segundo centro de custo ligado à mesma linha roubava o vínculo do primeiro.
   * Opcional porque centro de custo sem linha continua válido; ele só não
   * contribui com obra nenhuma para a Apropriação.
   */
  linhaGestaoId?: string | null;
  /** Só para exibir — não é gravado. */
  linhaGestaoNome?: string;
  parentId?: string | null;
  tipo: TipoCentroCusto;
  nivel: number;
  aceitaLancamento: boolean;
  dataInicio?: string | null;
  dataFim?: string | null;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
  filhos?: CentroCusto[];
  orcamentoCentavos?: number;
  gastoCentavos?: number;
  subempresaId?: string;
  subempresaNome?: string;
}

/**
 * 3. DIMENSÃO: PESSOA
 */
export interface Pessoa {
  id: string;
  cpfCnpj: string;
  tipoPessoa: TipoPessoa;
  nome: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  /** Aniversário (AAAA-MM-DD) — alimenta os "aniversários próximos" da Home. */
  dataNascimento?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  isCliente: boolean;
  isFornecedor: boolean;
  /** Categoria de insumo do fornecedor (exibida e pesquisável na tela de Fornecedores). */
  categoriaFornecedor?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  chavePix?: string;
  planoContaPadraoId?: string;
  condicaoPagamentoPadrao?: number;
  observacao?: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 4. DIMENSÃO: CONTA BANCÁRIA
 */
export interface ContaBancaria {
  id: string;
  nome: string;
  tipo: TipoContaBancaria;
  banco?: string;
  agencia?: string;
  conta?: string;
  saldoInicialCentavos: number;
  dataSaldoInicial: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 4.1 DIMENSÃO: SUBEMPRESA (UNIDADES / FILIAIS / SPEs)
 */
export interface Subempresa {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 4.2 DIMENSÃO: GRUPO DE LINHA DE CUSTO
 */
export interface GrupoLinhaCusto {
  id: string;
  subempresaId: string;
  subempresaNome?: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 4.3 DIMENSÃO: LINHA DE CUSTO
 */
export interface LinhaCusto {
  id: string;
  grupoLinhaCustoId: string;
  grupoLinhaCustoNome?: string;
  centroCustoId?: string; // Alinhado ao Centro de Custo
  centroCustoCodigo?: string;
  centroCustoNome?: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 4.4 DIMENSÃO: GRUPO DE GESTÃO
 */
export interface GrupoGestao {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 4.5 DIMENSÃO: LINHA DE GESTÃO
 */
export interface LinhaGestao {
  id: string;
  grupoGestaoId: string;
  grupoGestaoNome?: string;
  /**
   * Obra vinculada (nó raiz de centro_custo). É este vínculo que alimenta a aba
   * Apropriação: ela só oferece as obras das linhas de gestão alocadas no título.
   * Opcional porque as linhas cadastradas antes da migration 09 não têm obra.
   */
  centroCustoId?: string;
  centroCustoCodigo?: string;
  centroCustoNome?: string;
  codigo: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 5. DOCUMENTO: TITULO RATEIO
 */
export interface TituloRateio {
  id?: string;
  /**
   * Destino do lançamento: a Unidade Construtiva (nó filho da obra) ou, quando a
   * obra não tem unidades, a própria obra. A coluna do banco continua se
   * chamando centro_custo_id.
   */
  centroCustoId: string;
  centroCustoCodigo?: string;
  centroCustoNome?: string;
  /** Obra do lançamento (pai da unidade construtiva). Só orienta a tela. */
  obraId?: string;
  obraNome?: string;
  /** Item de orçamento apropriado — a 3ª coluna da aba Apropriação. */
  orcamentoItemId?: string;
  orcamentoItemCodigo?: string;
  orcamentoItemDescricao?: string;
  /** Derivado do item de orçamento; mantém DRE, dashboard e BI funcionando. */
  planoContaId?: string;
  planoContaCodigo?: string;
  planoContaNome?: string;
  percentual: number;
  valorCentavos: number;
  ativo?: boolean;
  rateios?: TituloRateio[];
}

/**
 * 5.1 DOCUMENTO: RATEIO GERENCIAL DO TÍTULO (GRUPO / LINHA DE GESTÃO)
 *
 * Eixo paralelo ao rateio por centro de custo: ambos repartem 100% do título,
 * cada um sobre uma dimensão de análise. É por título, não por parcela.
 */
export interface TituloRateioGestao {
  id?: string;
  grupoGestaoId: string;
  grupoGestaoNome?: string;
  linhaGestaoId?: string;
  linhaGestaoNome?: string;
  percentual: number;
  valorCentavos: number;
}

/**
 * 6. DOCUMENTO: TITULO PARCELA
 */
export interface TituloParcela {
  id?: string;
  tituloId?: string;
  numero: number;
  dataVencimento: string;
  valorCentavos: number;
  observacao?: string;
  ativo?: boolean;
  rateios?: TituloRateio[];
}

export interface TituloAuditLog {
  id: string;
  dataHora: string; // ISO String ou Data/Hora formatada
  usuario: string;
  acao: 'criacao' | 'edicao' | 'baixa' | 'estorno' | 'cancelamento';
  descricao: string;
  detalhes?: string;
}

/**
 * 7. DOCUMENTO: TITULO
 */
export interface Titulo {
  id: string;
  codigo: string; // Código único sequencial crescente, apenas números (ex: 010001)
  tipo: TipoTitulo;
  pessoaId: string;
  pessoaNome?: string;
  subempresaId?: string;
  subempresaNome?: string;
  grupoLinhaCustoId?: string;
  grupoLinhaCustoNome?: string;
  linhaCustoId?: string;
  linhaCustoNome?: string;
  grupoGestaoId?: string;
  grupoGestaoNome?: string;
  linhaGestaoId?: string;
  linhaGestaoNome?: string;
  planoContaId: string;
  planoContaNome?: string;
  numeroDocumento?: string;
  serie?: string;
  dataEmissao: string;
  dataCompetencia: string;
  valorBrutoCentavos: number;
  qtdParcelas: number;
  descricao?: string;
  observacao?: string;
  ativo: boolean;
  recorrenciaId?: string;
  recorrenciaPeriodo?: string;
  aguardandoValor?: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  logsAudit?: TituloAuditLog[];
  parcelas?: TituloParcela[];
  rateiosGestao?: TituloRateioGestao[];
}

/**
 * 8. CAIXA: MOVIMENTO (Baixa Efetiva de Parcela)
 */
export interface Movimento {
  id: string;
  parcelaId?: string; // Opcional para Movimentos Avulsos (Tarifas, IOF, Rendimentos, Transferências)
  planoContaId?: string; // Usado quando parcelaId for null
  centroCustoId?: string; // Usado quando parcelaId for null
  tipoMovimento?: 'baixa_titulo' | 'avulso' | 'transferencia';
  dataPagamento: string;
  valorPagoCentavos: number;
  jurosCentavos: number;
  multaCentavos: number;
  descontoCentavos: number;
  valorLiquidoCentavos: number;
  contaBancariaId: string;
  contaBancariaNome?: string;
  formaPagamento: FormaPagamentoMovimento;
  numeroDocumento?: string;
  observacao?: string;
  fitid?: string;
  conciliado?: boolean;
  dataConciliacao?: string;
  extratoLancamentoId?: string;
  estornado: boolean;
  estornadoEm?: string;
  estornadoPor?: string;
  motivoEstorno?: string;
  createdAt?: string;
  createdBy?: string;
}

/**
 * VIEW DE LISTAGEM DENORMALIZADA POR VENCIMENTO (PARCELA)
 */
export interface ParcelaView {
  parcelaId: string;
  tituloId: string;
  tituloCodigo: string; // Código único do título, apenas números (ex: 010001)
  tipo: TipoTitulo;
  pessoaId: string;
  pessoaNome: string;
  pessoaCpfCnpj: string;
  subempresaId?: string;
  subempresaNome?: string;
  grupoLinhaCustoNome?: string;
  linhaCustoNome?: string;
  grupoGestaoId?: string;
  grupoGestaoNome?: string;
  linhaGestaoId?: string;
  linhaGestaoNome?: string;
  planoContaId: string;
  planoContaCodigo: string;
  planoContaNome: string;
  planoContaNatureza?: NaturezaPlanoConta;
  numeroDocumento?: string;
  serie?: string;
  descricao?: string;
  dataEmissao: string;
  dataCompetencia: string;
  parcelaNumero: number;
  qtdParcelas: number;
  dataVencimento: string;
  valorCentavos: number;
  valorBaixadoCentavos: number;
  saldoCentavos: number;
  status: StatusParcela;
  diasAtraso: number;
  centrosCustoFormatado: string;
  ativo: boolean;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  logsAudit?: TituloAuditLog[];
}

/**
 * MÓDULO DE FLUXO DE CAIXA (ETAPA 4)
 */
export interface FiltroFluxoCaixa {
  dataDe: string;
  dataAte: string;
  agrupamento: AgrupamentoFluxoCaixa;
  camada: CamadaFluxoCaixa;
  contaBancariaId?: string;
  centroCustoId?: string;
}

export interface FluxoCaixaLancamento {
  id: string;
  data: string;
  tipo: TipoTitulo;
  descricao: string;
  pessoaNome: string;
  centroCustoNome: string;
  valorCentavos: number;
  camada: 'realizado' | 'previsto';
  parcelaId?: string;
  numeroDocumento?: string;
}

export interface FluxoCaixaBucket {
  periodoRotulo: string;
  dataInicioPeriodo: string;
  saldoInicialCentavos: number;
  entradasCentavos: number;
  saidasCentavos: number;
  resultadoCentavos: number;
  saldoFinalCentavos: number;
  isFuroCaixa: boolean;
  lancamentos: FluxoCaixaLancamento[];
}

export interface FluxoCaixaResultado {
  saldoHojeCentavos: number;
  totalEntradasPrevistasCentavos: number;
  totalSaidasPrevistasCentavos: number;
  menorSaldoProjetadoCentavos: number;
  dataMenorSaldoProjetado: string | null;
  primeiraDataFuroCaixa: string | null;
  buckets: FluxoCaixaBucket[];
}

/**
 * MÓDULO DE DASHBOARD EXECUTIVO (ETAPA 5)
 */
export interface FiltroDashboard {
  dataDe: string;
  dataAte: string;
  centroCustoId?: string;
}

export interface VencidosSummary {
  totalReceberVencidoCentavos: number;
  qtdTitulosReceberVencidos: number;
  maiorAtrasoReceberDias: number;
  totalPagarVencidoCentavos: number;
  qtdTitulosPagarVencidos: number;
  maiorAtrasoPagarDias: number;
}

export interface DespesaCentroCustoItem {
  centroCustoId: string;
  codigo: string;
  nome: string;
  valorCentavos: number;
}

export interface DespesaPlanoContaFolhaItem {
  planoContaId: string;
  codigo: string;
  nome: string;
  valorCentavos: number;
}

export interface DespesaPlanoContaGroup {
  grupoId: string;
  codigo: string;
  nome: string;
  valorCentavos: number;
  folhas: DespesaPlanoContaFolhaItem[];
}

export interface TopPessoaItem {
  pessoaId: string;
  nome: string;
  valorCentavos: number;
  qtdTitulos: number;
}

export interface DashboardExecutiveData {
  // BLOCO 1
  saldoConsolidadoHojeCentavos: number;
  aReceber30DiasCentavos: number;
  aPagar30DiasCentavos: number;
  resultadoProjetado30DiasCentavos: number;

  // BLOCO 2
  vencidos: VencidosSummary;

  // BLOCO 3
  curva90Dias: { data: string; periodoRotulo: string; saldoAcumuladoCentavos: number }[];

  // BLOCO 4 (Data de Competência)
  despesasPorCentroCusto: DespesaCentroCustoItem[];

  // BLOCO 5 (Data de Competência)
  despesasPorPlanoContaNivel2: DespesaPlanoContaGroup[];

  // BLOCO 6 (Data de Competência)
  top5Fornecedores: TopPessoaItem[];
  top5Clientes: TopPessoaItem[];
}

// Interfaces retrocompatíveis
export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  cidade: string;
  status: 'ATIVO' | 'INATIVO';
  criadoEm: string;
}

export interface Fornecedor {
  id: string;
  razaoSocial: string;
  cnpj: string;
  email: string;
  telefone: string;
  categoria: string;
  status: 'ATIVO' | 'INATIVO';
  criadoEm: string;
}

export interface ContaPagar {
  id: string;
  codigo: string;
  descricao: string;
  fornecedorId: string;
  fornecedorNome: string;
  valorCentavos: number;
  dataLancamento: string;
  vencimento: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO';
  formaPagamento: FormaPagamento;
  categoria: string;
  centroCustoId?: string;
  centroCustoNome?: string;
}

export interface ContaReceber {
  id: string;
  descricao: string;
  clienteId: string;
  clienteNome: string;
  valorCentavos: number;
  vencimento: string;
  status: 'PENDENTE' | 'RECEBIDO' | 'ATRASADO';
  categoria: string;
  centroCustoId?: string;
  centroCustoNome?: string;
}

export interface OrcamentoDAV {
  id: string;
  codigo: string;
  clienteId: string;
  clienteNome: string;
  valorCentavos: number;
  emissao: string;
  status: StatusOrcamento;
  itensCount: number;
  detalhes?: string;
  centroCustoId?: string;
}

export interface DashboardMetrics {
  totalPagarCentavos: number;
  totalReceberCentavos: number;
  saldoProjetadoCentavos: number;
  orcamentosPendentesCount: number;
  orcamentosPorStatus: { name: string; count: number }[];
  fluxoMensal: { mes: string; entradas: number; saídas: number }[];
}

/**
 * MÓDULO DE CADASTRO E ESTRUTURA DO ORÇAMENTO (ETAPA 6)
 */
export type StatusOrcamentoStatus = 'rascunho' | 'aprovado' | 'revisado' | 'encerrado';

export interface OrcamentoItemPeriodo {
  id: string;
  orcamentoItemId?: string;
  mesReferencia: string; // "YYYY-MM-01"
  valorCentavos: number;
}

export interface OrcamentoItem {
  id: string;
  orcamentoId?: string;
  /** Código na planilha orçamentária, ex.: "1.1.3". */
  codigo?: string;
  planoContaId: string; // ID do Plano de Contas Nível 2
  planoContaCodigo: string;
  planoContaNome: string;
  /** Unidade Construtiva do item (nó filho da obra em centro_custo). */
  centroCustoId?: string;
  centroCustoCodigo?: string;
  centroCustoNome?: string;
  descricao?: string;
  quantidade?: number;
  unidade?: string;
  valorUnitarioCentavos?: number;
  valorTotalCentavos: number;
  ordem: number;
  periodos: OrcamentoItemPeriodo[];

  // Retrocompatibilidade
  planoContaNivel2Id?: string;
  planoContaNivel2Codigo?: string;
  planoContaNivel2Nome?: string;
  distribuicaoMensal?: Record<string, number>;
}

export interface Orcamento {
  id: string;
  centroCustoId: string;
  centroCustoCodigo: string;
  centroCustoNome: string;
  nome: string;
  versao: number; // 1, 2, 3...
  orcamentoBaseId?: string; // Aponta para a versão 1 se for revisão
  dataInicio: string; // "YYYY-MM-DD"
  dataFim: string; // "YYYY-MM-DD"
  status: StatusOrcamentoStatus;
  valorTotalCentavos: number;
  aprovadoEm?: string;
  aprovadoPor?: string;
  motivoRevisao?: string;
  observacao?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt?: string;
  itens: OrcamentoItem[];

  // Aliases retrocompatíveis
  descricao?: string;
  isVigente?: boolean;
  dataAprovacao?: string;
}

// Aliases para retrocompatibilidade
export type StatusOrcamentoEmpreendimento = StatusOrcamentoStatus;
export type OrcamentoEmpreendimento = Orcamento;

export interface ComprometidoTituloItem {
  tituloId: string;
  parcelaId: string;
  numeroDocumento?: string;
  descricao?: string;
  pessoaNome: string;
  dataCompetencia: string;
  dataVencimento: string;
  valorTotalParcelaCentavos: number;
  valorRateadoCentavos: number;
  saldoParcelaCentavos: number;
  percentualRateio: number;
}

export interface RealizadoMovimentoItem {
  movimentoId: string;
  parcelaId: string;
  numeroDocumento?: string;
  descricao?: string;
  pessoaNome: string;
  dataPagamento: string;
  formaPagamento: string;
  valorPagoMovimentoCentavos: number;
  valorRateadoMovimentoCentavos: number;
  percentualRateio: number;
}

export interface OrcamentoExecucaoItemView {
  itemId?: string;
  itemCodigo?: string;
  itemDescricao?: string;
  centroCustoId?: string; // Unidade Construtiva
  centroCustoCodigo?: string;
  centroCustoNome?: string;
  planoContaNivel2Id: string;
  planoContaNivel2Codigo: string;
  planoContaNivel2Nome: string;
  orcadoCentavos: number; // Valor Esperado
  comprometidoCentavos: number; // Titulos lançados em aberto (saldo > 0)
  realizadoCentavos: number; // Movimentos de caixa pagos (não estornados)
  saldoCentavos: number; // Orçado - Comprometido - Realizado
  percentualConsumido: number; // (Comprometido + Realizado) / Orçado * 100
  isEstourado: boolean; // (Comprometido + Realizado) > Orçado
  valorExcedenteCentavos: number;
  comprometidoTitulos?: ComprometidoTituloItem[];
  realizadoMovimentos?: RealizadoMovimentoItem[];
  // Comparação com V1 (Linha Base)
  orcadoV1Centavos?: number;
  variacaoReaisCentavos?: number;
  variacaoPercentual?: number;
}

/**
 * Lançamentos que caíram no centro de custo do orçamento mas não apontam item
 * de orçamento nenhum.
 *
 * Existe porque um centro de custo pode ter MAIS DE UM orçamento (obras
 * paralelas, não revisões). Antes, rateio sem item casava por centro de custo e
 * era somado como consumo em todos os orçamentos do CC ao mesmo tempo — o mesmo
 * dinheiro contado duas vezes. Agora o consumo é exclusivamente por
 * `orcamentoItemId`, e o que não aponta item vem para cá: não consome nenhum
 * orçamento, mas continua visível para poder ser classificado.
 */
export interface OrcamentoSemItemView {
  comprometidoCentavos: number;
  realizadoCentavos: number;
  comprometidoTitulos: ComprometidoTituloItem[];
  realizadoMovimentos: RealizadoMovimentoItem[];
}

export interface OrcamentoCurvaSPonto {
  mesAno: string; // "2026-07"
  rotuloMes: string; // "07/26"
  orcadoMesCentavos: number;
  comprometidoMesCentavos: number;
  realizadoMesCentavos: number;
  desvioMesCentavos: number;
  desvioMesPercentual: number;
  orcadoAcumuladoCentavos: number;
  comprometidoAcumuladoCentavos: number;
  realizadoAcumuladoCentavos: number;
  consumidoAcumuladoCentavos: number; // Comprometido + Realizado acumulado
}

export interface OrcamentoExecucaoView {
  orcamentoId: string;
  versao: number;
  status: StatusOrcamentoEmpreendimento;
  centroCustoId: string;
  centroCustoCodigo: string;
  centroCustoNome: string;
  dataInicio: string;
  dataFim: string;
  dataCorte: string;
  totalOrcadoCentavos: number;
  totalComprometidoCentavos: number;
  totalRealizadoCentavos: number;
  totalSaldoCentavos: number;
  totalPercentualConsumido: number;
  isEstouradoGeral: boolean;
  totalExcedenteCentavos: number;
  fraseStatusCurvaS: string;
  temLinhaBaseV1: boolean;
  totalOrcadoV1Centavos?: number;
  variacaoV1TotalCentavos?: number;
  variacaoV1TotalPercentual?: number;
  itensExecucao: OrcamentoExecucaoItemView[];
  /**
   * Lançamentos no centro de custo sem item de orçamento apontado. Fica FORA dos
   * totais acima de propósito: eles não consomem orçamento, e somá-los quebraria
   * `saldo = orçado − comprometido − realizado`.
   */
  semItemOrcamento: OrcamentoSemItemView;
  curvaS: OrcamentoCurvaSPonto[];
}

/**
 * Um título que impede a exclusão de um orçamento.
 *
 * Excluir a planilha apaga os itens em cascata, e `titulo_rateio.orcamento_item_id`
 * aponta para eles. O banco recusa (ON DELETE RESTRICT), mas erro de constraint
 * não diz QUAL título travou — sem isso o usuário fica sem saída.
 */
export interface TituloBloqueandoExclusao {
  tituloId: string;
  tituloCodigo: string;
  tituloDescricao?: string;
  itemDescricao: string;
  valorRateadoCentavos: number;
}

/** O que a exclusão de um orçamento vai levar junto — consultado ANTES de excluir. */
export interface ExclusaoOrcamentoPrevia {
  podeExcluir: boolean;
  orcamentoNome: string;
  itensCount: number;
  valorTotalCentavos: number;
  /** Vazio quando `podeExcluir` é true. */
  bloqueios: TituloBloqueandoExclusao[];
  /**
   * Preenchido quando o que trava não é apropriação e sim uma revisão que
   * aponta para esta planilha como base (`orcamento_base_id`). São bloqueios de
   * naturezas diferentes e a tela explica cada um do seu jeito.
   */
  revisoesDependentes?: string;
}

export interface DisponibilidadeOrcamentariaResultado {
  hasOrcamentoVigente: boolean;
  orcamentoId?: string;
  versao?: number;
  planoContaNivel2Codigo?: string;
  planoContaNivel2Nome?: string;
  orcadoCentavos: number;
  consumidoCentavos: number;
  disponivelCentavos: number;
  isEstouro: boolean;
  estouroCentavos: number;
}

/**
 * MÓDULO DE RECORRÊNCIAS (ETAPA 8)
 */
export type FrequenciaRecorrencia = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
export type StatusRecorrencia = 'ativa' | 'pausada' | 'encerrada';
export type TipoValorRecorrencia = 'fixo' | 'variavel';
export type AjusteDiaUtilRecorrencia = 'nenhum' | 'antecipa' | 'posterga';
export type IndiceReajusteRecorrencia = 'nenhum' | 'IGPM' | 'IPCA' | 'fixo';

export interface RecorrenciaRateio {
  id?: string;
  recorrenciaId?: string;
  centroCustoId: string;
  centroCustoCodigo?: string;
  centroCustoNome?: string;
  percentual: number;
}

export interface Recorrencia {
  id: string;
  tipo: TipoTitulo; // 'P' ou 'R'
  pessoaId: string;
  pessoaNome?: string;
  planoContaId: string;
  planoContaNome?: string;
  descricao: string;
  valorBrutoCentavos: number;
  tipoValor: TipoValorRecorrencia;
  frequencia: FrequenciaRecorrencia;
  diaVencimento?: number; // 1 a 31
  diaSemana?: number; // 0 a 6 (0=Dom, 1=Seg...)
  ajusteDiaUtil: AjusteDiaUtilRecorrencia;
  dataInicio: string; // "YYYY-MM-DD"
  dataFim?: string;
  qtdOcorrencias?: number;
  antecedenciaGeracao: number; // dias antes do vencimento (default 30)
  gerarAutomatico: boolean;
  indiceReajuste: IndiceReajusteRecorrencia;
  mesReajuste?: number; // 1 a 12
  percentualReajuste?: number;
  ultimaCompetenciaGerada?: string; // "YYYY-MM-01"
  proximaCompetencia: string; // "YYYY-MM-01"
  status: StatusRecorrencia;
  observacao?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt?: string;
  rateios?: RecorrenciaRateio[];
}

export interface RecorrenciaOcorrencia {
  id: string;
  recorrenciaId: string;
  recorrenciaDescricao?: string;
  competencia: string; // "YYYY-MM-01"
  tituloId?: string;
  valorGeradoCentavos: number;
  dataVencimento: string;
  origem: 'automatico' | 'manual';
  status: 'gerado' | 'pulado' | 'cancelado';
  geradoEm: string;
  geradoPor?: string;
  motivo?: string;
}

export interface RecorrenciaReajuste {
  id: string;
  recorrenciaId: string;
  recorrenciaDescricao?: string;
  dataReajuste: string;
  valorAnteriorCentavos: number;
  valorNovoCentavos: number;
  percentual: number;
  indice: string;
  observacao?: string;
  createdAt: string;
}

export interface Feriado {
  data: string; // "YYYY-MM-DD"
  descricao: string;
}

export interface ProximaOcorrenciaPrevia {
  competencia: string; // "YYYY-MM-01"
  dataVencimento: string;
  diaSemanaRotulo: string; // "Segunda-feira", "Sexta-feira"
  valorCentavos: number;
  isAjustadoDiaUtil: boolean;
}

export interface LogExecucaoFila {
  id: string;
  dataExecucao: string;
  qtdGeradas: number;
  qtdPuladas: number;
  erros: string[];
}

export interface GeracaoRetroativaOcorrenciaItem {
  recorrenciaId: string;
  descricao: string;
  pessoaNome: string;
  dataVencimento: string;
  periodoRotulo: string; // "2026-07"
  valorCentavos: number;
}

export interface GeracaoRetroativaSimulacaoResultado {
  ocorrencias: GeracaoRetroativaOcorrenciaItem[];
  totalTitulos: number;
  valorTotalCentavos: number;
}

/**
 * MÓDULO DE CONCILIAÇÃO BANCÁRIA (ETAPA 9 COMPLETA)
 */
export type StatusExtratoLancamento = 'nao_conciliado' | 'conciliado' | 'ignorado' | 'divergente';
export type FormatoImportacao = 'ofx' | 'csv';
export type StatusImportacao = 'processando' | 'concluida' | 'erro';
export type NivelCasamento = 1 | 2 | 3 | 4 | 5;

export interface ExtratoImportacao {
  id: string;
  contaBancariaId: string;
  arquivoNome: string;
  formato: FormatoImportacao;
  dataInicio: string;
  dataFim: string;
  saldoInicialArquivoCentavos: number;
  saldoFinalArquivoCentavos: number;
  qtdLancamentos: number;
  qtdConciliados: number;
  importadoEm: string;
  importadoPor?: string;
  status: StatusImportacao;
  erroDetalhe?: string;
}

export interface ExtratoLancamento {
  id: string;
  importacaoId?: string;
  contaBancariaId: string;
  fitid: string; // ID único vindo do OFX (Regra Anti-Duplicidade)
  dataLancamento: string; // YYYY-MM-DD
  valorCentavos: number; // Positivo = Crédito, Negativo = Débito
  descricao: string;
  documento?: string;
  tipoOfx?: string;
  status: StatusExtratoLancamento;
  movimentoId?: string;
  movimentosAgrupadosIds?: string[]; // Para Nível 4 (Borderô)
  confiancaSugestao: number; // 0 a 100
  nivelSugestao?: NivelCasamento;
  motivoSugestao?: string;
  regraAplicadaId?: string;
  conciliadoEm?: string;
  conciliadoPor?: string;
  observacao?: string;
}

export interface ConciliacaoRegra {
  id: string;
  contaBancariaId?: string; // Opcional (se for para todas as contas)
  padraoDescricao: string; // Trecho a procurar no MEMO/descrição
  pessoaId?: string;
  pessoaNome?: string;
  planoContaId?: string;
  planoContaNome?: string;
  centroCustoId?: string;
  centroCustoNome?: string;
  acao: 'sugerir_lancamento' | 'ignorar';
  vezesAplicada: number;
  ativo?: boolean;
  createdAt: string;
}


export interface SugestaoCasamento {
  extratoLancamentoId: string;
  nivel: NivelCasamento;
  confiancaPercentual: number;
  movimentoId?: string;
  movimentosIdsAgrupados?: string[];
  motivo: string;
  sugestaoAvulsoRegra?: {
    pessoaId?: string;
    planoContaId?: string;
    centroCustoId?: string;
    regraId?: string;
  };
}

export interface PreviewImportacaoOFX {
  arquivoNome: string;
  dataInicio: string;
  dataFim: string;
  saldoInicialCentavos: number;
  saldoFinalCentavos: number;
  qtdTotalInFile: number;
  qtdExistentesFitid: number;
  qtdNovosImportar: number;
  temBuracoSequencia: boolean;
  mensagemAlertaBuraco?: string;
  itensPreview: Omit<ExtratoLancamento, 'id' | 'contaBancariaId' | 'status' | 'confiancaSugestao'>[];
}

export interface ComposicaoDiferencaConciliacao {
  soNoBancoCount: number;
  soNoBancoValorCentavos: number;
  soNoSistemaCount: number;
  soNoSistemaValorCentavos: number;
  divergenciasCount: number;
  divergenciasValorCentavos: number;
}

export interface ResumoSaldosConciliacaoEtapa9 {
  contaBancariaId: string;
  contaBancariaNome: string;
  saldoInicialExtratoCentavos: number;
  saldoConciliadoCentavos: number;
  saldoContabilCentavos: number;
  diferencaCentavos: number; // saldoContabil - saldoConciliado
  composicao: ComposicaoDiferencaConciliacao;
  qtdNivel1Auto100Percent: number;
}

// Manter alias retrocompatível com a interface anterior
export type StatusConciliacaoItem = StatusExtratoLancamento;
export type ExtratoBancarioItem = ExtratoLancamento;

export interface ResumoSaldosConciliacao {
  contaBancariaId: string;
  contaBancariaNome: string;
  saldoContabilCentavos: number;
  saldoConciliadoCentavos: number;
  diferencaCentavos: number;
  qtdCasados: number;
  qtdSoNoBanco: number;
  qtdSoNoSistema: number;
  qtdDivergentes: number;
}

export interface ConciliacaoLog {
  id: string;
  contaBancariaId: string;
  extratoItemId?: string;
  movimentoId?: string;
  acao: 'conciliado_auto' | 'conciliado_manual' | 'desconciliado' | 'movimento_avulso_criado';
  motivo?: string;
  realizadoEm: string;
  realizadoPor?: string;
}

/**
 * MÓDULO DE AUTENTICAÇÃO E PERMISSÕES POR DEPARTAMENTO (PASSO 5)
 */
export const DOMINIO_PERMITIDO = 'deltaplanobras.com.br';

export type RoleUsuario = 'administrador' | 'gerente' | 'operador' | 'leitor';

export type DepartamentoId = 'financeiro' | 'comercial' | 'rh' | 'fiscal' | 'juridico';

export interface UsuarioPerfil {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  role: RoleUsuario;
  departamentosPermitidos: DepartamentoId[];
  isAcessoGeral: boolean;
  ativo: boolean;
  statusConfirmacao?: 'ativo' | 'pendente_confirmacao';
  senhaTemporaria?: string;
  tokenConfirmacao?: string;
  createdAt: string;
  updatedAt?: string;
}

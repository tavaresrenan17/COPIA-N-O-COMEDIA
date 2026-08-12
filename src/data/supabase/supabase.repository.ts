import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { IErpRepository, TituloInput, FiltroParcelas } from '../repository.interface';
import { MockErpRepository } from '../mock/mock.repository';
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
  FormaPagamentoMovimento,
  NaturezaPlanoConta,
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
  Recorrencia,
  StatusRecorrencia,
  ProximaOcorrenciaPrevia,
  RecorrenciaOcorrencia,
  RecorrenciaReajuste,
  LogExecucaoFila,
  Feriado,
  ExtratoBancarioItem,
  ResumoSaldosConciliacao,
  ConciliacaoLog,
  PreviewImportacaoOFX,
  ExtratoImportacao,
  ConciliacaoRegra,
  SugestaoCasamento,
  ResumoSaldosConciliacaoEtapa9,
  DisponibilidadeOrcamentariaResultado,
  GeracaoRetroativaSimulacaoResultado
} from '../types';

function toUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  const cleaned = String(val).trim();
  if (!cleaned) return null;
  if (cleaned === 'cc-999') return '99999999-9999-9999-9999-999999999999';
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(cleaned)) return cleaned;
  return null;
}

/**
 * Naturezas aceitas por tipo de título.
 * 'R' (receber) só pode usar conta de receita; 'P' (pagar) nunca pode.
 * A mesma regra é garantida no banco pelo trigger trg_valida_natureza_titulo.
 */
const NATUREZAS_POR_TIPO: Record<TipoTitulo, NaturezaPlanoConta[]> = {
  R: ['receita'],
  P: ['custo', 'despesa', 'investimento']
};

/**
 * Cache de curta duração para as tabelas de CADASTRO (pessoa, plano de contas,
 * centro de custo, conta bancária, grupos e linhas de gestão).
 *
 * Motivo: o banco responde a ~250ms de RTT por chamada (latência de rede, não de
 * consulta — medido: TCP connect sozinho leva 250ms). Como cada tela remonta os
 * mesmos combos ao entrar, navegar entre Contas a Pagar e Contas a Receber
 * repetia 3 a 4 idas ao banco por vez para buscar dados idênticos.
 *
 * Guarda a Promise, não o valor: dois componentes que pedem a mesma lista ao
 * mesmo tempo compartilham uma única requisição em vez de disparar duas.
 *
 * NUNCA cacheia dado transacional (títulos, parcelas, movimentos): esses precisam
 * refletir o banco a cada leitura.
 */
const CACHE_CADASTRO_TTL_MS = 60_000;

class CacheCadastros {
  private entradas = new Map<string, { expiraEm: number; valor: Promise<unknown> }>();

  async obter<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
    const agora = Date.now();
    const atual = this.entradas.get(chave);
    if (atual && atual.expiraEm > agora) return atual.valor as Promise<T>;

    const promessa = buscar().catch(err => {
      this.entradas.delete(chave);   // erro não fica preso no cache
      throw err;
    });
    this.entradas.set(chave, { expiraEm: agora + CACHE_CADASTRO_TTL_MS, valor: promessa });
    return promessa;
  }

  /** Invalida tudo que começar com o prefixo. Chamado após gravações. */
  invalidar(prefixo: string): void {
    for (const chave of this.entradas.keys()) {
      if (chave.startsWith(prefixo)) this.entradas.delete(chave);
    }
  }
}

/**
 * Repositório Supabase (PostgreSQL) com Fallback Transparente.
 * Se as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
 * não estiverem preenchidas no .env.local, ele utiliza a implementação MockErpRepository em memória.
 */
export class SupabaseErpRepository implements IErpRepository {
  private fallbackMock = new MockErpRepository();
  private cache = new CacheCadastros();

  /** Resultado da checagem de colunas opcionais, uma vez por sessão. */
  private colunasConhecidas = new Map<string, Promise<boolean>>();

  /**
   * Diz se uma coluna existe no banco.
   *
   * Algumas colunas só passam a existir com a migration 08 (`titulo_rateio.
   * plano_conta_id`, `pessoa.categoria_fornecedor`). Gravá-las às cegas quebra
   * o salvamento em bancos onde a migration ainda não entrou — foi o que
   * aconteceu três vezes: "Could not find the 'plano_conta_id' column".
   *
   * Em vez de exigir a migration para o app funcionar, perguntamos ao banco.
   * Assim que a migration for aplicada, os campos voltam a ser gravados
   * sozinhos, sem mexer no código.
   */
  private async temColuna(tabela: string, coluna: string): Promise<boolean> {
    const chave = `${tabela}.${coluna}`;

    if (!this.colunasConhecidas.has(chave)) {
      this.colunasConhecidas.set(
        chave,
        (async () => {
          const { error } = await this.client!.from(tabela).select(coluna).limit(1);
          return !error;
        })()
      );
    }

    return this.colunasConhecidas.get(chave)!;
  }

  private get client() {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }
    return supabase;
  }

  // ---------------------------------------------------------------------------
  // 1. PESSOA (Clientes & Credores)
  // ---------------------------------------------------------------------------
  async getPessoas(filtro?: { apenasAtivos?: boolean; apenasClientes?: boolean; apenasFornecedores?: boolean }): Promise<Pessoa[]> {
    if (!this.client) return this.fallbackMock.getPessoas(filtro);
    const client = this.client;
    return this.cache.obter(`pessoa:${JSON.stringify(filtro ?? {})}`, async () => {

    let query = client.from('pessoa').select('*');
    if (filtro?.apenasAtivos !== false) query = query.eq('ativo', true);
    if (filtro?.apenasClientes) query = query.eq('is_cliente', true);
    if (filtro?.apenasFornecedores) query = query.eq('is_fornecedor', true);

    const { data, error } = await query.order('nome');
    if (error || !data) {
      console.warn('Supabase query error, falling back to mock:', error);
      return this.fallbackMock.getPessoas(filtro);
    }

    return data.map(p => ({
      id: p.id,
      cpfCnpj: p.cpf_cnpj,
      tipoPessoa: p.tipo_pessoa,
      nome: p.nome,
      nomeFantasia: p.nome_fantasia,
      inscricaoEstadual: p.inscricao_estadual,
      dataNascimento: p.data_nascimento,
      email: p.email,
      telefone: p.telefone,
      cep: p.cep,
      logradouro: p.logradouro,
      numero: p.numero,
      complemento: p.complemento,
      bairro: p.bairro,
      cidade: p.cidade,
      uf: p.uf,
      isCliente: p.is_cliente,
      isFornecedor: p.is_fornecedor,
      categoriaFornecedor: p.categoria_fornecedor,
      banco: p.banco,
      agencia: p.agencia,
      conta: p.conta,
      chavePix: p.chave_pix,
      planoContaPadraoId: p.plano_conta_padrao_id,
      condicaoPagamentoPadrao: p.condicao_pagamento_padrao,
      observacao: p.observacao,
      ativo: p.ativo,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
    });
  }

  async getPessoaById(id: string): Promise<Pessoa | null> {
    if (!this.client) return this.fallbackMock.getPessoaById(id);
    const { data } = await this.client.from('pessoa').select('*').eq('id', id).single();
    if (!data) return null;
    return {
      id: data.id,
      cpfCnpj: data.cpf_cnpj,
      tipoPessoa: data.tipo_pessoa,
      nome: data.nome,
      nomeFantasia: data.nome_fantasia,
      inscricaoEstadual: data.inscricao_estadual,
      dataNascimento: data.data_nascimento,
      email: data.email,
      telefone: data.telefone,
      cep: data.cep,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      uf: data.uf,
      isCliente: data.is_cliente,
      isFornecedor: data.is_fornecedor,
      categoriaFornecedor: data.categoria_fornecedor,
      banco: data.banco,
      agencia: data.agencia,
      conta: data.conta,
      chavePix: data.chave_pix,
      planoContaPadraoId: data.plano_conta_padrao_id,
      condicaoPagamentoPadrao: data.condicao_pagamento_padrao,
      observacao: data.observacao,
      ativo: data.ativo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async createPessoa(data: Omit<Pessoa, 'id' | 'createdAt' | 'updatedAt'>): Promise<Pessoa> {
    if (!this.client) return this.fallbackMock.createPessoa(data);
    const novaPessoa: Record<string, unknown> = {
      cpf_cnpj: data.cpfCnpj,
      tipo_pessoa: data.tipoPessoa,
      nome: data.nome,
      nome_fantasia: data.nomeFantasia,
      inscricao_estadual: data.inscricaoEstadual,
      data_nascimento: data.dataNascimento,
      email: data.email,
      telefone: data.telefone,
      cep: data.cep,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      uf: data.uf,
      is_cliente: data.isCliente,
      is_fornecedor: data.isFornecedor,
      banco: data.banco,
      agencia: data.agencia,
      conta: data.conta,
      chave_pix: data.chavePix,
      plano_conta_padrao_id: data.planoContaPadraoId,
      condicao_pagamento_padrao: data.condicaoPagamentoPadrao,
      observacao: data.observacao,
      ativo: data.ativo ?? true
    };

    // Coluna criada pela migration 08; sem ela o insert inteiro falharia.
    if (await this.temColuna('pessoa', 'categoria_fornecedor')) {
      novaPessoa.categoria_fornecedor = data.categoriaFornecedor;
    }

    const { data: inserted, error } = await this.client.from('pessoa').insert(novaPessoa).select().single();
    this.cache.invalidar('pessoa');   // só depois da escrita confirmada

    if (error || !inserted) throw new Error(error?.message || 'Erro ao criar pessoa no Supabase');
    return this.getPessoaById(inserted.id) as Promise<Pessoa>;
  }

  async updatePessoa(id: string, data: Partial<Pessoa>): Promise<Pessoa> {
    if (!this.client) return this.fallbackMock.updatePessoa(id, data);
    const payload: any = {};
    if (data.cpfCnpj !== undefined) payload.cpf_cnpj = data.cpfCnpj;
    if (data.tipoPessoa !== undefined) payload.tipo_pessoa = data.tipoPessoa;
    if (data.nome !== undefined) payload.nome = data.nome;
    if (data.nomeFantasia !== undefined) payload.nome_fantasia = data.nomeFantasia;
    if (data.inscricaoEstadual !== undefined) payload.inscricao_estadual = data.inscricaoEstadual;
    if (data.dataNascimento !== undefined) payload.data_nascimento = data.dataNascimento;
    if (data.email !== undefined) payload.email = data.email;
    if (data.telefone !== undefined) payload.telefone = data.telefone;
    if (data.cep !== undefined) payload.cep = data.cep;
    if (data.logradouro !== undefined) payload.logradouro = data.logradouro;
    if (data.numero !== undefined) payload.numero = data.numero;
    if (data.complemento !== undefined) payload.complemento = data.complemento;
    if (data.bairro !== undefined) payload.bairro = data.bairro;
    if (data.cidade !== undefined) payload.cidade = data.cidade;
    if (data.uf !== undefined) payload.uf = data.uf;
    if (data.isCliente !== undefined) payload.is_cliente = data.isCliente;
    if (data.isFornecedor !== undefined) payload.is_fornecedor = data.isFornecedor;
    if (data.categoriaFornecedor !== undefined && (await this.temColuna('pessoa', 'categoria_fornecedor')))
      payload.categoria_fornecedor = data.categoriaFornecedor;
    if (data.banco !== undefined) payload.banco = data.banco;
    if (data.agencia !== undefined) payload.agencia = data.agencia;
    if (data.conta !== undefined) payload.conta = data.conta;
    if (data.chavePix !== undefined) payload.chave_pix = data.chavePix;
    if (data.planoContaPadraoId !== undefined) payload.plano_conta_padrao_id = data.planoContaPadraoId;
    if (data.condicaoPagamentoPadrao !== undefined) payload.condicao_pagamento_padrao = data.condicaoPagamentoPadrao;
    if (data.observacao !== undefined) payload.observacao = data.observacao;
    if (data.ativo !== undefined) payload.ativo = data.ativo;
    payload.updated_at = new Date().toISOString();

    const { error } = await this.client.from('pessoa').update(payload).eq('id', id);
    this.cache.invalidar('pessoa');   // só depois da escrita confirmada
    if (error) throw new Error(error.message);
    return this.getPessoaById(id) as Promise<Pessoa>;
  }

  async deletePessoa(id: string): Promise<boolean> {
    if (!this.client) return this.fallbackMock.deletePessoa(id);
    const { error } = await this.client.from('pessoa').update({ ativo: false }).eq('id', id);
    this.cache.invalidar('pessoa');   // só depois da escrita confirmada
    return !error;
  }

  // ---------------------------------------------------------------------------
  // 2. PLANO DE CONTAS
  // ---------------------------------------------------------------------------
  async getPlanoContas(filtro?: { apenasAtivos?: boolean }): Promise<PlanoConta[]> {
    if (!this.client) return this.fallbackMock.getPlanoContas(filtro);
    const client = this.client;
    return this.cache.obter(`plano_conta:all:${JSON.stringify(filtro ?? {})}`, async () => {
    let query = client.from('plano_conta').select('*');
    if (filtro?.apenasAtivos !== false) query = query.eq('ativo', true);
    const { data } = await query.order('codigo');
    if (!data) return this.fallbackMock.getPlanoContas(filtro);

    return data.map(pc => ({
      id: pc.id,
      codigo: pc.codigo,
      nome: pc.nome,
      parentId: pc.parent_id,
      natureza: pc.natureza,
      nivel: pc.nivel,
      aceitaLancamento: pc.aceita_lancamento,
      ativo: pc.ativo,
      createdAt: pc.created_at,
      updatedAt: pc.updated_at
    }));
    });
  }

  async getPlanoContasFolhas(natureza?: string): Promise<PlanoConta[]> {
    if (!this.client) return this.fallbackMock.getPlanoContasFolhas(natureza);
    const client = this.client;
    return this.cache.obter(`plano_conta:folhas:${natureza ?? ''}`, async () => {
    let query = client.from('plano_conta').select('*').eq('aceita_lancamento', true).eq('ativo', true);
    if (natureza) query = query.eq('natureza', natureza);
    const { data } = await query.order('codigo');
    if (!data) return this.fallbackMock.getPlanoContasFolhas(natureza);

    return data.map(pc => ({
      id: pc.id,
      codigo: pc.codigo,
      nome: pc.nome,
      parentId: pc.parent_id,
      natureza: pc.natureza,
      nivel: pc.nivel,
      aceitaLancamento: pc.aceita_lancamento,
      ativo: pc.ativo,
      createdAt: pc.created_at,
      updatedAt: pc.updated_at
    }));
    });
  }

  async getPlanoContaById(id: string): Promise<PlanoConta | null> {
    if (!this.client) return this.fallbackMock.getPlanoContaById(id);
    const { data } = await this.client.from('plano_conta').select('*').eq('id', id).single();
    if (!data) return null;
    return {
      id: data.id,
      codigo: data.codigo,
      nome: data.nome,
      parentId: data.parent_id,
      natureza: data.natureza,
      nivel: data.nivel,
      aceitaLancamento: data.aceita_lancamento,
      ativo: data.ativo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async createPlanoConta(data: Omit<PlanoConta, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlanoConta> {
    if (!this.client) return this.fallbackMock.createPlanoConta(data);
    const { data: inserted, error } = await this.client.from('plano_conta').insert({
      codigo: data.codigo,
      nome: data.nome,
      parent_id: data.parentId || null,
      natureza: data.natureza,
      nivel: data.nivel,
      aceita_lancamento: data.aceitaLancamento,
      ativo: data.ativo ?? true
    }).select().single();
    this.cache.invalidar('plano_conta');   // só depois da escrita confirmada
    if (error || !inserted) throw new Error(error?.message || 'Erro ao criar plano de conta');
    return this.getPlanoContaById(inserted.id) as Promise<PlanoConta>;
  }

  async updatePlanoConta(id: string, data: Partial<PlanoConta>): Promise<PlanoConta> {
    if (!this.client) return this.fallbackMock.updatePlanoConta(id, data);
    // Mesmo defeito do centro de custo: só nome e ativo chegavam ao banco.
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.codigo !== undefined) payload.codigo = data.codigo;
    if (data.nome !== undefined) payload.nome = data.nome;
    if (data.parentId !== undefined) payload.parent_id = toUuidOrNull(data.parentId);
    if (data.natureza !== undefined) payload.natureza = data.natureza;
    if (data.nivel !== undefined) payload.nivel = data.nivel;
    if (data.aceitaLancamento !== undefined) payload.aceita_lancamento = data.aceitaLancamento;
    if (data.ativo !== undefined) payload.ativo = data.ativo;

    const { error } = await this.client.from('plano_conta').update(payload).eq('id', id);
    this.cache.invalidar('plano_conta');   // só depois da escrita confirmada
    if (error) throw new Error(error.message);
    return this.getPlanoContaById(id) as Promise<PlanoConta>;
  }

  async deletePlanoConta(id: string): Promise<boolean> {
    if (!this.client) return this.fallbackMock.deletePlanoConta(id);
    const { error } = await this.client.from('plano_conta').update({ ativo: false }).eq('id', id);
    this.cache.invalidar('plano_conta');   // só depois da escrita confirmada
    return !error;
  }

  // ---------------------------------------------------------------------------
  // 3. CENTRO DE CUSTOS
  // ---------------------------------------------------------------------------
  async getCentrosCusto(filtro?: { apenasAtivos?: boolean; subempresaId?: string }): Promise<CentroCusto[]> {
    if (!this.client) return this.fallbackMock.getCentrosCusto(filtro);
    const client = this.client;
    return this.cache.obter(`centro_custo:all:${JSON.stringify(filtro ?? {})}`, async () => {
    let query = client.from('centro_custo').select('*');
    if (filtro?.apenasAtivos !== false) query = query.eq('ativo', true);
    const { data } = await query.order('codigo');
    if (!data) return this.fallbackMock.getCentrosCusto(filtro);

    return data.map(cc => ({
      id: cc.id,
      codigo: cc.codigo,
      nome: cc.nome,
      parentId: cc.parent_id,
      tipo: cc.tipo,
      nivel: cc.nivel,
      aceitaLancamento: cc.aceita_lancamento,
      dataInicio: cc.data_inicio,
      dataFim: cc.data_fim,
      ativo: cc.ativo,
      createdAt: cc.created_at,
      updatedAt: cc.updated_at
    }));
    });
  }

  async getCentroCustosFolhas(subempresaId?: string): Promise<CentroCusto[]> {
    if (!this.client) return this.fallbackMock.getCentroCustosFolhas(subempresaId);
    const client = this.client;
    return this.cache.obter('centro_custo:folhas', async () => {
    const { data } = await client.from('centro_custo').select('*').eq('aceita_lancamento', true).eq('ativo', true).order('codigo');
    if (!data) return this.fallbackMock.getCentroCustosFolhas(subempresaId);

    return data.map(cc => ({
      id: cc.id,
      codigo: cc.codigo,
      nome: cc.nome,
      parentId: cc.parent_id,
      tipo: cc.tipo,
      nivel: cc.nivel,
      aceitaLancamento: cc.aceita_lancamento,
      dataInicio: cc.data_inicio,
      dataFim: cc.data_fim,
      ativo: cc.ativo,
      createdAt: cc.created_at,
      updatedAt: cc.updated_at
    }));
    });
  }

  async getCentroCustoById(id: string): Promise<CentroCusto | null> {
    if (!this.client) return this.fallbackMock.getCentroCustoById(id);
    const { data } = await this.client.from('centro_custo').select('*').eq('id', id).single();
    if (!data) return null;
    return {
      id: data.id,
      codigo: data.codigo,
      nome: data.nome,
      parentId: data.parent_id,
      tipo: data.tipo,
      nivel: data.nivel,
      aceitaLancamento: data.aceita_lancamento,
      dataInicio: data.data_inicio,
      dataFim: data.data_fim,
      ativo: data.ativo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async createCentroCusto(data: Omit<CentroCusto, 'id' | 'createdAt' | 'updatedAt' | 'gastoCentavos'>): Promise<CentroCusto> {
    if (!this.client) return this.fallbackMock.createCentroCusto(data);
    const { data: inserted, error } = await this.client.from('centro_custo').insert({
      codigo: data.codigo,
      nome: data.nome,
      parent_id: data.parentId || null,
      tipo: data.tipo,
      nivel: data.nivel,
      aceita_lancamento: data.aceitaLancamento,
      data_inicio: data.dataInicio || null,
      data_fim: data.dataFim || null,
      ativo: data.ativo ?? true
    }).select().single();
    this.cache.invalidar('centro_custo');   // só depois da escrita confirmada
    if (error || !inserted) throw new Error(error?.message || 'Erro ao criar centro de custo');
    return this.getCentroCustoById(inserted.id) as Promise<CentroCusto>;
  }

  async updateCentroCusto(id: string, data: Partial<CentroCusto>): Promise<CentroCusto> {
    if (!this.client) return this.fallbackMock.updateCentroCusto(id, data);
    /*
     * Gravava só nome e ativo: editar um centro de custo descartava pai, tipo,
     * nível, aceita-lançamento e vigência sem avisar. A tela mostrava sucesso e
     * a árvore continuava como estava.
     */
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.codigo !== undefined) payload.codigo = data.codigo;
    if (data.nome !== undefined) payload.nome = data.nome;
    if (data.parentId !== undefined) payload.parent_id = toUuidOrNull(data.parentId);
    if (data.tipo !== undefined) payload.tipo = data.tipo;
    if (data.nivel !== undefined) payload.nivel = data.nivel;
    if (data.aceitaLancamento !== undefined) payload.aceita_lancamento = data.aceitaLancamento;
    if (data.dataInicio !== undefined) payload.data_inicio = data.dataInicio || null;
    if (data.dataFim !== undefined) payload.data_fim = data.dataFim || null;
    if (data.ativo !== undefined) payload.ativo = data.ativo;

    const { error } = await this.client.from('centro_custo').update(payload).eq('id', id);
    this.cache.invalidar('centro_custo');   // só depois da escrita confirmada
    if (error) throw new Error(error.message);
    return this.getCentroCustoById(id) as Promise<CentroCusto>;
  }

  async deleteCentroCusto(id: string): Promise<boolean> {
    if (!this.client) return this.fallbackMock.deleteCentroCusto(id);
    const { error } = await this.client.from('centro_custo').update({ ativo: false }).eq('id', id);
    this.cache.invalidar('centro_custo');   // só depois da escrita confirmada
    return !error;
  }

  // ---------------------------------------------------------------------------
  // 4. CONTA BANCÁRIA
  // ---------------------------------------------------------------------------
  async getContasBancarias(filtro?: { apenasAtivos?: boolean }): Promise<ContaBancaria[]> {
    if (!this.client) return this.fallbackMock.getContasBancarias(filtro);
    const client = this.client;
    return this.cache.obter(`conta_bancaria:${JSON.stringify(filtro ?? {})}`, async () => {
    let query = client.from('conta_bancaria').select('*');
    if (filtro?.apenasAtivos !== false) query = query.eq('ativo', true);
    const { data } = await query.order('nome');
    if (!data) return this.fallbackMock.getContasBancarias(filtro);

    return data.map(cb => ({
      id: cb.id,
      nome: cb.nome,
      tipo: cb.tipo,
      banco: cb.banco,
      agencia: cb.agencia,
      conta: cb.conta,
      saldoInicialCentavos: Math.round((cb.saldo_inicial || 0) * 100),
      dataSaldoInicial: cb.data_saldo_inicial,
      ativo: cb.ativo,
      createdAt: cb.created_at,
      updatedAt: cb.updated_at
    }));
    });
  }

  async getContaBancariaById(id: string): Promise<ContaBancaria | null> {
    if (!this.client) return this.fallbackMock.getContaBancariaById(id);
    const { data } = await this.client.from('conta_bancaria').select('*').eq('id', id).single();
    if (!data) return null;
    return {
      id: data.id,
      nome: data.nome,
      tipo: data.tipo,
      banco: data.banco,
      agencia: data.agencia,
      conta: data.conta,
      saldoInicialCentavos: Math.round((data.saldo_inicial || 0) * 100),
      dataSaldoInicial: data.data_saldo_inicial,
      ativo: data.ativo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async createContaBancaria(data: Omit<ContaBancaria, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContaBancaria> {
    if (!this.client) return this.fallbackMock.createContaBancaria(data);
    const { data: inserted, error } = await this.client.from('conta_bancaria').insert({
      nome: data.nome,
      tipo: data.tipo,
      banco: data.banco,
      agencia: data.agencia,
      conta: data.conta,
      saldo_inicial: data.saldoInicialCentavos / 100,
      data_saldo_inicial: data.dataSaldoInicial,
      ativo: data.ativo ?? true
    }).select().single();
    this.cache.invalidar('conta_bancaria');   // só depois da escrita confirmada
    if (error || !inserted) throw new Error(error?.message || 'Erro ao criar conta bancária');
    return this.getContaBancariaById(inserted.id) as Promise<ContaBancaria>;
  }

  async updateContaBancaria(id: string, data: Partial<ContaBancaria>): Promise<ContaBancaria> {
    if (!this.client) return this.fallbackMock.updateContaBancaria(id, data);
    const payload: any = {};
    if (data.nome !== undefined) payload.nome = data.nome;
    if (data.ativo !== undefined) payload.ativo = data.ativo;
    const { error } = await this.client.from('conta_bancaria').update(payload).eq('id', id);
    this.cache.invalidar('conta_bancaria');   // só depois da escrita confirmada
    if (error) throw new Error(error.message);
    return this.getContaBancariaById(id) as Promise<ContaBancaria>;
  }

  async deleteContaBancaria(id: string): Promise<boolean> {
    if (!this.client) return this.fallbackMock.deleteContaBancaria(id);
    const { error } = await this.client.from('conta_bancaria').update({ ativo: false }).eq('id', id);
    this.cache.invalidar('conta_bancaria');   // só depois da escrita confirmada
    return !error;
  }

  // ---------------------------------------------------------------------------
  // 4.1 DELEGADOS / COMPATIBILIDADE (SUBEMPRESAS / GRUPOS & LINHAS DE CUSTO)
  // ---------------------------------------------------------------------------
  async getSubempresas(filtro?: { apenasAtivos?: boolean }): Promise<Subempresa[]> { return []; }
  async getSubempresaById(id: string): Promise<Subempresa | null> { return null; }
  async createSubempresa(data: Omit<Subempresa, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subempresa> { throw new Error('Subempresas foram descontinuadas'); }
  async updateSubempresa(id: string, data: Partial<Subempresa>): Promise<Subempresa> { throw new Error('Subempresas foram descontinuadas'); }
  async deleteSubempresa(id: string): Promise<boolean> { return true; }
  async getGruposLinhaCusto(subempresaId?: string, filtro?: { apenasAtivos?: boolean }): Promise<GrupoLinhaCusto[]> { return []; }
  async createGrupoLinhaCusto(data: Omit<GrupoLinhaCusto, 'id' | 'createdAt' | 'updatedAt'>): Promise<GrupoLinhaCusto> { throw new Error('Descontinuado'); }
  async updateGrupoLinhaCusto(id: string, data: Partial<GrupoLinhaCusto>): Promise<GrupoLinhaCusto> { throw new Error('Descontinuado'); }
  async deleteGrupoLinhaCusto(id: string): Promise<boolean> { return true; }
  async getLinhasCusto(grupoLinhaCustoId?: string, filtro?: { apenasAtivos?: boolean }): Promise<LinhaCusto[]> { return []; }
  async createLinhaCusto(data: Omit<LinhaCusto, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinhaCusto> { throw new Error('Descontinuado'); }
  async updateLinhaCusto(id: string, data: Partial<LinhaCusto>): Promise<LinhaCusto> { throw new Error('Descontinuado'); }
  async deleteLinhaCusto(id: string): Promise<boolean> { return true; }

  // ---------------------------------------------------------------------------
  // 4.4 GRUPO DE GESTÃO
  // ---------------------------------------------------------------------------
  async getGruposGestao(filtro?: { apenasAtivos?: boolean }): Promise<GrupoGestao[]> {
    if (!this.client) return this.fallbackMock.getGruposGestao(filtro);
    const client = this.client;
    return this.cache.obter(`grupo_gestao:${JSON.stringify(filtro ?? {})}`, async () => {
    let query = client.from('grupo_gestao').select('*');
    if (filtro?.apenasAtivos !== false) query = query.eq('ativo', true);
    const { data } = await query.order('codigo');
    if (!data) return this.fallbackMock.getGruposGestao(filtro);

    return data.map(g => ({
      id: g.id,
      codigo: g.codigo,
      nome: g.nome,
      descricao: g.descricao,
      ativo: g.ativo,
      createdAt: g.created_at,
      updatedAt: g.updated_at
    }));
    });
  }

  async getGrupoGestaoById(id: string): Promise<GrupoGestao | null> {
    if (!this.client) return this.fallbackMock.getGrupoGestaoById(id);
    const { data } = await this.client.from('grupo_gestao').select('*').eq('id', id).single();
    if (!data) return null;
    return {
      id: data.id,
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async createGrupoGestao(data: Omit<GrupoGestao, 'id' | 'createdAt' | 'updatedAt'>): Promise<GrupoGestao> {
    if (!this.client) return this.fallbackMock.createGrupoGestao(data);
    const { data: inserted, error } = await this.client.from('grupo_gestao').insert({
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo ?? true
    }).select().single();
    this.cache.invalidar('grupo_gestao');   // só depois da escrita confirmada
    if (error || !inserted) throw new Error(error?.message || 'Erro ao criar grupo de gestão');
    return this.getGrupoGestaoById(inserted.id) as Promise<GrupoGestao>;
  }

  async updateGrupoGestao(id: string, data: Partial<GrupoGestao>): Promise<GrupoGestao> {
    if (!this.client) return this.fallbackMock.updateGrupoGestao(id, data);
    const { error } = await this.client.from('grupo_gestao').update({
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo
    }).eq('id', id);
    this.cache.invalidar('grupo_gestao');   // só depois da escrita confirmada
    if (error) throw new Error(error.message);
    return this.getGrupoGestaoById(id) as Promise<GrupoGestao>;
  }

  async deleteGrupoGestao(id: string): Promise<boolean> {
    if (!this.client) return this.fallbackMock.deleteGrupoGestao(id);
    const { error } = await this.client.from('grupo_gestao').update({ ativo: false }).eq('id', id);
    this.cache.invalidar('grupo_gestao');   // só depois da escrita confirmada
    return !error;
  }

  // ---------------------------------------------------------------------------
  // 4.5 LINHA DE GESTÃO
  // ---------------------------------------------------------------------------
  async getLinhasGestao(grupoGestaoId?: string, filtro?: { apenasAtivos?: boolean }): Promise<LinhaGestao[]> {
    if (!this.client) return this.fallbackMock.getLinhasGestao(grupoGestaoId, filtro);
    const client = this.client;
    return this.cache.obter(`linha_gestao:${grupoGestaoId ?? ''}:${JSON.stringify(filtro ?? {})}`, async () => {
    let query = client.from('linha_gestao').select('*');
    if (grupoGestaoId) query = query.eq('grupo_gestao_id', grupoGestaoId);
    if (filtro?.apenasAtivos !== false) query = query.eq('ativo', true);
    const { data } = await query.order('codigo');
    if (!data) return this.fallbackMock.getLinhasGestao(grupoGestaoId, filtro);

    return data.map(l => ({
      id: l.id,
      grupoGestaoId: l.grupo_gestao_id,
      codigo: l.codigo,
      nome: l.nome,
      descricao: l.descricao,
      ativo: l.ativo,
      createdAt: l.created_at,
      updatedAt: l.updated_at
    }));
    });
  }

  async getLinhaGestaoById(id: string): Promise<LinhaGestao | null> {
    if (!this.client) return this.fallbackMock.getLinhaGestaoById(id);
    const { data } = await this.client.from('linha_gestao').select('*').eq('id', id).single();
    if (!data) return null;
    return {
      id: data.id,
      grupoGestaoId: data.grupo_gestao_id,
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async createLinhaGestao(data: Omit<LinhaGestao, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinhaGestao> {
    if (!this.client) return this.fallbackMock.createLinhaGestao(data);
    const { data: inserted, error } = await this.client.from('linha_gestao').insert({
      grupo_gestao_id: data.grupoGestaoId,
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo ?? true
    }).select().single();
    this.cache.invalidar('linha_gestao');   // só depois da escrita confirmada
    if (error || !inserted) throw new Error(error?.message || 'Erro ao criar linha de gestão');
    return this.getLinhaGestaoById(inserted.id) as Promise<LinhaGestao>;
  }

  async updateLinhaGestao(id: string, data: Partial<LinhaGestao>): Promise<LinhaGestao> {
    if (!this.client) return this.fallbackMock.updateLinhaGestao(id, data);
    const { error } = await this.client.from('linha_gestao').update({
      grupo_gestao_id: data.grupoGestaoId,
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo
    }).eq('id', id);
    this.cache.invalidar('linha_gestao');   // só depois da escrita confirmada
    if (error) throw new Error(error.message);
    return this.getLinhaGestaoById(id) as Promise<LinhaGestao>;
  }

  async deleteLinhaGestao(id: string): Promise<boolean> {
    if (!this.client) return this.fallbackMock.deleteLinhaGestao(id);
    const { error: delError } = await this.client.from('linha_gestao').delete().eq('id', id);
    this.cache.invalidar('linha_gestao');   // só depois da escrita confirmada
    if (delError) {
      const { error: upError } = await this.client.from('linha_gestao').update({ ativo: false }).eq('id', id);
      return !upError;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // 5. MOTOR UNIFICADO DE TÍTULOS E PARCELAS (PERSISTÊNCIA REAL NO SUPABASE)
  // ---------------------------------------------------------------------------

  /**
   * Resolve o plano de contas do título garantindo coerência com o tipo:
   * 'R' só aceita conta de natureza receita, 'P' só aceita custo/despesa/investimento.
   *
   * Antes desta checagem o fallback pegava a primeira conta de qualquer natureza,
   * o que classificou todos os títulos a pagar do banco em "1.1.01 Locação de
   * equipamentos" (receita), invertendo o sinal de DRE, dashboard e orçamento.
   */
  private async resolverPlanoContaId(
    tipo: TipoTitulo,
    planoContaId?: string,
    pessoaId?: string | null
  ): Promise<string> {
    const naturezas = NATUREZAS_POR_TIPO[tipo];

    const informado = toUuidOrNull(planoContaId);
    if (informado) {
      const pc = await this.getPlanoContaById(informado);
      if (pc && naturezas.includes(pc.natureza)) return informado;
      if (pc) {
        throw new Error(
          `O plano de contas "${pc.codigo} ${pc.nome}" é de natureza "${pc.natureza}" e não pode ser usado em um título a ${tipo === 'R' ? 'receber' : 'pagar'}.`
        );
      }
    }

    if (pessoaId) {
      const pessoa = await this.getPessoaById(pessoaId);
      const padrao = toUuidOrNull(pessoa?.planoContaPadraoId);
      if (padrao) {
        const pc = await this.getPlanoContaById(padrao);
        if (pc && naturezas.includes(pc.natureza)) return padrao;
      }
    }

    const { data: pcs } = await this.client!
      .from('plano_conta')
      .select('id')
      .eq('aceita_lancamento', true)
      .eq('ativo', true)
      .in('natureza', naturezas)
      .order('codigo')
      .limit(1);

    if (pcs && pcs.length > 0) return pcs[0].id;

    throw new Error(
      `Nenhum plano de contas ativo de natureza ${naturezas.join(' / ')} foi encontrado. ` +
      'Cadastre o plano de contas antes de lançar títulos.'
    );
  }

  /**
   * Próximo código sequencial de título, com 6 dígitos.
   *
   * Parte do MAIOR código já gravado — e não da contagem de linhas, que
   * retrocedia sempre que um título era excluído fisicamente e gerava colisão
   * com a constraint UNIQUE.
   */
  private async proximoCodigoTitulo(): Promise<string> {
    const { data } = await this.client!
      .from('titulo')
      .select('codigo')
      .order('codigo', { ascending: false })
      .limit(1);

    const ultimo = data?.[0]?.codigo;
    const numero = ultimo && /^\d+$/.test(ultimo) ? parseInt(ultimo, 10) : 0;
    return String(numero + 1).padStart(6, '0');
  }

  /**
   * Monta a linha de rateio. `plano_conta_id` só entra se a coluna existir —
   * ela vem com a migration 08 e, sem essa checagem, o insert falha inteiro.
   */
  private async montarRateio(
    parcelaId: string,
    centroCustoId: string,
    rateio: { planoContaId?: string; percentual: number; valorCentavos: number },
    planoContaTituloId: string
  ): Promise<Record<string, unknown>> {
    const linha: Record<string, unknown> = {
      parcela_id: parcelaId,
      centro_custo_id: centroCustoId,
      percentual: rateio.percentual,
      valor: rateio.valorCentavos / 100,
    };

    // Plano de contas próprio da linha; sem ele, herda o do título.
    if (await this.temColuna('titulo_rateio', 'plano_conta_id')) {
      linha.plano_conta_id = toUuidOrNull(rateio.planoContaId) || planoContaTituloId;
    }

    return linha;
  }

  /** Diz se uma TABELA existe (mesma lógica de `temColuna`, para estrutura nova). */
  private async temTabela(tabela: string): Promise<boolean> {
    const chave = `tabela:${tabela}`;
    if (!this.colunasConhecidas.has(chave)) {
      this.colunasConhecidas.set(chave, (async () => {
        const { error } = await this.client!.from(tabela).select('id').limit(1);
        return !error;
      })());
    }
    return this.colunasConhecidas.get(chave)!;
  }

  /**
   * Grava o rateio gerencial do título.
   *
   * `titulo_rateio_gestao` vem com a migration 08. Enquanto ela não for
   * aplicada, o rateio não tem onde ser guardado por completo — então
   * preservamos ao menos a LINHA DOMINANTE (maior percentual) nas colunas
   * titulo.grupo_gestao_id / linha_gestao_id, que é o modelo antigo.
   * Nada se perde silenciosamente: quem tem uma linha só grava igual a antes.
   */
  private async gravarRateioGestao(
    tituloId: string,
    rateios: TituloInput['rateiosGestao']
  ): Promise<void> {
    if (!rateios || rateios.length === 0) return;
    if (!(await this.temTabela('titulo_rateio_gestao'))) return;

    await this.client!.from('titulo_rateio_gestao').delete().eq('titulo_id', tituloId);

    for (const r of rateios) {
      const { error } = await this.client!.from('titulo_rateio_gestao').insert({
        titulo_id: tituloId,
        grupo_gestao_id: toUuidOrNull(r.grupoGestaoId),
        linha_gestao_id: toUuidOrNull(r.linhaGestaoId),
        percentual: r.percentual,
        valor: r.valorCentavos / 100,
      });
      if (error) throw new Error(`Falha ao gravar o rateio gerencial: ${error.message}`);
    }
  }

  /** Linha de maior percentual — o que vai para as colunas do título. */
  private linhaGestaoDominante(rateios: TituloInput['rateiosGestao']) {
    if (!rateios || rateios.length === 0) return null;
    return rateios.reduce((a, b) => (b.percentual > a.percentual ? b : a));
  }

  async createTitulo(data: TituloInput): Promise<Titulo> {
    if (!this.client) return this.fallbackMock.createTitulo(data);

    const pessoaUuid = toUuidOrNull(data.pessoaId);
    if (!pessoaUuid) throw new Error('Selecione um Cliente ou Fornecedor válido.');

    const planoContaUuid = await this.resolverPlanoContaId(data.tipo, data.planoContaId, pessoaUuid);

    // A linha dominante do rateio gerencial alimenta as colunas do título.
    const dominante = this.linhaGestaoDominante(data.rateiosGestao);
    const grupoGestaoUuid = toUuidOrNull(dominante?.grupoGestaoId ?? data.grupoGestaoId);
    const linhaGestaoUuid = toUuidOrNull(dominante?.linhaGestaoId ?? data.linhaGestaoId);

    /*
     * O app gera o `codigo` e tenta de novo em caso de colisão.
     *
     * Havia uma versão que omitia o campo, delegando ao DEFAULT da sequence
     * criada na migration 08 — o que quebrava com "null value in column codigo"
     * em qualquer banco onde a migration ainda não tivesse sido aplicada.
     * Depender de migração pendente para uma operação básica não se paga.
     *
     * Difere do COUNT(*) original em dois pontos: parte do MAIOR código
     * existente (exclusão física de título não faz o contador retroceder) e
     * repete a tentativa quando a UNIQUE acusa concorrência.
     *
     * Quando a migration 08 entrar, este bloco pode voltar a delegar à sequence
     * — mas aí é preciso remover o `codigo` daqui, senão a sequence fica para
     * trás e um insert futuro sem código colidiria.
     */
    let insertedTitulo: { id: string; codigo: string } | null = null;
    let tErr: { message: string; code?: string } | null = null;

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = await this.proximoCodigoTitulo();

      const resultado = await this.client.from('titulo').insert({
        codigo,
        tipo: data.tipo,
        pessoa_id: pessoaUuid,
        grupo_gestao_id: grupoGestaoUuid,
        linha_gestao_id: linhaGestaoUuid,
        plano_conta_id: planoContaUuid,
        numero_documento: data.numeroDocumento || null,
        serie: data.serie || null,
        data_emissao: data.dataEmissao,
        data_competencia: data.dataCompetencia,
        valor_bruto: data.valorBrutoCentavos / 100,
        qtd_parcelas: data.qtdParcelas,
        descricao: data.descricao,
        observacao: data.observacao,
        ativo: true,
        created_by: data.usuario || null   // sem operador identificado, não inventa um nome
      }).select().single();

      if (!resultado.error) {
        insertedTitulo = resultado.data;
        break;
      }

      tErr = resultado.error;
      // 23505 = unique_violation: outro cadastro pegou o código. Só nesse caso repete.
      if (resultado.error.code !== '23505') break;
    }

    if (!insertedTitulo) throw new Error(tErr?.message || 'Erro ao criar título no Supabase');

    for (const p of data.parcelas) {
      const { data: insertedParcela, error: pErr } = await this.client.from('titulo_parcela').insert({
        titulo_id: insertedTitulo.id,
        numero: p.numero,
        data_vencimento: p.dataVencimento,
        valor: p.valorCentavos / 100,
        observacao: p.observacao,
        ativo: true
      }).select().single();

      // Antes era `continue`: a parcela falhava, o título ficava gravado com
      // menos parcelas do que declara em qtd_parcelas e o usuário via sucesso.
      if (pErr || !insertedParcela) {
        throw new Error(
          `Título ${insertedTitulo.codigo} gravado, mas a parcela ${p.numero} falhou: ` +
          `${pErr?.message ?? 'erro desconhecido'}. Revise o título antes de continuar.`
        );
      }

      if (p.rateios && p.rateios.length > 0) {
        for (const r of p.rateios) {
          const ccUuid = toUuidOrNull(r.centroCustoId) || '99999999-9999-9999-9999-999999999999';
          await this.client.from('titulo_rateio').insert(
            await this.montarRateio(insertedParcela.id, ccUuid, r, planoContaUuid)
          );
        }
      }
    }

    await this.gravarRateioGestao(insertedTitulo.id, data.rateiosGestao);

    const rec = await this.getTituloById(insertedTitulo.id);
    return rec || this.fallbackMock.createTitulo(data);
  }

  async updateTitulo(id: string, data: TituloInput): Promise<Titulo> {
    if (!this.client) return this.fallbackMock.updateTitulo(id, data);

    const pessoaUuid = toUuidOrNull(data.pessoaId);
    if (!pessoaUuid) throw new Error('Selecione um Cliente ou Fornecedor válido.');

    const planoContaUuid = await this.resolverPlanoContaId(data.tipo, data.planoContaId, pessoaUuid);

    // A linha dominante do rateio gerencial alimenta as colunas do título.
    const dominante = this.linhaGestaoDominante(data.rateiosGestao);
    const grupoGestaoUuid = toUuidOrNull(dominante?.grupoGestaoId ?? data.grupoGestaoId);
    const linhaGestaoUuid = toUuidOrNull(dominante?.linhaGestaoId ?? data.linhaGestaoId);

    const { error: tErr } = await this.client.from('titulo').update({
      pessoa_id: pessoaUuid,
      grupo_gestao_id: grupoGestaoUuid,
      linha_gestao_id: linhaGestaoUuid,
      plano_conta_id: planoContaUuid,
      numero_documento: data.numeroDocumento || null,
      serie: data.serie || null,
      data_emissao: data.dataEmissao,
      data_competencia: data.dataCompetencia,
      valor_bruto: data.valorBrutoCentavos / 100,
      qtd_parcelas: data.qtdParcelas,
      descricao: data.descricao,
      observacao: data.observacao,
      updated_at: new Date().toISOString(),
      updated_by: data.usuario || null
    }).eq('id', id);

    if (tErr) throw new Error(tErr.message);

    if (data.parcelas && data.parcelas.length > 0) {
      /*
       * A edição substitui as parcelas apagando as antigas. Isso é destrutivo e
       * precisa de duas guardas que não existiam:
       *
       * 1. Parcela com baixa não pode ser reestruturada. `movimento.parcela_id`
       *    é ON DELETE RESTRICT, então o DELETE falhava — mas o erro era
       *    descartado, os INSERTs seguintes colidiam com uq_titulo_parcela_numero
       *    e também eram descartados. Resultado: o cabeçalho do título era
       *    atualizado (valor, qtd_parcelas) e as parcelas continuavam as antigas,
       *    com a tela mostrando sucesso.
       *
       * 2. Todo erro precisa subir. Silenciar aqui é gravar dinheiro errado.
       */
      const { data: parcelasAtuais } = await this.client
        .from('titulo_parcela')
        .select('id')
        .eq('titulo_id', id);

      const idsAtuais = (parcelasAtuais ?? []).map((p: { id: string }) => p.id);

      if (idsAtuais.length > 0) {
        const { count: qtdBaixas } = await this.client
          .from('movimento')
          .select('id', { count: 'exact', head: true })
          .in('parcela_id', idsAtuais)
          .eq('estornado', false);

        if (qtdBaixas && qtdBaixas > 0) {
          throw new Error(
            'Este título já possui baixa registrada e suas parcelas não podem ser alteradas. ' +
            'Estorne o pagamento antes de reestruturar as parcelas.'
          );
        }
      }

      const { error: delErr } = await this.client.from('titulo_parcela').delete().eq('titulo_id', id);
      if (delErr) throw new Error(`Não foi possível substituir as parcelas: ${delErr.message}`);

      for (const p of data.parcelas) {
        const { data: insertedParcela, error: pErr } = await this.client.from('titulo_parcela').insert({
          titulo_id: id,
          numero: p.numero,
          data_vencimento: p.dataVencimento,
          valor: p.valorCentavos / 100,
          observacao: p.observacao,
          ativo: true
        }).select().single();

        if (pErr || !insertedParcela) {
          throw new Error(`Falha ao gravar a parcela ${p.numero}: ${pErr?.message ?? 'erro desconhecido'}.`);
        }

        for (const r of p.rateios ?? []) {
          const ccUuid = toUuidOrNull(r.centroCustoId) || '99999999-9999-9999-9999-999999999999';
          const { error: rErr } = await this.client.from('titulo_rateio').insert(
            await this.montarRateio(insertedParcela.id, ccUuid, r, planoContaUuid)
          );
          if (rErr) throw new Error(`Falha ao gravar o rateio da parcela ${p.numero}: ${rErr.message}`);
        }
      }
    }

    await this.gravarRateioGestao(id, data.rateiosGestao);

    const rec = await this.getTituloById(id);
    return rec || this.fallbackMock.updateTitulo(id, data);
  }

  async deleteTitulo(id: string): Promise<boolean> {
    if (!this.client) return this.fallbackMock.deleteTitulo(id);

    /*
     * Título com baixa não pode ser excluído. A exclusão é lógica (ativo = false),
     * então o título sumia das listagens mas o `movimento` continuava lá: o extrato
     * ficava com um pagamento sem título correspondente e o saldo não fechava.
     */
    const { data: parcelas } = await this.client
      .from('titulo_parcela')
      .select('id')
      .eq('titulo_id', id);

    const ids = (parcelas ?? []).map((p: { id: string }) => p.id);
    if (ids.length > 0) {
      const { count } = await this.client
        .from('movimento')
        .select('id', { count: 'exact', head: true })
        .in('parcela_id', ids)
        .eq('estornado', false);

      if (count && count > 0) {
        throw new Error(
          'Este título possui baixa registrada e não pode ser excluído. ' +
          'Estorne o pagamento antes de excluir.'
        );
      }
    }

    const { error } = await this.client.from('titulo').update({ ativo: false }).eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }

  /** Colunas do título com as dimensões e parcelas necessárias para montar `Titulo`. */
  private static readonly SELECT_TITULO = `
      *,
      pessoa:pessoa(*),
      plano_conta:plano_conta(*),
      grupo_gestao:grupo_gestao(*),
      linha_gestao:linha_gestao(*),
      titulo_parcela(*)
    `;

  async getTitulos(): Promise<Titulo[]> {
    if (!this.client) return this.fallbackMock.getTitulos();
    const { data } = await this.client
      .from('titulo')
      .select(SupabaseErpRepository.SELECT_TITULO)
      .eq('ativo', true)
      .order('created_at', { ascending: false });

    if (!data) return this.fallbackMock.getTitulos();

    return this.mapTitulos(data);
  }

  private mapTitulos(data: any[]): Titulo[] {
    return data.map(t => ({
      id: t.id,
      codigo: t.codigo,
      tipo: t.tipo,
      pessoaId: t.pessoa_id,
      pessoaNome: t.pessoa?.nome || 'Pessoa Desconhecida',
      grupoGestaoId: t.grupo_gestao_id,
      grupoGestaoNome: t.grupo_gestao?.nome,
      linhaGestaoId: t.linha_gestao_id,
      linhaGestaoNome: t.linha_gestao?.nome,
      planoContaId: t.plano_conta_id,
      planoContaNome: t.plano_conta ? `${t.plano_conta.codigo} ${t.plano_conta.nome}` : '',
      numeroDocumento: t.numero_documento,
      serie: t.serie,
      dataEmissao: t.data_emissao,
      dataCompetencia: t.data_competencia,
      valorBrutoCentavos: Math.round(Number(t.valor_bruto) * 100),
      qtdParcelas: t.qtd_parcelas,
      descricao: t.descricao,
      observacao: t.observacao,
      ativo: t.ativo,
      createdAt: t.created_at,
      createdBy: t.created_by,
      updatedAt: t.updated_at,
      updatedBy: t.updated_by,
      parcelas: (t.titulo_parcela || []).map((p: any) => ({
        id: p.id,
        tituloId: t.id,
        numero: p.numero,
        dataVencimento: p.data_vencimento,
        valorCentavos: Math.round(Number(p.valor) * 100),
        observacao: p.observacao,
        ativo: p.ativo,
        rateios: []
      }))
    }));
  }

  async getTituloById(id: string): Promise<Titulo | null> {
    if (!this.client) return this.fallbackMock.getTituloById(id);
    // Buscava TODOS os títulos e achava um por find(). Como createTitulo e
    // updateTitulo chamam este método no fim, cada gravação puxava a tabela inteira.
    const { data } = await this.client
      .from('titulo')
      .select(SupabaseErpRepository.SELECT_TITULO)
      .eq('id', id)
      .maybeSingle();

    if (!data) return null;
    const titulo = this.mapTitulos([data])[0];
    if (!titulo) return null;

    if (await this.temTabela('titulo_rateio_gestao')) {
      const { data: linhas } = await this.client
        .from('titulo_rateio_gestao')
        .select('*, grupo_gestao:grupo_gestao(nome), linha_gestao:linha_gestao(nome)')
        .eq('titulo_id', id);

      titulo.rateiosGestao = (linhas ?? []).map((l: any) => ({
        id: l.id,
        grupoGestaoId: l.grupo_gestao_id,
        grupoGestaoNome: l.grupo_gestao?.nome,
        linhaGestaoId: l.linha_gestao_id ?? undefined,
        linhaGestaoNome: l.linha_gestao?.nome,
        percentual: Number(l.percentual),
        valorCentavos: Math.round(Number(l.valor) * 100),
      }));
    }

    // Sem a tabela (ou sem linhas), o modelo antigo vira uma linha de 100%.
    if (!titulo.rateiosGestao?.length && titulo.grupoGestaoId) {
      titulo.rateiosGestao = [{
        grupoGestaoId: titulo.grupoGestaoId,
        grupoGestaoNome: titulo.grupoGestaoNome,
        linhaGestaoId: titulo.linhaGestaoId,
        linhaGestaoNome: titulo.linhaGestaoNome,
        percentual: 100,
        valorCentavos: titulo.valorBrutoCentavos,
      }];
    }

    return titulo;
  }

  async getParcelasView(tipo: TipoTitulo, filtro?: FiltroParcelas): Promise<ParcelaView[]> {
    if (!this.client) return this.fallbackMock.getParcelasView(tipo, filtro);

    // Os filtros vão para o Postgres, não para o JavaScript. Antes, esta consulta
    // baixava a tabela inteira a cada mudança de filtro e recortava em memória.
    //
    // `titulo!inner` é obrigatório: sem o !inner o PostgREST aplica o filtro apenas
    // ao objeto aninhado e devolve TODAS as parcelas do mesmo jeito (verificado:
    // titulo.tipo=eq.R sem !inner retornava as 4 parcelas de tipo 'P').
    let query = this.client.from('titulo_parcela').select(`
      *,
      titulo:titulo!inner(
        *,
        pessoa:pessoa(*),
        plano_conta:plano_conta(*),
        grupo_gestao:grupo_gestao(*),
        linha_gestao:linha_gestao(*)
      ),
      movimento(*)
    `)
      .eq('ativo', true)
      .eq('titulo.ativo', true)
      .eq('titulo.tipo', tipo);

    if (filtro?.pessoaId)          query = query.eq('titulo.pessoa_id', filtro.pessoaId);
    if (filtro?.grupoGestaoId)     query = query.eq('titulo.grupo_gestao_id', filtro.grupoGestaoId);
    if (filtro?.linhaGestaoId)     query = query.eq('titulo.linha_gestao_id', filtro.linhaGestaoId);
    if (filtro?.planoContaId)      query = query.eq('titulo.plano_conta_id', filtro.planoContaId);
    if (filtro?.dataVencimentoDe)  query = query.gte('data_vencimento', filtro.dataVencimentoDe);
    if (filtro?.dataVencimentoAte) query = query.lte('data_vencimento', filtro.dataVencimentoAte);

    const { data: rawParcelas } = await query.order('data_vencimento', { ascending: true });

    if (!rawParcelas) return this.fallbackMock.getParcelasView(tipo, filtro);

    const hojeStr = new Date().toISOString().split('T')[0];

    const views: ParcelaView[] = rawParcelas
      .filter((p: any) => p.titulo)   // ativo e tipo já vieram filtrados do banco
      .map((p: any) => {
        const t = p.titulo;
        const movs = (p.movimento || []).filter((m: any) => !m.estornado);
        const valorBaixadoCentavos = movs.reduce((s: number, m: any) => s + Math.round(Number(m.valor_pago) * 100), 0);
        const valorCentavos = Math.round(Number(p.valor) * 100);
        const saldoCentavos = Math.max(0, valorCentavos - valorBaixadoCentavos);

        let status: 'aberto' | 'parcial' | 'pago' | 'vencido' | 'cancelado' = 'aberto';
        if (saldoCentavos === 0) status = 'pago';
        else if (valorBaixadoCentavos > 0) status = 'parcial';
        else if (p.data_vencimento < hojeStr) status = 'vencido';

        const diasAtraso = status === 'vencido' 
          ? Math.max(0, Math.floor((new Date(hojeStr).getTime() - new Date(p.data_vencimento).getTime()) / 86400000)) 
          : 0;

        return {
          parcelaId: p.id,
          tituloId: t.id,
          tituloCodigo: t.codigo,
          tipo: t.tipo,
          pessoaId: t.pessoa_id,
          pessoaNome: t.pessoa?.nome || 'Pessoa Desconhecida',
          pessoaCpfCnpj: t.pessoa?.cpf_cnpj || '',
          grupoGestaoId: t.grupo_gestao_id,
          grupoGestaoNome: t.grupo_gestao?.nome,
          linhaGestaoId: t.linha_gestao_id,
          linhaGestaoNome: t.linha_gestao?.nome,
          planoContaId: t.plano_conta_id,
          planoContaCodigo: t.plano_conta?.codigo || '',
          planoContaNome: t.plano_conta?.nome || '',
          planoContaNatureza: t.plano_conta?.natureza,
          numeroDocumento: t.numero_documento,
          serie: t.serie,
          descricao: t.descricao || t.observacao || 'Lançamento financeiro',
          dataEmissao: t.data_emissao,
          dataCompetencia: t.data_competencia,
          parcelaNumero: p.numero,
          qtdParcelas: t.qtd_parcelas,
          dataVencimento: p.data_vencimento,
          valorCentavos,
          valorBaixadoCentavos,
          saldoCentavos,
          status,
          diasAtraso,
          centrosCustoFormatado: 'Não alocado',
          ativo: p.ativo,
          createdAt: t.created_at,
          createdBy: t.created_by,
          updatedAt: t.updated_at,
          updatedBy: t.updated_by
        };
      });

    // Só sobram em memória os dois filtros que o PostgREST não expressa:
    //   • status  — derivado da soma dos movimentos não estornados
    //   • busca   — precisa de OR entre colunas de dois níveis de aninhamento
    //               (titulo.codigo/numero_documento e titulo.pessoa.nome/cpf_cnpj)
    // Ambos passam a operar sobre um conjunto já recortado pelo banco.
    // Quando a view_parcelas_detalhadas (migration 08) estiver no ar, os dois
    // também podem descer para o Postgres.
    let result = views;
    if (filtro?.status) result = result.filter(v => v.status === filtro.status);
    if (filtro?.searchTerm) {
      const st = filtro.searchTerm.toLowerCase();
      result = result.filter(v => 
        v.tituloCodigo.toLowerCase().includes(st) || 
        v.pessoaNome.toLowerCase().includes(st) || 
        v.pessoaCpfCnpj.includes(st) ||
        (v.numeroDocumento && v.numeroDocumento.toLowerCase().includes(st)) ||
        (v.descricao && v.descricao.toLowerCase().includes(st))
      );
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // 6. CAIXA & MOVIMENTOS / BAIXAS (PERSISTÊNCIA REAL NO SUPABASE)
  // ---------------------------------------------------------------------------
  async createMovimento(data: any): Promise<Movimento> {
    if (!this.client) return this.fallbackMock.createMovimento(data);

    const valorPagoCentavos = data.valorPagoCentavos || 0;
    const jurosCentavos = data.jurosCentavos || 0;
    const multaCentavos = data.multaCentavos || 0;
    const descontoCentavos = data.descontoCentavos || 0;
    const valorLiquidoCentavos = valorPagoCentavos + jurosCentavos + multaCentavos - descontoCentavos;

    const contaUuid = toUuidOrNull(data.contaBancariaId);
    if (!contaUuid) throw new Error('Selecione uma Conta Bancária válida.');

    const parcelaUuid = toUuidOrNull(data.parcelaId);
    const planoContaUuid = toUuidOrNull(data.planoContaId);
    const centroCustoUuid = toUuidOrNull(data.centroCustoId);

    /*
     * Revalidação de saldo no servidor. A checagem existia só no modal, então
     * duas abas abertas (ou um duplo clique) baixavam a mesma parcela duas vezes.
     * Aqui a janela de corrida fica muito menor; a garantia definitiva é o
     * trigger trg_valida_saldo_movimento, criado na migration 08.
     */
    if (parcelaUuid) {
      const { data: parcela } = await this.client
        .from('titulo_parcela')
        .select('valor')
        .eq('id', parcelaUuid)
        .maybeSingle();

      if (!parcela) throw new Error('Parcela não encontrada.');

      const { data: movs } = await this.client
        .from('movimento')
        .select('valor_pago')
        .eq('parcela_id', parcelaUuid)
        .eq('estornado', false);

      const baixadoCentavos = (movs ?? []).reduce(
        (s: number, m: { valor_pago: number }) => s + Math.round(Number(m.valor_pago) * 100),
        0
      );
      const saldoCentavos = Math.round(Number(parcela.valor) * 100) - baixadoCentavos;

      if (valorPagoCentavos > saldoCentavos) {
        throw new Error(
          `O valor pago excede o saldo da parcela. Saldo em aberto: ` +
          `R$ ${(saldoCentavos / 100).toFixed(2).replace('.', ',')}. ` +
          'Talvez a baixa já tenha sido registrada em outra aba.'
        );
      }
    }

    const cb = await this.getContaBancariaById(contaUuid);

    const { data: inserted, error } = await this.client.from('movimento').insert({
      parcela_id: parcelaUuid,
      data_pagamento: data.dataPagamento,
      valor_pago: valorPagoCentavos / 100,
      juros: jurosCentavos / 100,
      multa: multaCentavos / 100,
      desconto: descontoCentavos / 100,
      valor_liquido: valorLiquidoCentavos / 100,
      conta_bancaria_id: contaUuid,
      plano_conta_id: planoContaUuid,
      centro_custo_id: centroCustoUuid,
      forma_pagamento: data.formaPagamento || 'pix',
      numero_documento: data.numeroDocumento || null,
      observacao: data.observacao || null,
      estornado: false,
      // Antes era fixo em "Fabrício (Administrador)", o que atribuía toda baixa
      // a um usuário que nem é o operador logado.
      created_by: data.usuario || null
    }).select().single();

    if (error || !inserted) throw new Error(error?.message || 'Erro ao registrar movimento no Supabase');

    return {
      id: inserted.id,
      parcelaId: inserted.parcela_id,
      dataPagamento: inserted.data_pagamento,
      valorPagoCentavos: Math.round(Number(inserted.valor_pago) * 100),
      jurosCentavos: Math.round(Number(inserted.juros) * 100),
      multaCentavos: Math.round(Number(inserted.multa) * 100),
      descontoCentavos: Math.round(Number(inserted.desconto) * 100),
      valorLiquidoCentavos: Math.round(Number(inserted.valor_liquido) * 100),
      contaBancariaId: inserted.conta_bancaria_id,
      contaBancariaNome: cb?.nome || 'Conta Bancária',
      formaPagamento: inserted.forma_pagamento,
      numeroDocumento: inserted.numero_documento,
      observacao: inserted.observacao,
      estornado: inserted.estornado,
      createdAt: inserted.created_at,
      createdBy: inserted.created_by
    };
  }

  async createBaixaEmLote(data: {
    parcelaIds: string[];
    dataPagamento: string;
    contaBancariaId: string;
    formaPagamento: FormaPagamentoMovimento;
    usuario?: string;
  }): Promise<Movimento[]> {
    if (!this.client) return this.fallbackMock.createBaixaEmLote(data);

    const criados: Movimento[] = [];
    for (const pId of data.parcelaIds) {
      const { data: par } = await this.client.from('titulo_parcela').select('*').eq('id', pId).single();
      if (!par) continue;

      const { data: movs } = await this.client.from('movimento').select('valor_pago').eq('parcela_id', pId).eq('estornado', false);
      const baixadoCentavos = (movs || []).reduce((s: number, m: any) => s + Math.round(Number(m.valor_pago) * 100), 0);
      const valParcelaCentavos = Math.round(Number(par.valor) * 100);
      const saldoCentavos = Math.max(0, valParcelaCentavos - baixadoCentavos);

      if (saldoCentavos > 0) {
        const m = await this.createMovimento({
          parcelaId: pId,
          dataPagamento: data.dataPagamento,
          valorPagoCentavos: saldoCentavos,
          contaBancariaId: data.contaBancariaId,
          formaPagamento: data.formaPagamento,
          observacao: 'Baixa efetuada via lote no Supabase',
          usuario: data.usuario
        });
        criados.push(m);
      }
    }

    return criados;
  }

  async estornarMovimento(movimentoId: string, motivo: string, usuario?: string): Promise<Movimento> {
    if (!this.client) return this.fallbackMock.estornarMovimento(movimentoId, motivo, usuario);

    const { data: updated, error } = await this.client.from('movimento').update({
      estornado: true,
      estornado_em: new Date().toISOString(),
      estornado_por: usuario || null,
      motivo_estorno: motivo
    }).eq('id', movimentoId).select().single();

    if (error || !updated) throw new Error(error?.message || 'Erro ao estornar movimento');

    const cb = await this.getContaBancariaById(updated.conta_bancaria_id);
    return {
      id: updated.id,
      parcelaId: updated.parcela_id,
      dataPagamento: updated.data_pagamento,
      valorPagoCentavos: Math.round(Number(updated.valor_pago) * 100),
      jurosCentavos: Math.round(Number(updated.juros) * 100),
      multaCentavos: Math.round(Number(updated.multa) * 100),
      descontoCentavos: Math.round(Number(updated.desconto) * 100),
      valorLiquidoCentavos: Math.round(Number(updated.valor_liquido) * 100),
      contaBancariaId: updated.conta_bancaria_id,
      contaBancariaNome: cb?.nome || 'Conta Bancária',
      formaPagamento: updated.forma_pagamento,
      numeroDocumento: updated.numero_documento,
      observacao: updated.observacao,
      estornado: updated.estornado,
      estornadoEm: updated.estornado_em,
      estornadoPor: updated.estornado_por,
      motivoEstorno: updated.motivo_estorno,
      createdAt: updated.created_at,
      createdBy: updated.created_by
    };
  }
  async getMovimentosPorParcela(parcelaId: string): Promise<Movimento[]> { return this.fallbackMock.getMovimentosPorParcela(parcelaId); }
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    if (!this.client) return this.fallbackMock.getDashboardMetrics();

    const parcelasPagar = await this.getParcelasView('P');
    const totalPagarCentavos = parcelasPagar
      .filter(p => p.status !== 'pago' && p.status !== 'cancelado')
      .reduce((sum, p) => sum + p.saldoCentavos, 0);

    const parcelasReceber = await this.getParcelasView('R');
    const totalReceberCentavos = parcelasReceber
      .filter(p => p.status !== 'pago' && p.status !== 'cancelado')
      .reduce((sum, p) => sum + p.saldoCentavos, 0);

    const saldoProjetadoCentavos = totalReceberCentavos - totalPagarCentavos;

    return {
      totalPagarCentavos,
      totalReceberCentavos,
      saldoProjetadoCentavos,
      orcamentosPendentesCount: 0,
      orcamentosPorStatus: [],
      fluxoMensal: []
    };
  }

  async getDashboardExecutiveData(filtro: FiltroDashboard): Promise<DashboardExecutiveData> {
    if (!this.client) return this.fallbackMock.getDashboardExecutiveData(filtro);

    const hojeStr = new Date().toISOString().split('T')[0];
    const em30DiasStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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

    const contas = await this.getContasBancarias({ apenasAtivos: true });
    const saldoConsolidadoHojeCentavos = contas.reduce((sum, cb) => sum + cb.saldoInicialCentavos, 0);

    const aReceber30DiasCentavos = parcelasReceber30.reduce((sum, p) => sum + p.saldoCentavos, 0);
    const aPagar30DiasCentavos = parcelasPagar30.reduce((sum, p) => sum + p.saldoCentavos, 0);
    const resultadoProjetado30DiasCentavos = aReceber30DiasCentavos - aPagar30DiasCentavos;

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
      curva90Dias: [],
      despesasPorCentroCusto: [],
      despesasPorPlanoContaNivel2: [],
      top5Fornecedores: [],
      top5Clientes: []
    };
  }

  async getFluxoCaixa(filtro: FiltroFluxoCaixa): Promise<FluxoCaixaResultado> { return this.fallbackMock.getFluxoCaixa(filtro); }
  async getOrcamentos(filtro?: any): Promise<Orcamento[]> { return this.fallbackMock.getOrcamentos(filtro); }
  async getOrcamentoById(id: string): Promise<Orcamento | null> { return this.fallbackMock.getOrcamentoById(id); }
  async createOrcamento(data: any): Promise<Orcamento> { return this.fallbackMock.createOrcamento(data); }
  async updateOrcamento(id: string, data: any): Promise<Orcamento> { return this.fallbackMock.updateOrcamento(id, data); }
  async aprovarOrcamento(id: string, usuario?: string): Promise<Orcamento> { return this.fallbackMock.aprovarOrcamento(id, usuario); }
  async criarRevisaoOrcamento(id: string, motivoRevisao: string, usuario?: string): Promise<Orcamento> { return this.fallbackMock.criarRevisaoOrcamento(id, motivoRevisao, usuario); }
  async getOrcamentosEmpreendimento(filtro?: any): Promise<OrcamentoEmpreendimento[]> { return this.fallbackMock.getOrcamentosEmpreendimento(filtro); }
  async createOrcamentoEmpreendimento(data: any): Promise<OrcamentoEmpreendimento> { return this.fallbackMock.createOrcamentoEmpreendimento(data); }
  async updateOrcamentoEmpreendimento(id: string, data: any): Promise<OrcamentoEmpreendimento> { return this.fallbackMock.updateOrcamentoEmpreendimento(id, data); }
  async aprovarOrcamentoEmpreendimento(id: string, usuario?: string): Promise<OrcamentoEmpreendimento> { return this.fallbackMock.aprovarOrcamentoEmpreendimento(id, usuario); }
  async getOrcamentoExecucao(orcamentoId: string, dataCorte?: string): Promise<OrcamentoExecucaoView> { return this.fallbackMock.getOrcamentoExecucao(orcamentoId, dataCorte); }
  async validarDisponibilidadeOrcamentaria(centroCustoId: string, planoContaId: string, valorCentavos: number): Promise<DisponibilidadeOrcamentariaResultado> { return this.fallbackMock.validarDisponibilidadeOrcamentaria(centroCustoId, planoContaId, valorCentavos); }
  async getRecorrencias(filtro?: any): Promise<Recorrencia[]> { return this.fallbackMock.getRecorrencias(filtro); }
  async getRecorrenciaById(id: string): Promise<Recorrencia | null> { return this.fallbackMock.getRecorrenciaById(id); }
  async createRecorrencia(data: any): Promise<Recorrencia> { return this.fallbackMock.createRecorrencia(data); }
  async updateRecorrencia(id: string, data: any): Promise<Recorrencia> { return this.fallbackMock.updateRecorrencia(id, data); }
  async pausarRecorrencia(id: string): Promise<Recorrencia> { return this.fallbackMock.pausarRecorrencia(id); }
  async reativarRecorrencia(id: string): Promise<Recorrencia> { return this.fallbackMock.reativarRecorrencia(id); }
  async encerrarRecorrencia(id: string): Promise<Recorrencia> { return this.fallbackMock.encerrarRecorrencia(id); }
  async calcularProximasOcorrencias(recorrencia: any, qtd?: number): Promise<ProximaOcorrenciaPrevia[]> { return this.fallbackMock.calcularProximasOcorrencias(recorrencia, qtd); }
  async gerarOcorrencia(recorrenciaId: string, competencia: string, origem: 'automatico' | 'manual', motivo?: string): Promise<any> { return this.fallbackMock.gerarOcorrencia(recorrenciaId, competencia, origem, motivo); }
  async processarFila(dataReferencia?: string): Promise<LogExecucaoFila> { return this.fallbackMock.processarFila(dataReferencia); }
  async pularOcorrencia(recorrenciaId: string, competencia: string, motivo: string): Promise<RecorrenciaOcorrencia> { return this.fallbackMock.pularOcorrencia(recorrenciaId, competencia, motivo); }
  async preencherValorTituloVariavel(tituloId: string, valorBrutoCentavos: number): Promise<Titulo> { return this.fallbackMock.preencherValorTituloVariavel(tituloId, valorBrutoCentavos); }
  async aplicarReajusteEmLote(recorrenciaIds: string[], percentual: number, indice?: string, observacao?: string): Promise<RecorrenciaReajuste[]> { return this.fallbackMock.aplicarReajusteEmLote(recorrenciaIds, percentual, indice, observacao); }
  async getOcorrenciasByRecorrencia(recorrenciaId: string): Promise<RecorrenciaOcorrencia[]> { return this.fallbackMock.getOcorrenciasByRecorrencia(recorrenciaId); }
  async getReajustesByRecorrencia(recorrenciaId: string): Promise<RecorrenciaReajuste[]> { return this.fallbackMock.getReajustesByRecorrencia(recorrenciaId); }
  async getLogsExecucaoFila(): Promise<LogExecucaoFila[]> { return this.fallbackMock.getLogsExecucaoFila(); }
  async getFeriados(): Promise<Feriado[]> { return this.fallbackMock.getFeriados(); }
  async parseEPreviewOFX(contaBancariaId: string, conteudoOFXText: string, arquivoNome: string): Promise<PreviewImportacaoOFX> { return this.fallbackMock.parseEPreviewOFX(contaBancariaId, conteudoOFXText, arquivoNome); }
  async confirmarImportacaoOFX(contaBancariaId: string, preview: PreviewImportacaoOFX): Promise<ExtratoImportacao> { return this.fallbackMock.confirmarImportacaoOFX(contaBancariaId, preview); }
  async executarMotorCasamento(contaBancariaId: string): Promise<any> { return this.fallbackMock.executarMotorCasamento(contaBancariaId); }
  async conciliarTodosNivel1_100Percent(contaBancariaId: string): Promise<any> { return this.fallbackMock.conciliarTodosNivel1_100Percent(contaBancariaId); }
  async conciliarAgrupados(extratoLancamentoId: string, movimentoIds: string[]): Promise<void> { return this.fallbackMock.conciliarAgrupados(extratoLancamentoId, movimentoIds); }
  async ignorarLancamentoExtrato(extratoLancamentoId: string, motivo: string): Promise<void> { return this.fallbackMock.ignorarLancamentoExtrato(extratoLancamentoId, motivo); }
  async criarRegraConciliacao(data: any): Promise<ConciliacaoRegra> { return this.fallbackMock.criarRegraConciliacao(data); }
  async getRegrasConciliacao(contaBancariaId?: string): Promise<ConciliacaoRegra[]> { return this.fallbackMock.getRegrasConciliacao(contaBancariaId); }
  async getResumoSaldosConciliacaoEtapa9(contaBancariaId: string): Promise<ResumoSaldosConciliacaoEtapa9> { return this.fallbackMock.getResumoSaldosConciliacaoEtapa9(contaBancariaId); }
  async importarExtratoOFX(contaBancariaId: string, itens: any[]): Promise<any> { return this.fallbackMock.importarExtratoOFX(contaBancariaId, itens); }
  async getExtratoBancario(contaBancariaId: string, filtro?: any): Promise<ExtratoBancarioItem[]> { return this.fallbackMock.getExtratoBancario(contaBancariaId, filtro); }
  async getResumoSaldosConciliacao(contaBancariaId: string): Promise<ResumoSaldosConciliacao> { return this.fallbackMock.getResumoSaldosConciliacao(contaBancariaId); }
  async autoConciliarInteligente(contaBancariaId: string): Promise<any> { return this.fallbackMock.autoConciliarInteligente(contaBancariaId); }
  async conciliarManual(extratoItemId: string, movimentoId: string): Promise<void> { return this.fallbackMock.conciliarManual(extratoItemId, movimentoId); }
  async desconciliar(extratoItemId: string, motivo?: string): Promise<void> { return this.fallbackMock.desconciliar(extratoItemId, motivo); }
  async criarMovimentoAvulso(data: any): Promise<Movimento> { return this.fallbackMock.criarMovimentoAvulso(data); }
  async getLogsConciliacao(contaBancariaId?: string): Promise<ConciliacaoLog[]> { return this.fallbackMock.getLogsConciliacao(contaBancariaId); }
  async simularGeracaoRetroativa(recorrenciaId?: string, ateData?: string): Promise<GeracaoRetroativaSimulacaoResultado> { return this.fallbackMock.simularGeracaoRetroativa(recorrenciaId, ateData); }
  async gerarTitulosRecorrentes(recorrenciaId?: string, ateData?: string): Promise<any> { return this.fallbackMock.gerarTitulosRecorrentes(recorrenciaId, ateData); }
  async getClientes(): Promise<Cliente[]> { return this.fallbackMock.getClientes(); }
  async createCliente(data: any): Promise<Cliente> { return this.fallbackMock.createCliente(data); }
  async updateCliente(id: string, data: any): Promise<Cliente> { return this.fallbackMock.updateCliente(id, data); }
  async deleteCliente(id: string): Promise<boolean> { return this.fallbackMock.deleteCliente(id); }
  async getFornecedores(): Promise<Fornecedor[]> { return this.fallbackMock.getFornecedores(); }
  async createFornecedor(data: any): Promise<Fornecedor> { return this.fallbackMock.createFornecedor(data); }
  async updateFornecedor(id: string, data: any): Promise<Fornecedor> { return this.fallbackMock.updateFornecedor(id, data); }
  async deleteFornecedor(id: string): Promise<boolean> { return this.fallbackMock.deleteFornecedor(id); }
  async getContasPagar(): Promise<ContaPagar[]> { return this.fallbackMock.getContasPagar(); }
  async createContaPagar(data: any): Promise<ContaPagar> { return this.fallbackMock.createContaPagar(data); }
  async updateContaPagar(id: string, data: any): Promise<ContaPagar> { return this.fallbackMock.updateContaPagar(id, data); }
  async deleteContaPagar(id: string): Promise<boolean> { return this.fallbackMock.deleteContaPagar(id); }
  async getContasReceber(): Promise<ContaReceber[]> { return this.fallbackMock.getContasReceber(); }
  async createContaReceber(data: any): Promise<ContaReceber> { return this.fallbackMock.createContaReceber(data); }
  async updateContaReceber(id: string, data: any): Promise<ContaReceber> { return this.fallbackMock.updateContaReceber(id, data); }
  async deleteContaReceber(id: string): Promise<boolean> { return this.fallbackMock.deleteContaReceber(id); }
  async getOrcamentosDAV(): Promise<OrcamentoDAV[]> { return this.fallbackMock.getOrcamentosDAV(); }
  async createOrcamentoDAV(data: any): Promise<OrcamentoDAV> { return this.fallbackMock.createOrcamentoDAV(data); }
  async updateOrcamentoDAV(id: string, data: any): Promise<OrcamentoDAV> { return this.fallbackMock.updateOrcamentoDAV(id, data); }
  async deleteOrcamentoDAV(id: string): Promise<boolean> { return this.fallbackMock.deleteOrcamentoDAV(id); }
}

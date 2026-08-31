import { supabase, isSupabaseConfigured, supabaseProjectRef } from '@/lib/supabase/client';
import { IErpRepository, TituloInput, FiltroParcelas } from '../repository.interface';
import { MockErpRepository } from '../mock/mock.repository';
import { rateiosDoItem, rateiosSemItem, RateioCasado } from '../orcamento/casamento-rateio';
import { mensagemRecusaExclusao } from '../orcamento/exclusao-orcamento';
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
  TituloRateio,
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
  OrcamentoExecucaoItemView,
  ComprometidoTituloItem,
  RealizadoMovimentoItem,
  StatusOrcamentoEmpreendimento,
  Orcamento,
  ExclusaoOrcamentoPrevia,
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

/**
 * Erro de coluna ausente da migration 09.
 *
 * As colunas novas são checadas antes de gravar (`temColuna`) para não derrubar
 * o insert inteiro em banco desatualizado. Mas simplesmente ignorá-las apagaria
 * em silêncio uma escolha que o usuário acabou de fazer na tela — foi assim que
 * o plano de contas por linha de rateio se perdeu antes da migration 08.
 *
 * Quando o campo veio preenchido e a coluna não existe, o certo é recusar a
 * gravação e dizer o que falta.
 *
 * A mensagem NOMEIA o projeto Supabase. Há dois bancos com o mesmo schema, e as
 * credenciais são NEXT_PUBLIC_* — gravadas no build. Um deploy publicado com as
 * variáveis antigas fala com o banco antigo mesmo depois da migration aplicada
 * no certo, e sem o `ref` na tela isso parece "a migration não pegou".
 */
/**
 * O vínculo do centro de custo com a Linha de Gestão depende da migration 10.
 *
 * Mesma regra do erro acima: campo PREENCHIDO com coluna ausente vira recusa,
 * nunca descarte silencioso. Sem isto, escolher a Linha e salvar devolvia
 * sucesso, perdia o vínculo, e a Apropriação depois mandava o usuário fazer
 * exatamente o que ele acabara de fazer.
 */
function erroMigration10(): Error {
  return new Error(
    'O vínculo com a Linha de Gestão não pôde ser gravado: o banco em uso (projeto Supabase ' +
    `"${supabaseProjectRef}") não tem a migration 10 ` +
    '(supabase/migrations/10_centro_custo_linha_gestao.sql). ' +
    'Rode-a no Supabase → SQL Editor e tente de novo.'
  );
}

function erroMigration09(oQue: string): Error {
  return new Error(
    `${oQue} não pôde ser gravado: o banco em uso (projeto Supabase ` +
    `"${supabaseProjectRef}") não tem a migration 09 ` +
    '(supabase/migrations/09_obra_unidade_item_orcamento.sql). ' +
    'Se esse é o projeto certo, rode a migration no Supabase → SQL Editor. ' +
    'Se não é, corrija NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
    'no ambiente (na Vercel, exige REDEPLOY: essas variáveis entram no build).'
  );
}

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
export const NATUREZAS_POR_TIPO: Record<TipoTitulo, NaturezaPlanoConta[]> = {
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
          if (!error) return true;

          /*
           * Só o erro 42703 ("undefined_column") significa que a coluna não
           * existe. Antes, QUALQUER erro — rede caída, RLS, timeout — era lido
           * como ausência e ficava memorizado para a sessão inteira. Com as
           * gravações novas recusando o salvamento quando a coluna falta, uma
           * falha passageira travaria todo o cadastro até dar F5, dizendo ao
           * usuário para rodar uma migration que já está aplicada.
           */
          const codigo = (error as { code?: string }).code;
          if (codigo === '42703' || /does not exist/i.test(error.message ?? '')) {
            this.colunasConhecidas.delete(chave);
            return false;
          }

          // Erro de outra natureza: não memoriza e assume que a coluna existe.
          this.colunasConhecidas.delete(chave);
          return true;
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

  async getPlanoContasFolhas(natureza?: string | string[]): Promise<PlanoConta[]> {
    if (!this.client) return this.fallbackMock.getPlanoContasFolhas(natureza);
    const client = this.client;
    return this.cache.obter(`plano_conta:folhas:${natureza ?? ''}`, async () => {
    let query = client.from('plano_conta').select('*').eq('aceita_lancamento', true).eq('ativo', true);
    // Aceita uma natureza ou várias: contas a pagar precisam de custo,
    // despesa e investimento ao mesmo tempo.
    if (Array.isArray(natureza)) query = query.in('natureza', natureza);
    else if (natureza) query = query.eq('natureza', natureza);
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
      linhaGestaoId: cc.linha_gestao_id ?? null,
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
      linhaGestaoId: cc.linha_gestao_id ?? null,
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
      linhaGestaoId: data.linha_gestao_id ?? null,
      dataInicio: data.data_inicio,
      dataFim: data.data_fim,
      ativo: data.ativo,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async createCentroCusto(data: Omit<CentroCusto, 'id' | 'createdAt' | 'updatedAt' | 'gastoCentavos'>): Promise<CentroCusto> {
    if (!this.client) return this.fallbackMock.createCentroCusto(data);
    const linha: Record<string, unknown> = {
      codigo: data.codigo,
      nome: data.nome,
      parent_id: data.parentId || null,
      tipo: data.tipo,
      nivel: data.nivel,
      aceita_lancamento: data.aceitaLancamento,
      data_inicio: data.dataInicio || null,
      data_fim: data.dataFim || null,
      ativo: data.ativo ?? true
    };
    // Coluna da migration 10: sem a guarda, o insert inteiro falharia no banco
    // que ainda não a recebeu. Mas vínculo escolhido não se perde calado.
    if (await this.temColuna('centro_custo', 'linha_gestao_id')) {
      linha.linha_gestao_id = toUuidOrNull(data.linhaGestaoId);
    } else if (toUuidOrNull(data.linhaGestaoId)) {
      throw erroMigration10();
    }

    const { data: inserted, error } = await this.client.from('centro_custo').insert(linha).select().single();
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
    if (data.linhaGestaoId !== undefined) {
      if (await this.temColuna('centro_custo', 'linha_gestao_id')) {
        payload.linha_gestao_id = toUuidOrNull(data.linhaGestaoId);
      } else if (toUuidOrNull(data.linhaGestaoId)) {
        throw erroMigration10();
      }
    }
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
    let query = client.from('linha_gestao').select(await this.selectLinhaGestao());
    if (grupoGestaoId) query = query.eq('grupo_gestao_id', grupoGestaoId);
    if (filtro?.apenasAtivos !== false) query = query.eq('ativo', true);
    const { data } = await query.order('codigo');
    if (!data) return this.fallbackMock.getLinhasGestao(grupoGestaoId, filtro);

    return (data as any[]).map((l: any) => this.mapLinhaGestao(l));
    });
  }

  /**
   * Colunas da Linha de Gestão. A obra vinculada (`centro_custo_id`) só vem com
   * a migration 09 — pedir o relacionamento antes disso derruba a consulta
   * inteira e o combo de linhas de gestão fica vazio em todas as telas.
   */
  private async selectLinhaGestao(): Promise<string> {
    const base = '*, grupo_gestao:grupo_gestao_id (id, codigo, nome)';
    if (!(await this.temColuna('linha_gestao', 'centro_custo_id'))) return base;
    return `${base}, centro_custo:centro_custo_id (id, codigo, nome)`;
  }

  private mapLinhaGestao(l: any): LinhaGestao {
    return {
      id: l.id,
      grupoGestaoId: l.grupo_gestao_id,
      grupoGestaoNome: l.grupo_gestao ? `${l.grupo_gestao.codigo} - ${l.grupo_gestao.nome}` : undefined,
      centroCustoId: l.centro_custo_id ?? undefined,
      centroCustoCodigo: l.centro_custo?.codigo,
      centroCustoNome: l.centro_custo?.nome,
      codigo: l.codigo,
      nome: l.nome,
      descricao: l.descricao,
      ativo: l.ativo,
      createdAt: l.created_at,
      updatedAt: l.updated_at
    };
  }

  async getLinhaGestaoById(id: string): Promise<LinhaGestao | null> {
    if (!this.client) return this.fallbackMock.getLinhaGestaoById(id);
    const { data } = await this.client.from('linha_gestao').select(await this.selectLinhaGestao()).eq('id', id).single();
    if (!data) return null;
    return this.mapLinhaGestao(data);
  }

  async createLinhaGestao(data: Omit<LinhaGestao, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinhaGestao> {
    if (!this.client) return this.fallbackMock.createLinhaGestao(data);
    const linha: Record<string, unknown> = {
      grupo_gestao_id: data.grupoGestaoId,
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo ?? true
    };
    // Obra vinculada: grava se a coluna existir no banco
    if (await this.temColuna('linha_gestao', 'centro_custo_id')) {
      linha.centro_custo_id = toUuidOrNull(data.centroCustoId);
    }

    const { data: inserted, error } = await this.client.from('linha_gestao').insert(linha).select().single();
    this.cache.invalidar('linha_gestao');   // só depois da escrita confirmada
    if (error || !inserted) throw new Error(error?.message || 'Erro ao criar linha de gestão');
    return this.getLinhaGestaoById(inserted.id) as Promise<LinhaGestao>;
  }

  async updateLinhaGestao(id: string, data: Partial<LinhaGestao>): Promise<LinhaGestao> {
    if (!this.client) return this.fallbackMock.updateLinhaGestao(id, data);
    const patch: Record<string, unknown> = {
      grupo_gestao_id: data.grupoGestaoId,
      codigo: data.codigo,
      nome: data.nome,
      descricao: data.descricao,
      ativo: data.ativo
    };
    if ('centroCustoId' in data) {
      if (await this.temColuna('linha_gestao', 'centro_custo_id')) {
        patch.centro_custo_id = toUuidOrNull(data.centroCustoId);
      } else if (toUuidOrNull(data.centroCustoId)) {
        throw erroMigration09('O vínculo da Linha de Gestão com a Obra');
      }
    }

    const { error } = await this.client.from('linha_gestao').update(patch).eq('id', id);
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
   * Plano de contas de um item de orçamento, memorizado.
   *
   * A tela mostra Item de Orçamento, mas o banco continua gravando
   * `plano_conta_id` no rateio — é dele que DRE, dashboard e BI vivem. Sem o
   * memo, um título de 12 parcelas × 3 linhas de rateio faria 36 consultas para
   * ler o mesmo punhado de itens.
   */
  private planoContaDeItem = new Map<string, Promise<string | null>>();

  private async planoContaDoItemOrcamento(itemId: string): Promise<string | null> {
    if (!this.planoContaDeItem.has(itemId)) {
      this.planoContaDeItem.set(itemId, (async () => {
        const { data, error } = await this.client!
          .from('orcamento_item')
          .select('plano_conta_id')
          .eq('id', itemId)
          .maybeSingle();

        /*
         * Falha de consulta NÃO pode virar `null` memorizado: o rateio cairia
         * no plano de contas do título em vez do plano do item, em silêncio e
         * pelo resto da sessão — justamente o agrupamento de que DRE, dashboard
         * e BI dependem. Esquece a entrada e deixa o erro subir.
         */
        if (error) {
          this.planoContaDeItem.delete(itemId);
          throw new Error(
            `Não foi possível ler o plano de contas do item de orçamento: ${error.message}`
          );
        }
        return (data as any)?.plano_conta_id ?? null;
      })());
    }
    return this.planoContaDeItem.get(itemId)!;
  }

  /**
   * Monta a linha de rateio (aba Apropriação).
   *
   * `centro_custo_id` é a Unidade Construtiva escolhida — ou a própria Obra,
   * quando ela não tem unidades. `orcamento_item_id` é a coluna nova da
   * migration 09; `plano_conta_id` vem da 08. As duas só entram se existirem:
   * gravá-las às cegas derruba o insert inteiro em banco desatualizado.
   */
  private async montarRateio(
    parcelaId: string,
    centroCustoId: string,
    rateio: { orcamentoItemId?: string; planoContaId?: string; percentual: number; valorCentavos: number },
    planoContaTituloId: string
  ): Promise<Record<string, unknown>> {
    const linha: Record<string, unknown> = {
      parcela_id: parcelaId,
      centro_custo_id: centroCustoId,
      percentual: rateio.percentual,
      valor: rateio.valorCentavos / 100,
    };

    const itemUuid = toUuidOrNull(rateio.orcamentoItemId);
    if (itemUuid) {
      if (!(await this.temColuna('titulo_rateio', 'orcamento_item_id'))) {
        throw erroMigration09('O Item de Orçamento da Apropriação');
      }
      linha.orcamento_item_id = itemUuid;
    }

    // Plano de contas: o do item de orçamento manda, porque é ele que o usuário
    // escolheu na tela. Sem item, cai no plano próprio da linha e, por fim, no
    // do título.
    if (await this.temColuna('titulo_rateio', 'plano_conta_id')) {
      const planoDoItem = itemUuid ? await this.planoContaDoItemOrcamento(itemUuid) : null;
      linha.plano_conta_id = planoDoItem || toUuidOrNull(rateio.planoContaId) || planoContaTituloId;
    }

    return linha;
  }

  /**
   * Grava uma linha da Apropriação.
   *
   * Havia aqui um "fallback": quando o insert falhava citando
   * `orcamento_item_id`, a linha era regravada SEM o item. O título era salvo,
   * a tela dizia "Título salvo com sucesso" — e o Item de Orçamento que o
   * usuário acabara de escolher sumia ao recarregar a página, sem nenhum aviso.
   *
   * É o mesmo erro que a migration 08 já tinha causado com o plano de contas:
   * descartar em silêncio o que o usuário preencheu. Agora a gravação para e
   * diz o que falta — `montarRateio` já barra o caso comum (coluna ausente);
   * este ponto cobre o schema cache do PostgREST desatualizado, que só aparece
   * na hora do insert.
   */
  private async inserirRateioParcela(linha: Record<string, unknown>): Promise<void> {
    const { error } = await this.client!.from('titulo_rateio').insert(linha);
    if (!error) return;

    const sobreOItem =
      /orcamento_item_id/i.test(error.message || '') || (error as { code?: string }).code === 'PGRST204';

    if (linha.orcamento_item_id && sobreOItem) {
      throw erroMigration09('O Item de Orçamento da Apropriação');
    }

    throw new Error(`Falha ao gravar rateio: ${error.message}`);
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

  /**
   * Recusa a gravação ANTES de tocar no banco quando a Apropriação traz Item de
   * Orçamento e a coluna da migration 09 não existe.
   *
   * A checagem precisa vir aqui, e não só na hora do insert do rateio:
   * `updateTitulo` apaga e recria as parcelas antes de chegar nos rateios, e
   * falhar no meio deixaria o título com parcelas novas e apropriação nenhuma.
   */
  private async validarApropriacao(data: TituloInput): Promise<void> {
    const temItem = (data.parcelas ?? []).some(p =>
      (p.rateios ?? []).some(r => toUuidOrNull(r.orcamentoItemId))
    );
    if (!temItem) return;

    if (!(await this.temColuna('titulo_rateio', 'orcamento_item_id'))) {
      throw erroMigration09('O Item de Orçamento da Apropriação');
    }
  }

  async createTitulo(data: TituloInput): Promise<Titulo> {
    if (!this.client) return this.fallbackMock.createTitulo(data);

    await this.validarApropriacao(data);

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
          const linhaRateio = await this.montarRateio(insertedParcela.id, ccUuid, r, planoContaUuid);
          await this.inserirRateioParcela(linhaRateio);
        }
      }
    }

    await this.gravarRateioGestao(insertedTitulo.id, data.rateiosGestao);

    const rec = await this.getTituloById(insertedTitulo.id);
    return rec || this.fallbackMock.createTitulo(data);
  }

  async updateTitulo(id: string, data: TituloInput): Promise<Titulo> {
    if (!this.client) return this.fallbackMock.updateTitulo(id, data);

    await this.validarApropriacao(data);

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
          const linhaRateio = await this.montarRateio(insertedParcela.id, ccUuid, r, planoContaUuid);
          await this.inserirRateioParcela(linhaRateio);
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

  /** Colunas do título com as dimensões, parcelas e rateios necessários para montar `Titulo`. */
  private static readonly SELECT_TITULO = `
      *,
      pessoa:pessoa(*),
      plano_conta:plano_conta(*),
      grupo_gestao:grupo_gestao(*),
      linha_gestao:linha_gestao(*),
      titulo_parcela(*, titulo_rateio(*))
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
        rateios: (p.titulo_rateio || []).map((r: any) => ({
          id: r.id,
          parcelaId: p.id,
          centroCustoId: r.centro_custo_id,
          planoContaId: r.plano_conta_id,
          orcamentoItemId: r.orcamento_item_id,
          percentual: Number(r.percentual),
          valorCentavos: Math.round(Number(r.valor) * 100)
        }))
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

    /*
     * Apropriação gravada (titulo_rateio).
     *
     * `mapTitulos` devolvia `rateios: []` em toda parcela: a aba Apropriação
     * era gravada mas nunca lida de volta. Reabrir um título mostrava a aba
     * vazia e o salvamento seguinte regravava tudo como "Não alocado" 100% —
     * a classificação se perdia sem aviso na segunda edição.
     */
    await this.carregarRateiosDasParcelas(titulo);

    return titulo;
  }

  /** Repõe a apropriação de cada parcela a partir de `titulo_rateio`. */
  private async carregarRateiosDasParcelas(titulo: Titulo): Promise<void> {
    const parcelaIds = (titulo.parcelas ?? [])
      .map(p => p.id)
      .filter((id): id is string => !!id);
    if (parcelaIds.length === 0) return;

    // Busca direta na tabela titulo_rateio sem joins frágeis do PostgREST
    const { data: rateiosRaw, error } = await this.client!
      .from('titulo_rateio')
      .select('*')
      .in('parcela_id', parcelaIds);

    if (error || !rateiosRaw) {
      console.error('[carregarRateiosDasParcelas] Erro ao ler titulo_rateio:', error?.message);
      return;
    }

    const porParcela = new Map<string, TituloRateio[]>();
    for (const l of (rateiosRaw as any[])) {
      const lista = porParcela.get(l.parcela_id) ?? [];
      lista.push({
        id: l.id,
        centroCustoId: l.centro_custo_id,
        orcamentoItemId: l.orcamento_item_id ?? undefined,
        planoContaId: l.plano_conta_id ?? undefined,
        percentual: Number(l.percentual),
        valorCentavos: Math.round(Number(l.valor) * 100),
        ativo: l.ativo ?? true,
      });
      porParcela.set(l.parcela_id, lista);
    }

    for (const p of titulo.parcelas ?? []) {
      if (p.id) p.rateios = porParcela.get(p.id) ?? [];
    }
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
  // ---------------------------------------------------------------------------
  // 9. ORÇAMENTO DA OBRA (persistência real)
  // ---------------------------------------------------------------------------
  /*
   * Estes métodos delegavam ao mock em memória. Com o módulo desligado ninguém
   * percebia; agora que a aba Apropriação escolhe um Item de Orçamento, delegar
   * significaria apropriar títulos contra itens que não existem no banco — o
   * orçamento sumiria a cada F5 e o rateio apontaria para o nada.
   *
   * Hierarquia gravada: orcamento.centro_custo_id = OBRA,
   * orcamento_item.centro_custo_id = UNIDADE CONSTRUTIVA.
   */
  private static readonly SELECT_ORCAMENTO = `
      *,
      centro_custo (id, codigo, nome),
      orcamento_item (
        *,
        plano_conta (id, codigo, nome),
        centro_custo (id, codigo, nome),
        orcamento_item_periodo (*)
      )
    `;

  private mapOrcamento(o: any): Orcamento {
    const itens = (o.orcamento_item ?? [])
      .map((i: any) => ({
        id: i.id,
        orcamentoId: i.orcamento_id,
        codigo: i.codigo ?? undefined,
        planoContaId: i.plano_conta_id,
        planoContaCodigo: i.plano_conta?.codigo ?? '',
        planoContaNome: i.plano_conta?.nome ?? '',
        centroCustoId: i.centro_custo_id ?? undefined,
        centroCustoCodigo: i.centro_custo?.codigo,
        centroCustoNome: i.centro_custo?.nome,
        descricao: i.descricao ?? undefined,
        quantidade: i.quantidade != null ? Number(i.quantidade) : undefined,
        unidade: i.unidade ?? undefined,
        valorUnitarioCentavos:
          i.valor_unitario != null ? Math.round(Number(i.valor_unitario) * 100) : undefined,
        valorTotalCentavos: Math.round(Number(i.valor_total ?? 0) * 100),
        ordem: i.ordem ?? 1,
        periodos: (i.orcamento_item_periodo ?? []).map((pe: any) => ({
          id: pe.id,
          orcamentoItemId: pe.orcamento_item_id,
          mesReferencia: pe.mes_referencia,
          valorCentavos: Math.round(Number(pe.valor ?? 0) * 100),
        })),
        // Aliases que o restante do módulo ainda consulta.
        planoContaNivel2Id: i.plano_conta_id,
        planoContaNivel2Codigo: i.plano_conta?.codigo ?? '',
        planoContaNivel2Nome: i.plano_conta?.nome ?? '',
      }))
      .sort((a: any, b: any) => a.ordem - b.ordem);

    return {
      id: o.id,
      centroCustoId: o.centro_custo_id,
      centroCustoCodigo: o.centro_custo?.codigo ?? '',
      centroCustoNome: o.centro_custo?.nome ?? '',
      nome: o.nome,
      versao: o.versao ?? 1,
      orcamentoBaseId: o.orcamento_base_id ?? undefined,
      dataInicio: o.data_inicio,
      dataFim: o.data_fim,
      status: o.status,
      valorTotalCentavos: Math.round(Number(o.valor_total ?? 0) * 100),
      aprovadoEm: o.aprovado_em ?? undefined,
      aprovadoPor: o.aprovado_por ?? undefined,
      motivoRevisao: o.motivo_revisao ?? undefined,
      observacao: o.observacao ?? undefined,
      ativo: o.ativo ?? true,
      createdAt: o.created_at,
      updatedAt: o.updated_at ?? undefined,
      itens,
      descricao: o.nome,
      isVigente: o.status === 'aprovado',
      dataAprovacao: o.aprovado_em ?? undefined,
    };
  }

  async getOrcamentos(filtro?: { centroCustoId?: string; status?: string; dataInicioDe?: string; dataFimAte?: string }): Promise<Orcamento[]> {
    if (!this.client) return this.fallbackMock.getOrcamentos(filtro);

    let query = this.client
      .from('orcamento')
      .select(SupabaseErpRepository.SELECT_ORCAMENTO)
      .eq('ativo', true);

    if (filtro?.centroCustoId) query = query.eq('centro_custo_id', filtro.centroCustoId);
    if (filtro?.status) query = query.eq('status', filtro.status);
    if (filtro?.dataInicioDe) query = query.gte('data_inicio', filtro.dataInicioDe);
    if (filtro?.dataFimAte) query = query.lte('data_fim', filtro.dataFimAte);

    let { data, error } = await query.order('created_at', { ascending: false });

    // Fallback defensivo: se falhar o join de relação embutida do PostgREST, carrega separadamente
    if (error || !data) {
      let fallbackQuery = this.client.from('orcamento').select('*').eq('ativo', true);
      if (filtro?.centroCustoId) fallbackQuery = fallbackQuery.eq('centro_custo_id', filtro.centroCustoId);
      if (filtro?.status) fallbackQuery = fallbackQuery.eq('status', filtro.status);
      const { data: orcsBase } = await fallbackQuery.order('created_at', { ascending: false });

      if (!orcsBase || orcsBase.length === 0) return [];

      const orcIds = orcsBase.map((o: any) => o.id);
      const { data: itensRaw } = await this.client
        .from('orcamento_item')
        .select('*')
        .in('orcamento_id', orcIds);

      const itensDb = itensRaw || [];
      data = orcsBase.map((o: any) => ({
        ...o,
        orcamento_item: itensDb.filter((it: any) => it.orcamento_id === o.id)
      }));
    }

    return (data as any[]).map(o => this.mapOrcamento(o));
  }

  async getOrcamentoById(id: string): Promise<Orcamento | null> {
    if (!this.client) return this.fallbackMock.getOrcamentoById(id);
    let { data, error } = await this.client
      .from('orcamento')
      .select(SupabaseErpRepository.SELECT_ORCAMENTO)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      const { data: baseOrc } = await this.client
        .from('orcamento')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!baseOrc) return null;

      const { data: itensRaw } = await this.client
        .from('orcamento_item')
        .select('*')
        .eq('orcamento_id', id);

      data = {
        ...baseOrc,
        orcamento_item: itensRaw || []
      };
    }

    return data ? this.mapOrcamento(data) : null;
  }

  /**
   * Regrava a planilha do orçamento e devolve o total em centavos.
   *
   * Trabalha por DIFERENÇA — atualiza quem já existe, insere quem é novo, apaga
   * só quem o usuário tirou da planilha. A versão anterior apagava tudo e
   * reinseria, o que custava caro em dois pontos:
   *
   *  1. `titulo_rateio.orcamento_item_id` tem ON DELETE RESTRICT. Bastava UM
   *     título apropriado contra qualquer item para o DELETE em massa falhar e
   *     o orçamento inteiro virar não-editável pela tela, para sempre.
   *  2. Sem transação, uma falha no meio do laço deixava o orçamento truncado:
   *     os itens antigos já tinham sido apagados e só parte dos novos entrou.
   *
   * Preservar o id também mantém válida a apropriação já gravada nos títulos,
   * que aponta para o item — regenerar ids a cada salvamento a apagaria.
   *
   * Continua sem transação (o supabase-js não expõe uma), mas agora a falha no
   * meio deixa o estado anterior de pé em vez de destruído.
   */
  private async gravarItensOrcamento(
    orcamentoId: string,
    itens: {
      id?: string;
      codigo?: string;
      planoContaId: string;
      centroCustoId?: string;
      descricao?: string;
      quantidade?: number;
      unidade?: string;
      valorUnitarioCentavos?: number;
      valorTotalCentavos: number;
      periodos: { mesReferencia: string; valorCentavos: number }[];
    }[]
  ): Promise<number> {
    const { data: existentesRaw, error: lerErro } = await this.client!
      .from('orcamento_item')
      .select('id')
      .eq('orcamento_id', orcamentoId);

    if (lerErro) throw new Error(`Não foi possível ler os itens do orçamento: ${lerErro.message}`);

    const idsExistentes = new Set(((existentesRaw ?? []) as any[]).map(i => i.id as string));
    const idsMantidos = new Set<string>();

    const temCodigo = await this.temColuna('orcamento_item', 'codigo');

    let totalCentavos = 0;

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      totalCentavos += item.valorTotalCentavos;

      const linha: Record<string, unknown> = {
        orcamento_id: orcamentoId,
        plano_conta_id: item.planoContaId,
        centro_custo_id: toUuidOrNull(item.centroCustoId),
        descricao: item.descricao ?? null,
        quantidade: item.quantidade ?? null,
        unidade: item.unidade ?? null,
        valor_unitario: item.valorUnitarioCentavos != null ? item.valorUnitarioCentavos / 100 : null,
        valor_total: item.valorTotalCentavos / 100,
        ordem: i + 1,
      };
      if (temCodigo && item.codigo) linha.codigo = item.codigo;

      // Id não-UUID vem do editor (linha recém-criada na tela): é item novo.
      const idExistente = toUuidOrNull(item.id);
      let itemId: string;

      if (idExistente && idsExistentes.has(idExistente)) {
        const { error } = await this.client!
          .from('orcamento_item')
          .update({ ...linha, updated_at: new Date().toISOString() })
          .eq('id', idExistente);
        if (error) throw new Error(`Falha ao atualizar o item ${i + 1} do orçamento: ${error.message}`);
        itemId = idExistente;
        idsMantidos.add(idExistente);
      } else {
        const { data: inserido, error } = await this.client!
          .from('orcamento_item')
          .insert(linha)
          .select('id')
          .single();
        if (error || !inserido) {
          throw new Error(`Falha ao gravar o item ${i + 1} do orçamento: ${error?.message ?? 'erro desconhecido'}`);
        }
        itemId = inserido.id;
      }

      // O plano de contas do item pode ter mudado neste salvamento.
      this.planoContaDeItem.delete(itemId);

      // Períodos não são referenciados por ninguém: aqui trocar tudo é seguro.
      const { error: delPer } = await this.client!
        .from('orcamento_item_periodo')
        .delete()
        .eq('orcamento_item_id', itemId);
      if (delPer) throw new Error(`Falha ao limpar a distribuição mensal do item ${i + 1}: ${delPer.message}`);

      const periodos = (item.periodos ?? []).filter(pe => pe.valorCentavos > 0);
      if (periodos.length > 0) {
        const { error: pErro } = await this.client!.from('orcamento_item_periodo').insert(
          periodos.map(pe => ({
            orcamento_item_id: itemId,
            mes_referencia: pe.mesReferencia,
            valor: pe.valorCentavos / 100,
          }))
        );
        if (pErro) throw new Error(`Falha ao gravar a distribuição mensal do item ${i + 1}: ${pErro.message}`);
      }
    }

    // Só o que o usuário realmente removeu da planilha.
    const removidos = [...idsExistentes].filter(id => !idsMantidos.has(id));
    if (removidos.length > 0) {
      const { error: delErro } = await this.client!
        .from('orcamento_item')
        .delete()
        .in('id', removidos);

      if (delErro) {
        throw new Error(
          `Não foi possível remover ${removidos.length} item(ns) do orçamento: ${delErro.message}. ` +
          'Item já apropriado em título não pode ser excluído — retire a apropriação do título antes.'
        );
      }
      for (const id of removidos) this.planoContaDeItem.delete(id);
    }

    return totalCentavos;
  }

  /**
   * Próxima versão livre da obra. `unique_centro_custo_versao` recusa duas
   * versões iguais no mesmo centro de custo — sem isto, o segundo orçamento de
   * uma obra falharia com violação de UNIQUE.
   */
  private async proximaVersaoOrcamento(centroCustoId: string): Promise<number> {
    const { data } = await this.client!
      .from('orcamento')
      .select('versao')
      .eq('centro_custo_id', centroCustoId)
      .order('versao', { ascending: false })
      .limit(1);
    return ((data as any[])?.[0]?.versao ?? 0) + 1;
  }

  async createOrcamento(data: {
    centroCustoId: string;
    nome: string;
    dataInicio: string;
    dataFim: string;
    observacao?: string;
    itens: {
      codigo?: string;
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
    if (!this.client) return this.fallbackMock.createOrcamento(data);

    const obraUuid = toUuidOrNull(data.centroCustoId);
    if (!obraUuid) throw new Error('Selecione a Obra do orçamento.');

    const { data: inserido, error } = await this.client
      .from('orcamento')
      .insert({
        centro_custo_id: obraUuid,
        nome: data.nome,
        versao: await this.proximaVersaoOrcamento(obraUuid),
        data_inicio: data.dataInicio,
        data_fim: data.dataFim,
        status: 'rascunho',
        valor_total: 0,
        observacao: data.observacao ?? null,
        ativo: true,
      })
      .select('id')
      .single();

    if (error || !inserido) throw new Error(error?.message || 'Erro ao criar o orçamento.');

    const totalCentavos = await this.gravarItensOrcamento(inserido.id, data.itens ?? []);
    await this.client.from('orcamento').update({
      valor_total: totalCentavos / 100,
      updated_at: new Date().toISOString(),
    }).eq('id', inserido.id);

    const rec = await this.getOrcamentoById(inserido.id);
    if (!rec) throw new Error('Orçamento gravado, mas não foi possível relê-lo.');
    return rec;
  }

  async updateOrcamento(id: string, data: {
    nome?: string;
    observacao?: string;
    itens?: {
      id?: string;
      codigo?: string;
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
    if (!this.client) return this.fallbackMock.updateOrcamento(id, data);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.nome !== undefined) patch.nome = data.nome;
    if (data.observacao !== undefined) patch.observacao = data.observacao;

    if (data.itens) {
      patch.valor_total = (await this.gravarItensOrcamento(id, data.itens)) / 100;
    }

    const { error } = await this.client.from('orcamento').update(patch).eq('id', id);
    if (error) throw new Error(error.message);

    const rec = await this.getOrcamentoById(id);
    if (!rec) throw new Error('Orçamento atualizado, mas não foi possível relê-lo.');
    return rec;
  }

  async previaExclusaoOrcamento(id: string): Promise<ExclusaoOrcamentoPrevia> {
    if (!this.client) return this.fallbackMock.previaExclusaoOrcamento(id);

    const orc = await this.getOrcamentoById(id);
    if (!orc) throw new Error('Orçamento não encontrado.');

    const base: ExclusaoOrcamentoPrevia = {
      podeExcluir: true,
      orcamentoNome: orc.nome,
      itensCount: orc.itens.length,
      valorTotalCentavos: orc.valorTotalCentavos,
      bloqueios: [],
    };

    /*
     * Toda consulta daqui para baixo é uma TRAVA, então falha de leitura não
     * pode virar "nada bloqueia": ignorar o `error` faria uma query quebrada
     * devolver `podeExcluir: true`, a tela prometeria "nada de financeiro é
     * afetado" e o usuário apagaria a planilha achando que estava livre. Na
     * dúvida, esta função recusa.
     */

    /*
     * `orcamento_base_id` é auto-referência sem ON DELETE (migration 04): apagar
     * a base de uma revisão é recusado pelo Postgres. Sem esta checagem a prévia
     * diria que dá, e o erro cru de constraint apareceria depois — que é
     * exatamente o que esta função existe para evitar.
     */
    const { data: revisoes, error: revErro } = await this.client
      .from('orcamento')
      .select('id, nome, versao')
      .eq('orcamento_base_id', id);
    if (revErro) {
      throw new Error(`Não foi possível verificar revisões deste orçamento: ${revErro.message}`);
    }
    if (revisoes && revisoes.length > 0) {
      const nomes = (revisoes as any[]).map((r) => `"${r.nome}" (v${r.versao})`).join(', ');
      base.podeExcluir = false;
      base.revisoesDependentes = nomes;
      return base;
    }

    if (orc.itens.length === 0) return base;

    /*
     * Sem a migration 09 a coluna não existe, e a query abaixo falharia. Nenhum
     * rateio pode apontar para item de orçamento nesse banco, então não há o que
     * travar. Mesmo guarda que o resto do arquivo usa para esta coluna.
     */
    if (!(await this.temColuna('titulo_rateio', 'orcamento_item_id'))) return base;

    const itemPorId = new Map(orc.itens.map((i) => [i.id, i]));
    const { data: rateios, error: ratErro } = await this.client
      .from('titulo_rateio')
      .select('id, parcela_id, orcamento_item_id, valor')
      .in('orcamento_item_id', [...itemPorId.keys()]);
    if (ratErro) {
      throw new Error(`Não foi possível verificar as apropriações deste orçamento: ${ratErro.message}`);
    }

    if (!rateios || rateios.length === 0) return base;

    // Rateio guarda a parcela, não o título: dois saltos até o código do título.
    const parcelaIds = [...new Set((rateios as any[]).map((r) => r.parcela_id).filter(Boolean))];
    const { data: parcelas, error: parErro } = await this.client
      .from('titulo_parcela')
      .select('id, titulo_id')
      .in('id', parcelaIds);
    if (parErro) {
      throw new Error(`Não foi possível identificar os títulos que usam este orçamento: ${parErro.message}`);
    }

    const tituloPorParcela = new Map((parcelas ?? []).map((p: any) => [p.id, p.titulo_id]));
    const tituloIds = [...new Set([...tituloPorParcela.values()].filter(Boolean))];
    const { data: titulos, error: titErro } = await this.client
      .from('titulo')
      .select('id, codigo, descricao')
      .in('id', tituloIds);
    if (titErro) {
      throw new Error(`Não foi possível identificar os títulos que usam este orçamento: ${titErro.message}`);
    }

    const tituloPorId = new Map((titulos ?? []).map((t: any) => [t.id, t]));

    base.podeExcluir = false;
    base.bloqueios = (rateios as any[]).map((r) => {
      const tituloId = tituloPorParcela.get(r.parcela_id);
      const titulo = tituloId ? tituloPorId.get(tituloId) : undefined;
      const item = itemPorId.get(r.orcamento_item_id);
      return {
        tituloId: tituloId ?? '',
        tituloCodigo: titulo?.codigo ?? '(sem código)',
        tituloDescricao: titulo?.descricao ?? undefined,
        itemDescricao: item?.descricao || item?.planoContaNome || '(item sem descrição)',
        valorRateadoCentavos: Math.round(Number(r.valor ?? 0) * 100),
      };
    });
    return base;
  }

  async deleteOrcamento(id: string): Promise<boolean> {
    if (!this.client) return this.fallbackMock.deleteOrcamento(id);

    /*
     * Confere de novo aqui, e não só na tela: entre abrir a confirmação e clicar
     * em excluir, alguém pode ter apropriado um título nesta planilha. O banco
     * também recusaria (ON DELETE RESTRICT), mas com uma mensagem de constraint
     * que não diz qual título travou.
     */
    const previa = await this.previaExclusaoOrcamento(id);
    if (!previa.podeExcluir) throw new Error(mensagemRecusaExclusao(previa));

    // Os ids têm de ser lidos ANTES: depois do delete não há mais o que ler.
    const itensIds = ((await this.getOrcamentoById(id))?.itens ?? []).map((i) => i.id);

    const { error } = await this.client.from('orcamento').delete().eq('id', id);
    this.cache.invalidar('orcamento');   // só depois da escrita confirmada
    if (error) throw new Error(`Não foi possível excluir o orçamento: ${error.message}`);

    for (const itemId of itensIds) this.planoContaDeItem.delete(itemId);
    return true;
  }

  async aprovarOrcamento(id: string, usuario?: string): Promise<Orcamento> {
    if (!this.client) return this.fallbackMock.aprovarOrcamento(id, usuario);
    const { error } = await this.client.from('orcamento').update({
      status: 'aprovado',
      aprovado_em: new Date().toISOString(),
      aprovado_por: usuario ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) throw new Error(error.message);

    const rec = await this.getOrcamentoById(id);
    if (!rec) throw new Error('Orçamento aprovado, mas não foi possível relê-lo.');
    return rec;
  }
  /**
   * Nova versão em rascunho a partir de um orçamento aprovado.
   *
   * Delegava ao mock, que procura o orçamento numa lista em memória: com o
   * cadastro gravando no banco, o botão "Nova Revisão" falhava sempre com
   * "Orçamento base não encontrado".
   *
   * A versão nova nasce com CÓPIAS dos itens (ids próprios). É proposital: os
   * itens da versão aprovada seguem existindo e as apropriações de títulos que
   * apontam para eles continuam íntegras.
   */
  async criarRevisaoOrcamento(id: string, motivoRevisao: string, usuario?: string): Promise<Orcamento> {
    if (!this.client) return this.fallbackMock.criarRevisaoOrcamento(id, motivoRevisao, usuario);

    if (!motivoRevisao?.trim()) throw new Error('Informe o motivo da revisão.');

    const base = await this.getOrcamentoById(id);
    if (!base) throw new Error('Orçamento base não encontrado.');

    const { data: inserido, error } = await this.client
      .from('orcamento')
      .insert({
        centro_custo_id: base.centroCustoId,
        nome: base.nome,
        versao: await this.proximaVersaoOrcamento(base.centroCustoId),
        orcamento_base_id: base.orcamentoBaseId ?? base.id,
        data_inicio: base.dataInicio,
        data_fim: base.dataFim,
        status: 'rascunho',
        valor_total: 0,
        motivo_revisao: motivoRevisao,
        observacao: base.observacao ?? null,
        ativo: true,
      })
      .select('id')
      .single();

    if (error || !inserido) throw new Error(error?.message || 'Erro ao criar a revisão do orçamento.');

    const total = await this.gravarItensOrcamento(
      inserido.id,
      base.itens.map(i => ({
        // sem `id`: cada item da revisão é novo, o da versão base fica de pé
        codigo: i.codigo,
        planoContaId: i.planoContaId,
        centroCustoId: i.centroCustoId,
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidade: i.unidade,
        valorUnitarioCentavos: i.valorUnitarioCentavos,
        valorTotalCentavos: i.valorTotalCentavos,
        periodos: i.periodos.map(pe => ({ mesReferencia: pe.mesReferencia, valorCentavos: pe.valorCentavos })),
      }))
    );

    await this.client.from('orcamento').update({
      valor_total: total / 100,
      updated_at: new Date().toISOString(),
    }).eq('id', inserido.id);

    const rec = await this.getOrcamentoById(inserido.id);
    if (!rec) throw new Error('Revisão criada, mas não foi possível relê-la.');
    return rec;
  }
  async getOrcamentosEmpreendimento(filtro?: any): Promise<OrcamentoEmpreendimento[]> { return this.fallbackMock.getOrcamentosEmpreendimento(filtro); }
  async createOrcamentoEmpreendimento(data: any): Promise<OrcamentoEmpreendimento> { return this.fallbackMock.createOrcamentoEmpreendimento(data); }
  async updateOrcamentoEmpreendimento(id: string, data: any): Promise<OrcamentoEmpreendimento> { return this.fallbackMock.updateOrcamentoEmpreendimento(id, data); }
  async aprovarOrcamentoEmpreendimento(id: string, usuario?: string): Promise<OrcamentoEmpreendimento> { return this.fallbackMock.aprovarOrcamentoEmpreendimento(id, usuario); }
  async getOrcamentoExecucao(orcamentoId: string, dataCorte?: string): Promise<OrcamentoExecucaoView> {
    if (!this.client) return this.fallbackMock.getOrcamentoExecucao(orcamentoId, dataCorte);

    const dataCorteEfetiva = dataCorte || new Date().toISOString().split('T')[0];
    const orcamento = await this.getOrcamentoById(orcamentoId);
    if (!orcamento) throw new Error('Orçamento não encontrado');

    const centroCustoId = orcamento.centroCustoId;
    const centros = await this.getCentrosCusto({ apenasAtivos: false });
    const centroCustoTreeIds = [centroCustoId];
    centros.filter(c => c.parentId === centroCustoId).forEach(c => centroCustoTreeIds.push(c.id));

    // 1. Carregar todos os títulos a pagar ativos com parcelas e rateios
    const { data: titulosDb } = await this.client
      .from('titulo')
      .select(`
        id, codigo, tipo, pessoa_id, plano_conta_id, numero_documento, descricao, data_competencia, valor_bruto,
        pessoa:pessoa(nome),
        titulo_parcela(
          id, numero, data_vencimento, valor, ativo,
          titulo_rateio(*)
        )
      `)
      .eq('tipo', 'P')
      .eq('ativo', true);

    // 2. Carregar todos os movimentos de caixa pagos e não estornados
    const { data: movsDb } = await this.client
      .from('movimento')
      .select('*')
      .eq('estornado', false)
      .lte('data_pagamento', dataCorteEfetiva);

    const movimentos = movsDb || [];
    const titulos = titulosDb || [];

    const itensExecucao: OrcamentoExecucaoItemView[] = [];
    let totalOrcadoCentavos = 0;
    let totalComprometidoCentavos = 0;
    let totalRealizadoCentavos = 0;

    /**
     * Varre títulos e movimentos somando o que os rateios escolhidos consomem.
     *
     * `escolherRateios` é a única coisa que muda entre um item de orçamento e o
     * bloco "sem item de orçamento": o resto da conta — saldo da parcela,
     * percentual do rateio, montagem das listas de detalhe — é idêntico, e
     * estava duplicado entre comprometido e realizado.
     */
    const coletarConsumo = (escolherRateios: (rateios: any[]) => RateioCasado<any>[]) => {
      const comprometidoTitulos: ComprometidoTituloItem[] = [];
      const realizadoMovimentos: RealizadoMovimentoItem[] = [];

      let comprometidoCentavos = 0;
      let realizadoCentavos = 0;

      // 1. COMPROMETIDO (títulos em aberto com saldo)
      for (const t of titulos) {
        const parcelas = (t.titulo_parcela || []).filter((p: any) => p.ativo !== false);
        for (const p of parcelas) {
          const pMovs = movimentos.filter((m: any) => m.parcela_id === p.id);
          const baixadoCentavos = pMovs.reduce((sum: number, m: any) => sum + Math.round(Number(m.valor_pago) * 100), 0);
          const pValorCentavos = Math.round(Number(p.valor) * 100);
          const saldoParcelaCentavos = Math.max(0, pValorCentavos - baixadoCentavos);

          if (saldoParcelaCentavos <= 0) continue;

          // Uma parcela pode ser rateada entre dois itens do mesmo orçamento —
          // por isso somamos todos os rateios que casam, não só o primeiro.
          for (const { percentual } of escolherRateios(p.titulo_rateio || [])) {
            const valorRateadoCentavos = Math.round(saldoParcelaCentavos * (percentual / 100));
            comprometidoCentavos += valorRateadoCentavos;

            comprometidoTitulos.push({
              tituloId: t.id,
              parcelaId: p.id,
              numeroDocumento: t.numero_documento,
              descricao: t.descricao,
              pessoaNome: (t.pessoa as any)?.nome || 'Fornecedor',
              dataCompetencia: t.data_competencia,
              dataVencimento: p.data_vencimento,
              valorTotalParcelaCentavos: pValorCentavos,
              valorRateadoCentavos,
              saldoParcelaCentavos,
              percentualRateio: percentual
            });
          }
        }
      }

      // 2. REALIZADO (baixas de caixa efetivadas)
      for (const m of movimentos) {
        if (!m.parcela_id) continue;
        for (const t of titulos) {
          const p = (t.titulo_parcela || []).find((par: any) => par.id === m.parcela_id);
          if (!p) continue;

          for (const { percentual } of escolherRateios(p.titulo_rateio || [])) {
            const movValorCentavos = Math.round(Number(m.valor_liquido || m.valor_pago) * 100);
            const valorRateadoMovimentoCentavos = Math.round(movValorCentavos * (percentual / 100));
            realizadoCentavos += valorRateadoMovimentoCentavos;

            realizadoMovimentos.push({
              movimentoId: m.id,
              parcelaId: m.parcela_id,
              numeroDocumento: t.numero_documento,
              descricao: t.descricao,
              pessoaNome: (t.pessoa as any)?.nome || 'Fornecedor',
              dataPagamento: m.data_pagamento,
              formaPagamento: m.forma_pagamento,
              valorPagoMovimentoCentavos: movValorCentavos,
              valorRateadoMovimentoCentavos,
              percentualRateio: percentual
            });
          }
        }
      }

      return { comprometidoCentavos, realizadoCentavos, comprometidoTitulos, realizadoMovimentos };
    };

    for (const item of orcamento.itens) {
      const pcGrupoId = item.planoContaId || item.planoContaNivel2Id || '';
      const pcCodigo = item.planoContaCodigo || item.planoContaNivel2Codigo || '';
      const pcNome = item.planoContaNome || item.planoContaNivel2Nome || '';
      const orcadoCentavos = item.valorTotalCentavos || 0;
      totalOrcadoCentavos += orcadoCentavos;

      const unidade = item.centroCustoId ? centros.find(c => c.id === item.centroCustoId) : null;

      const { comprometidoCentavos, realizadoCentavos, comprometidoTitulos, realizadoMovimentos } =
        coletarConsumo((rateios) => rateiosDoItem(rateios, item.id));

      totalComprometidoCentavos += comprometidoCentavos;
      totalRealizadoCentavos += realizadoCentavos;

      const saldoCentavos = orcadoCentavos - comprometidoCentavos - realizadoCentavos;
      const consumido = comprometidoCentavos + realizadoCentavos;
      const percentualConsumido = orcadoCentavos > 0 ? (consumido / orcadoCentavos) * 100 : (consumido > 0 ? 100 : 0);
      const isEstourado = consumido > orcadoCentavos;
      const valorExcedenteCentavos = isEstourado ? consumido - orcadoCentavos : 0;

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
        realizadoMovimentos
      });
    }

    /*
     * Lançado no centro de custo, mas sem item de orçamento apontado.
     *
     * Fica de fora dos totais de propósito: como o centro de custo pode ter mais
     * de um orçamento, atribuir esse valor a um deles seria escolher no chute —
     * e era exatamente isso que fazia o mesmo dinheiro aparecer consumido nos
     * dois. Reportado à parte para não sumir da tela.
     */
    const semItemOrcamento = coletarConsumo((rateios) => rateiosSemItem(rateios, centroCustoTreeIds));

    const totalSaldoCentavos = totalOrcadoCentavos - totalComprometidoCentavos - totalRealizadoCentavos;
    const totalConsumido = totalComprometidoCentavos + totalRealizadoCentavos;
    const totalPercentualConsumido = totalOrcadoCentavos > 0 ? (totalConsumido / totalOrcadoCentavos) * 100 : 0;
    const isEstouradoTotal = totalConsumido > totalOrcadoCentavos;
    const totalValorExcedenteCentavos = isEstouradoTotal ? totalConsumido - totalOrcadoCentavos : 0;

    return {
      orcamentoId: orcamento.id,
      versao: orcamento.versao,
      status: orcamento.status,
      centroCustoId: orcamento.centroCustoId,
      centroCustoCodigo: orcamento.centroCustoCodigo,
      centroCustoNome: orcamento.centroCustoNome,
      dataInicio: orcamento.dataInicio,
      dataFim: orcamento.dataFim,
      dataCorte: dataCorteEfetiva,
      totalOrcadoCentavos,
      totalComprometidoCentavos,
      totalRealizadoCentavos,
      totalSaldoCentavos,
      totalPercentualConsumido,
      isEstouradoGeral: isEstouradoTotal,
      totalExcedenteCentavos: totalValorExcedenteCentavos,
      fraseStatusCurvaS: isEstouradoTotal ? 'Consumo acima do orçamento previsto' : 'Dentro do limite orçado',
      curvaS: [],
      itensExecucao,
      semItemOrcamento,
      temLinhaBaseV1: false,
      totalOrcadoV1Centavos: 0,
      variacaoV1TotalCentavos: 0,
      variacaoV1TotalPercentual: 0
    };
  }
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

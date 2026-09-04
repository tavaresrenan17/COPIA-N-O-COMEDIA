'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { erpRepository, CentroCusto, Orcamento, PlanoConta } from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { planosDeCusto } from '@/lib/planoContas';
import { codigoItemOrcamento, unidadesConstrutivasDe } from '@/lib/centroCusto';
import { useToast } from '@/components/ui/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Copy,
  Layers,
  Lock,
  X,
  CopyPlus,
  AlertCircle,
} from 'lucide-react';

/**
 * Aba "Itens de Orçamento" do cadastro de Centro de Custos.
 *
 * Reproduz o modelo do ERP de referência — Obra → Unidade Construtiva → Itens —
 * em dois níveis de navegação: a lista das unidades da obra, e a planilha de
 * itens da unidade escolhida.
 *
 * A diferença de recorte é só de apresentação. Lá existe uma planilha por
 * unidade; aqui existe UMA planilha (`orcamento`) por centro de custo, e cada
 * item carrega a unidade em `orcamento_item.centro_custo_id`. É a mesma
 * informação, e é o que permite montar esta tela sem tocar no banco.
 *
 * Por que a planilha continua no meio do caminho: `orcamento_item.orcamento_id`
 * é NOT NULL, e o combo "Obra" da aba Apropriação do título lista PLANILHAS, não
 * centros de custo (CadastroTituloPage: `rotuloObra`). A planilha é a porta de
 * entrada da apropriação inteira — então ela não sai, ela deixa de ser criada à
 * mão: quem não tem, ganha uma no primeiro salvamento.
 */

interface ItensOrcamentoViewProps {
  /** Lista completa de centros de custo, sem o filtro de ativos. */
  centros: CentroCusto[];
  /** Chamado depois de gravar, para a tela-mãe recarregar a árvore. */
  onAlterou?: () => void;
  /**
   * Avisa a tela-mãe que há alteração não salva.
   *
   * Trocar de aba DESMONTA esta view e o rascunho some. A confirmação precisa
   * acontecer lá em cima, antes da troca — aqui já é tarde.
   */
  onSujoChange?: (sujo: boolean) => void;
}

/** Uma linha da planilha em forma editável. */
interface LinhaItem {
  /** Chave estável de render. Não vai para o banco. */
  chave: string;
  /** Id do `orcamento_item`. Ausente = item novo. */
  id?: string;
  /** Unidade Construtiva. Vazio = item da obra inteira. */
  unidadeId: string;
  codigo: string;
  descricao: string;
  planoContaId: string;
  /** Texto digitado, no formato brasileiro. */
  quantidade: string;
  /** Unidade de medida: vb, h, mês, un... */
  unidadeMedida: string;
  /** Texto digitado, no formato brasileiro. */
  valorUnitarioReais: string;
  /**
   * Total como está gravado hoje. Vale enquanto ninguém mexe em quantidade ou
   * preço — ver `totalCentavosDaLinha`.
   */
  totalOriginalCentavos?: number;
  /** Quantidade ou preço foram editados nesta sessão. */
  valorEditado?: boolean;
}

/** O que é replicado de uma unidade para outra. A unidade em si não entra. */
type ModeloItem = Omit<LinhaItem, 'chave' | 'id' | 'unidadeId'>;

const UNIDADES_MEDIDA = ['vb', 'un', 'h', 'mês', 'm', 'm²', 'm³', 'kg', 't', 'km', 'L'];

let seqChave = 0;
const novaChave = () => `linha-${Date.now()}-${++seqChave}`;

/** "31.500,00" → 3150000. Aceita vazio, ponto de milhar e vírgula decimal. */
function paraCentavos(texto: string): number {
  const limpo = String(texto ?? '').trim().replace(/\./g, '').replace(',', '.');
  if (!limpo) return 0;
  const numero = parseFloat(limpo);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

/** "1,0000" → 1. Quantidade não é dinheiro: mantém as casas decimais. */
function paraNumero(texto: string): number {
  const limpo = String(texto ?? '').trim().replace(/\./g, '').replace(',', '.');
  if (!limpo) return 0;
  const numero = parseFloat(limpo);
  return Number.isFinite(numero) ? numero : 0;
}

function centavosParaTexto(centavos?: number): string {
  if (!centavos) return '';
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/**
 * Total da linha = quantidade × preço unitário, como na referência.
 *
 * Duas ressalvas:
 *
 * - Linha não editada devolve o total COMO ESTÁ GRAVADO. O preço unitário do
 *   banco é NUMERIC(15,4) e a interface do repositório só transporta centavos,
 *   então recalcular um item que ninguém tocou mudaria o valor dele sozinho —
 *   e a tela regrava a planilha inteira a cada salvamento.
 * - Quantidade vazia vale 1 (é o caso do item de verba, `vb`); quantidade
 *   digitada como 0 vale 0, senão zerar uma linha manteria o preço cheio.
 *
 * Arredonda no fim: quantidade fracionária (0,3333 h) vezes centavos dá fração
 * de centavo, e `valor_total` é NUMERIC(15,2).
 */
function totalCentavosDaLinha(linha: LinhaItem): number {
  if (!linha.valorEditado && linha.totalOriginalCentavos != null) {
    return linha.totalOriginalCentavos;
  }
  const qtd = linha.quantidade.trim() === '' ? 1 : paraNumero(linha.quantidade);
  const unit = paraCentavos(linha.valorUnitarioReais);
  return Math.round(qtd * unit);
}

/** A linha nunca recebeu conteúdo — placeholder do botão "Novo Item". */
function linhaVazia(l: LinhaItem): boolean {
  return !l.id && !l.descricao.trim() && !l.valorUnitarioReais.trim();
}

export function ItensOrcamentoView({ centros, onAlterou, onSujoChange }: ItensOrcamentoViewProps) {
  const toast = useToast();

  const [ccId, setCcId] = useState('');
  const [planilhas, setPlanilhas] = useState<Orcamento[]>([]);
  const [planilhaId, setPlanilhaId] = useState('');
  /** Contas de custo — o que a tela oferece para item novo. */
  const [planos, setPlanos] = useState<PlanoConta[]>([]);
  /**
   * Todas as contas ativas. Existe só para dar NOME à conta de um item que está
   * fora da lista de custo — ver `opcoesDePlano`.
   */
  const [planosTodos, setPlanosTodos] = useState<PlanoConta[]>([]);
  const [linhas, setLinhas] = useState<LinhaItem[]>([]);

  /** null = nível 1 (lista de unidades). Preenchido = planilha da unidade. */
  const [unidadeAberta, setUnidadeAberta] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  const [modalReplicar, setModalReplicar] = useState(false);
  const [unidadeModeloId, setUnidadeModeloId] = useState('');
  const [modalCopiar, setModalCopiar] = useState(false);
  const [ccOrigemId, setCcOrigemId] = useState('');
  const [copiando, setCopiando] = useState(false);

  /**
   * Centros de custo oferecidos: raízes ativas que já têm unidade construtiva.
   *
   * O tipo não filtra de propósito — `frota` (MÁQUINAS), `obra` e o híbrido
   * `centro_custo_obra` são todos válidos aqui. Sem unidade construtiva não há
   * o que amarrar, então esses ficam de fora.
   */
  const centrosComUnidades = useMemo(
    () =>
      centros
        .filter((c) => !c.parentId && c.ativo && centros.some((f) => f.parentId === c.id && f.ativo))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })),
    [centros]
  );

  const centroAtual = centros.find((c) => c.id === ccId) || null;
  const unidades = useMemo(
    () => (ccId ? unidadesConstrutivasDe(centros, ccId) : []),
    [centros, ccId]
  );
  const planilhaAtual = planilhas.find((p) => p.id === planilhaId) || null;
  const somenteLeitura = planilhaAtual?.status === 'aprovado';

  const planoPadraoId = planos[0]?.id || '';

  /*
   * O aviso de rascunho sobe por uma ref, não pela dependência do efeito.
   *
   * A tela-mãe passa a função inline, então a identidade dela muda a cada
   * render; com `onSujoChange` na lista de dependências o efeito de limpeza
   * dispararia junto, zerando o aviso logo depois de levantá-lo.
   */
  const avisarSujoRef = useRef(onSujoChange);
  avisarSujoRef.current = onSujoChange;

  useEffect(() => {
    avisarSujoRef.current?.(sujo);
  }, [sujo]);

  // Sair da aba não deixa a tela-mãe achando que ainda há rascunho.
  useEffect(() => () => avisarSujoRef.current?.(false), []);

  useEffect(() => {
    erpRepository
      .getPlanoContas({ apenasAtivos: true })
      .then((pcs) => {
        setPlanosTodos(pcs);
        setPlanos(planosDeCusto(pcs));
      })
      .catch(() => {
        setPlanosTodos([]);
        setPlanos([]);
      });
  }, []);

  /**
   * As contas oferecidas na linha.
   *
   * A lista base é a de custo. Quando o item já está gravado com uma conta fora
   * dela — item antigo, classificado em receita antes do filtro existir — essa
   * conta entra também, sinalizada. Sem isso o `select` não teria opção com o
   * valor do estado, mostraria a primeira da lista, e o salvamento trocaria a
   * classificação de um item que ninguém pediu para mexer.
   */
  function opcoesDePlano(planoContaId: string): PlanoConta[] {
    if (!planoContaId || planos.some((p) => p.id === planoContaId)) return planos;
    const fora = planosTodos.find((p) => p.id === planoContaId);
    return fora ? [fora, ...planos] : planos;
  }

  // Primeiro centro de custo elegível já vem escolhido.
  useEffect(() => {
    if (!ccId && centrosComUnidades.length > 0) setCcId(centrosComUnidades[0].id);
  }, [centrosComUnidades, ccId]);

  useEffect(() => {
    if (!ccId) return;
    carregarPlanilhas(ccId);
    setUnidadeAberta(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ccId]);

  /*
   * Só a última solicitação pode mandar na tela.
   *
   * Trocar de centro de custo duas vezes seguidas dispara duas leituras, e a
   * mais lenta pode chegar por último — deixando a planilha do centro de custo
   * ERRADO montada numa tela cujo botão seguinte grava por cima. Mesmo padrão
   * de `exclusaoReqRef` na tela de Orçamentos.
   */
  const reqRef = useRef(0);

  async function carregarPlanilhas(centroCustoId: string, manterPlanilhaId?: string) {
    const requisicao = ++reqRef.current;
    setCarregando(true);
    try {
      const lista = await erpRepository.getOrcamentos({ centroCustoId });
      if (requisicao !== reqRef.current) return;
      setPlanilhas(lista);

      const escolhida =
        (manterPlanilhaId && lista.find((o) => o.id === manterPlanilhaId)) || lista[0] || null;
      setPlanilhaId(escolhida?.id || '');
      setLinhas(escolhida ? paraLinhas(escolhida) : []);
      setSujo(false);
    } catch (err) {
      if (requisicao !== reqRef.current) return;
      toast.error('Não foi possível carregar as planilhas', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
      setPlanilhas([]);
      setPlanilhaId('');
      setLinhas([]);
    } finally {
      if (requisicao === reqRef.current) setCarregando(false);
    }
  }

  function paraLinhas(orc: Orcamento): LinhaItem[] {
    return (orc.itens || []).map((it) => ({
      chave: it.id,
      id: it.id,
      unidadeId: it.centroCustoId || '',
      codigo: it.codigo || '',
      descricao: it.descricao || '',
      // A conta gravada manda, mesmo fora da lista de custo — `opcoesDePlano`
      // a mantém escolhível para o usuário decidir, em vez de trocá-la sozinho.
      planoContaId: it.planoContaId || '',
      quantidade: it.quantidade != null ? String(it.quantidade).replace('.', ',') : '1',
      unidadeMedida: it.unidade || 'vb',
      valorUnitarioReais: centavosParaTexto(
        it.valorUnitarioCentavos != null ? it.valorUnitarioCentavos : it.valorTotalCentavos
      ),
      totalOriginalCentavos: it.valorTotalCentavos,
    }));
  }

  /** Trocar de planilha descarta o rascunho da anterior — avisa antes. */
  function trocarPlanilha(novoId: string) {
    if (sujo && !confirm('Há alterações não salvas. Trocar de planilha vai descartá-las. Continuar?')) return;
    const orc = planilhas.find((p) => p.id === novoId);
    setPlanilhaId(novoId);
    setLinhas(orc ? paraLinhas(orc) : []);
    setUnidadeAberta(null);
    setSujo(false);
  }

  const linhasDaUnidade = (unidadeId: string) => linhas.filter((l) => l.unidadeId === unidadeId);

  const totalDaUnidade = (unidadeId: string) =>
    linhasDaUnidade(unidadeId).reduce((s, l) => s + totalCentavosDaLinha(l), 0);

  /**
   * As faixas da tela de nível 1.
   *
   * Começa nas unidades ativas do centro de custo, mas TODA unidade que aparece
   * nos itens entra também: item gravado na obra inteira (sem unidade) e item
   * de unidade que foi desativada depois. Sem isso o valor deles entrava no
   * total e no contador, mas não havia linha para abrir — o item ficava
   * invisível, ineditável e impossível de remover por esta tela.
   */
  const faixas = useMemo(() => {
    const lista = unidades.map((u) => ({ id: u.id, codigo: u.codigo, nome: u.nome, orfa: false }));
    const conhecidas = new Set(lista.map((b) => b.id));

    for (const l of linhas) {
      if (conhecidas.has(l.unidadeId)) continue;
      conhecidas.add(l.unidadeId);

      if (!l.unidadeId) {
        lista.push({ id: '', codigo: '—', nome: 'Toda a obra (sem unidade)', orfa: false });
        continue;
      }
      const cc = centros.find((c) => c.id === l.unidadeId);
      lista.push({
        id: l.unidadeId,
        codigo: cc?.codigo || '—',
        nome: cc ? `${cc.nome} (unidade inativa)` : 'Unidade removida do cadastro',
        orfa: true,
      });
    }
    return lista;
  }, [unidades, linhas, centros]);

  // ---------------------------------------------------------------------------
  // Edição
  // ---------------------------------------------------------------------------

  function alterarLinha(chave: string, campo: keyof LinhaItem, valor: string) {
    if (somenteLeitura) return;
    const mexeNoValor = campo === 'quantidade' || campo === 'valorUnitarioReais';
    setLinhas((prev) =>
      prev.map((l) =>
        l.chave === chave ? { ...l, [campo]: valor, valorEditado: l.valorEditado || mexeNoValor } : l
      )
    );
    setSujo(true);
  }

  function adicionarLinha(unidadeId: string) {
    if (somenteLeitura) return;
    /*
     * A sequência sai do MAIOR código já usado na unidade, não da quantidade de
     * linhas: contar linhas faz o contador recuar quando alguém remove uma do
     * meio, e o item novo nasce com um código que já existe.
     */
    const maior = linhasDaUnidade(unidadeId).reduce((max, l) => {
      const n = parseInt((l.codigo.split('.').pop() || '').replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const ordem = maior + 1;
    setLinhas((prev) => [
      ...prev,
      {
        chave: novaChave(),
        unidadeId,
        codigo: codigoItemOrcamento(ordem),
        descricao: '',
        planoContaId: planoPadraoId,
        quantidade: '1',
        unidadeMedida: 'vb',
        valorUnitarioReais: '',
      },
    ]);
    setSujo(true);
  }

  function removerLinha(chave: string) {
    if (somenteLeitura) return;
    setLinhas((prev) => prev.filter((l) => l.chave !== chave));
    setSujo(true);
  }

  // ---------------------------------------------------------------------------
  // Replicação
  // ---------------------------------------------------------------------------

  /** A lista de itens de uma unidade, sem o que é específico dela. */
  function modeloDaUnidade(unidadeId: string, origem: LinhaItem[] = linhas): ModeloItem[] {
    return origem
      .filter((l) => l.unidadeId === unidadeId && l.descricao.trim())
      .map(({ codigo, descricao, planoContaId, quantidade, unidadeMedida, valorUnitarioReais }) => ({
        codigo,
        descricao,
        planoContaId,
        quantidade,
        unidadeMedida,
        valorUnitarioReais,
      }));
  }

  /**
   * Aplica um modelo em várias unidades.
   *
   * Item de mesma descrição na mesma unidade NÃO é recriado — só entra o que
   * falta. É o que torna o botão repetível sem duplicar a planilha, e o que faz
   * a máquina cadastrada depois receber a lista com um clique.
   */
  function aplicarModelo(modelo: ModeloItem[], unidadesDestino: CentroCusto[]): number {
    let criados = 0;
    const novas: LinhaItem[] = [];

    for (const unidade of unidadesDestino) {
      const jaTem = new Set(
        linhas
          .filter((l) => l.unidadeId === unidade.id)
          .map((l) => l.descricao.trim().toLowerCase())
      );

      for (const item of modelo) {
        const chaveDesc = item.descricao.trim().toLowerCase();
        if (jaTem.has(chaveDesc)) continue;
        jaTem.add(chaveDesc);
        novas.push({ ...item, chave: novaChave(), unidadeId: unidade.id });
        criados++;
      }
    }

    if (criados > 0) {
      setLinhas((prev) => [...prev, ...novas]);
      setSujo(true);
    }
    return criados;
  }

  function confirmarReplicar() {
    const modelo = modeloDaUnidade(unidadeModeloId);
    if (modelo.length === 0) {
      toast.warning('A unidade modelo não tem item nenhum com descrição preenchida.');
      return;
    }
    const destino = unidades.filter((u) => u.id !== unidadeModeloId);
    const criados = aplicarModelo(modelo, destino);
    setModalReplicar(false);

    if (criados === 0) {
      toast.info('Nada a fazer: as outras unidades já têm todos esses itens.');
    } else {
      toast.success(`${criados} item(ns) criado(s) em ${destino.length} unidade(s).`, {
        description: 'Ainda não foi gravado — use Salvar para confirmar.',
      });
    }
  }

  async function confirmarCopiar() {
    if (!ccOrigemId) return;
    setCopiando(true);
    try {
      const origemPlanilhas = await erpRepository.getOrcamentos({ centroCustoId: ccOrigemId });
      const linhasOrigem = origemPlanilhas.flatMap((o) => paraLinhas(o));

      /*
       * O modelo é a união das descrições da origem, não os itens de uma unidade
       * só: um centro de custo pode ter itens diferentes entre as unidades dele,
       * e copiar só a primeira perderia o resto silenciosamente.
       */
      const vistos = new Set<string>();
      const modelo: ModeloItem[] = [];
      let ordem = 0;
      for (const l of linhasOrigem) {
        const chave = l.descricao.trim().toLowerCase();
        if (!chave || vistos.has(chave)) continue;
        vistos.add(chave);
        ordem++;
        modelo.push({
          codigo: codigoItemOrcamento(ordem),
          descricao: l.descricao,
          planoContaId: planos.some((p) => p.id === l.planoContaId) ? l.planoContaId : planoPadraoId,
          quantidade: l.quantidade,
          unidadeMedida: l.unidadeMedida,
          valorUnitarioReais: l.valorUnitarioReais,
        });
      }

      if (modelo.length === 0) {
        toast.warning('O centro de custo de origem não tem item de orçamento nenhum.');
        return; // o `finally` abaixo destrava o botão
      }

      const criados = aplicarModelo(modelo, unidades);
      setModalCopiar(false);

      if (criados === 0) {
        toast.info('Nada a fazer: as unidades já têm todos esses itens.');
      } else {
        toast.success(`${criados} item(ns) copiado(s) para ${unidades.length} unidade(s).`, {
          description: 'Ainda não foi gravado — use Salvar para confirmar.',
        });
      }
    } catch (err) {
      toast.error('Não foi possível copiar os itens', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setCopiando(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Gravação
  // ---------------------------------------------------------------------------

  async function salvar() {
    if (!ccId || somenteLeitura || salvando) return;

    /*
     * Linha nova em que ninguém digitou nada é o placeholder do botão "Novo
     * Item", não um dado: sai do payload em silêncio. O que é recusado é linha
     * COM conteúdo e sem nome — e a mensagem diz em qual unidade ela está,
     * porque a tela grava a planilha inteira e a linha culpada pode estar numa
     * unidade que não é a que está aberta.
     */
    const aGravar = linhas.filter((l) => !linhaVazia(l));

    const semDescricao = aGravar.filter((l) => !l.descricao.trim());
    if (semDescricao.length > 0) {
      const onde = [...new Set(semDescricao.map((l) => faixas.find((f) => f.id === l.unidadeId)?.nome || '—'))];
      toast.error(`${semDescricao.length} item(ns) sem descrição.`, {
        description:
          `Todo item precisa de um nome para ser escolhido na Apropriação.\n` +
          `Em: ${onde.join(', ')}.`,
      });
      return;
    }
    if (!planoPadraoId) {
      toast.error('Não há conta de custo cadastrada no plano de contas.', {
        description: 'Item de orçamento exige um plano financeiro. Cadastre uma conta de despesa antes.',
      });
      return;
    }

    /*
     * O payload leva SEMPRE a planilha inteira, de todas as unidades.
     *
     * `gravarItensOrcamento` apaga do banco todo item que não vier na lista, e
     * `titulo_rateio.orcamento_item_id` é ON DELETE RESTRICT. Mandar só a
     * unidade aberta apagaria as outras — ou falharia no primeiro item já
     * apropriado. O `id` dos itens existentes também vai junto, senão eles
     * seriam recriados com id novo e a apropriação já gravada nos títulos
     * apontaria para o vazio.
     */
    const payload = aGravar.map((l) => ({
      id: l.id,
      codigo: l.codigo.trim() || undefined,
      // O padrão só entra onde NÃO há conta nenhuma. Item que já tem conta
      // gravada mantém a dele, ainda que fora da lista de custo.
      planoContaId: l.planoContaId || planoPadraoId,
      centroCustoId: l.unidadeId || undefined,
      descricao: l.descricao.trim(),
      quantidade: paraNumero(l.quantidade) || undefined,
      unidade: l.unidadeMedida || undefined,
      valorUnitarioCentavos: paraCentavos(l.valorUnitarioReais) || undefined,
      valorTotalCentavos: totalCentavosDaLinha(l),
      periodos: [],
    }));

    setSalvando(true);
    try {
      let planilhaGravadaId = planilhaId;

      if (planilhaAtual) {
        await erpRepository.updateOrcamento(planilhaAtual.id, { itens: payload });
      } else {
        /*
         * Primeira gravação do centro de custo: a planilha nasce aqui.
         *
         * O nome é o do próprio centro de custo porque o combo "Obra" da aba
         * Apropriação mostra o nome DA PLANILHA — assim ele lê "MÁQUINAS · 010"
         * em vez de um rótulo técnico que ninguém reconhece.
         */
        const ano = new Date().getFullYear();
        const nova = await erpRepository.createOrcamento({
          centroCustoId: ccId,
          nome: centroAtual?.nome || 'Itens de Orçamento',
          dataInicio: `${ano}-01-01`,
          dataFim: `${ano}-12-31`,
          observacao: 'Planilha criada pela aba Itens de Orçamento do Centro de Custos.',
          itens: payload.map(({ id, ...resto }) => resto),
        });
        planilhaGravadaId = nova.id;
      }

      await carregarPlanilhas(ccId, planilhaGravadaId);
      onAlterou?.();
      toast.success('Itens de orçamento salvos.', {
        description: `${payload.length} item(ns) em ${centroAtual?.nome || 'centro de custo'}.`,
      });
    } catch (err) {
      toast.error('Não foi possível salvar', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setSalvando(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (centrosComUnidades.length === 0) {
    return (
      <div className="bg-surface rounded-2xl p-12 shadow-soft border border-black/[0.03] text-center">
        <Layers className="w-8 h-8 text-ink-muted mx-auto mb-3" />
        <p className="text-sm font-bold text-ink-primary">Nenhum centro de custo com Unidade Construtiva.</p>
        <p className="text-xs text-ink-muted mt-1 max-w-md mx-auto leading-relaxed">
          Item de Orçamento se amarra a uma Unidade Construtiva. Vá até a aba{' '}
          <strong>Estrutura</strong> e crie ao menos uma unidade dentro de um centro de custo ou obra.
        </p>
      </div>
    );
  }

  const rotuloUnidadeAberta =
    faixas.find((f) => f.id === unidadeAberta)?.nome ?? '';

  return (
    <div className="space-y-4">
      {/* INFORMAÇÕES DA PLANILHA */}
      <div className="bg-surface rounded-2xl p-5 shadow-soft border border-black/[0.03] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand" />
            Informações da Planilha
          </h2>
          {somenteLeitura && (
            <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-amber-200">
              <Lock className="w-3 h-3" />
              Aprovada — somente leitura
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">Obra / Centro de Custo *</label>
            <select
              value={ccId}
              onChange={(e) => {
                if (sujo && !confirm('Há alterações não salvas. Trocar de centro de custo vai descartá-las. Continuar?')) return;
                setCcId(e.target.value);
              }}
              className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {centrosComUnidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} - {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted mb-1">
              {planilhas.length > 1 ? 'Versão da Planilha' : 'Versão'}
            </label>
            {planilhas.length > 1 ? (
              <select
                value={planilhaId}
                onChange={(e) => trocarPlanilha(e.target.value)}
                className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {planilhas.map((p) => (
                  <option key={p.id} value={p.id}>
                    v{p.versao} — {p.nome} [{p.status}]
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary font-mono">
                {planilhaAtual ? `v${planilhaAtual.versao}` : '—'}
              </div>
            )}
          </div>
        </div>

        {!planilhaAtual && !carregando && (
          <div className="bg-indigo-50/70 border border-indigo-200/60 rounded-xl p-3 text-[11px] text-indigo-900 leading-relaxed flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
            <span>
              Este centro de custo ainda não tem planilha de orçamento. Ela será criada automaticamente
              com o nome <strong>{centroAtual?.nome}</strong> quando você salvar os primeiros itens —
              você não precisa passar pela tela de Orçamentos.
            </span>
          </div>
        )}
      </div>

      {carregando ? (
        <div className="bg-surface rounded-2xl p-12 shadow-soft border border-black/[0.03] text-center text-ink-muted font-medium">
          Carregando planilha...
        </div>
      ) : unidadeAberta === null ? (
        /* ---------- NÍVEL 1: as unidades construtivas ---------- */
        <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-black/5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand" />
              Unidades Construtivas
              <span className="text-ink-muted font-medium normal-case tracking-normal">
                • {linhas.length} item(ns) no total
              </span>
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={somenteLeitura || unidades.length < 2}
                onClick={() => {
                  const comMaisItens = [...unidades].sort(
                    (a, b) => linhasDaUnidade(b.id).length - linhasDaUnidade(a.id).length
                  )[0];
                  setUnidadeModeloId(comMaisItens?.id || '');
                  setModalReplicar(true);
                }}
                title={
                  unidades.length < 2
                    ? 'É preciso ter ao menos duas unidades construtivas'
                    : 'Repete a lista de itens de uma unidade nas demais'
                }
                className="flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-black/10 hover:bg-black/5 text-ink-primary rounded-xl text-xs font-semibold shadow-soft transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CopyPlus className="w-4 h-4 text-purple-600" />
                <span>Replicar itens entre as unidades</span>
              </button>

              <button
                type="button"
                disabled={somenteLeitura}
                onClick={() => {
                  const primeiroOutro = centrosComUnidades.find((c) => c.id !== ccId);
                  setCcOrigemId(primeiroOutro?.id || '');
                  setModalCopiar(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-black/10 hover:bg-black/5 text-ink-primary rounded-xl text-xs font-semibold shadow-soft transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Copy className="w-4 h-4 text-brand" />
                <span>Copiar de outro centro de custo</span>
              </button>
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-surface-muted border-b border-black/10 text-[11px] font-bold text-ink-muted uppercase">
                <th className="p-3 w-28">Código</th>
                <th className="p-3">Unidade Construtiva</th>
                <th className="p-3 w-24 text-center">Itens</th>
                <th className="p-3 w-40 text-right">Valor Total</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {faixas.map((f, idx) => {
                const qtd = linhasDaUnidade(f.id).length;
                const foraDaLista = f.orfa || f.id === '';
                return (
                  <tr
                    key={f.id || 'sem-unidade'}
                    onClick={() => setUnidadeAberta(f.id)}
                    className={`cursor-pointer transition-colors hover:bg-brand/[0.04] ${
                      foraDaLista ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-surface' : 'bg-surface-muted/20'
                    }`}
                  >
                    <td className="p-3 font-mono font-bold text-ink-primary">{f.codigo}</td>
                    <td className="p-3 font-semibold text-ink-primary">
                      {f.nome}
                      {f.id === '' && (
                        <span className="ml-2 text-[10px] font-normal text-ink-muted">
                          itens que valem para o centro de custo inteiro
                        </span>
                      )}
                      {f.orfa && (
                        <span className="ml-2 text-[10px] font-normal text-amber-800">
                          itens antigos — abra para mover ou remover
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          foraDaLista
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : qtd > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-surface-muted text-ink-muted border-black/10'
                        }`}
                      >
                        {qtd}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-brand">
                      {formatCurrency(totalDaUnidade(f.id))}
                    </td>
                    <td className="p-3 text-center text-ink-muted">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-black/5 bg-surface-muted/60">
            <span className="text-xs font-bold text-ink-primary">
              Total geral:{' '}
              <span className="font-mono text-brand">
                {formatCurrency(linhas.reduce((s, l) => s + totalCentavosDaLinha(l), 0))}
              </span>
            </span>
            {sujo && !somenteLeitura && (
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="flex items-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{salvando ? `Salvando ${linhas.length} itens...` : 'Salvar alterações'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ---------- NÍVEL 2: os itens da unidade ---------- */
        <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-black/5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUnidadeAberta(null)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 transition-colors"
                title="Voltar para as unidades construtivas"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
                  Itens do Orçamento
                </h2>
                <p className="text-xs text-ink-muted font-semibold">{rotuloUnidadeAberta}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => adicionarLinha(unidadeAberta)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-black/10 hover:bg-black/5 text-ink-primary rounded-xl text-xs font-semibold shadow-soft transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4 text-brand" />
                  <span>Novo Item</span>
                </button>
              )}
              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={salvar}
                  disabled={salvando}
                  className="flex items-center gap-1.5 px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>{salvando ? `Salvando ${linhas.length} itens...` : 'Salvar'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-surface-muted border-b border-black/10 text-[11px] font-bold text-ink-muted uppercase">
                  <th className="p-3 w-24">Código</th>
                  <th className="p-3 min-w-[220px]">Descrição</th>
                  <th className="p-3 min-w-[170px]">Plano Financeiro</th>
                  <th className="p-3 w-24 text-right">Qtde</th>
                  <th className="p-3 w-20">Unidade</th>
                  <th className="p-3 w-32 text-right">Preço Unitário</th>
                  <th className="p-3 w-32 text-right text-brand">Preço Total</th>
                  <th className="p-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {linhasDaUnidade(unidadeAberta).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-ink-muted">
                      Nenhum item nesta unidade construtiva ainda.
                      {!somenteLeitura && ' Use "Novo Item" para começar.'}
                    </td>
                  </tr>
                ) : (
                  linhasDaUnidade(unidadeAberta).map((l, idx) => (
                    <tr key={l.chave} className={idx % 2 === 0 ? 'bg-surface' : 'bg-surface-muted/20'}>
                      <td className="p-2">
                        <input
                          type="text"
                          value={l.codigo}
                          readOnly={somenteLeitura}
                          onChange={(e) => alterarLinha(l.chave, 'codigo', e.target.value)}
                          className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand read-only:bg-transparent read-only:border-transparent"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="Ex: OPERADOR DA MÁQUINA"
                          value={l.descricao}
                          readOnly={somenteLeitura}
                          onChange={(e) => alterarLinha(l.chave, 'descricao', e.target.value)}
                          className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand read-only:bg-transparent read-only:border-transparent"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={l.planoContaId}
                          disabled={somenteLeitura}
                          onChange={(e) => alterarLinha(l.chave, 'planoContaId', e.target.value)}
                          className={`w-full bg-surface border rounded-lg px-2 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-transparent disabled:border-transparent ${
                            l.planoContaId && !planos.some((p) => p.id === l.planoContaId)
                              ? 'border-amber-400 bg-amber-50/60'
                              : 'border-black/10'
                          }`}
                          title={
                            l.planoContaId && !planos.some((p) => p.id === l.planoContaId)
                              ? 'Este item está classificado numa conta que não é de custo. Foi mantida como estava — troque se quiser corrigir.'
                              : undefined
                          }
                        >
                          {!l.planoContaId && <option value="">Selecione a conta...</option>}
                          {opcoesDePlano(l.planoContaId).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.codigo} - {p.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={l.quantidade}
                          readOnly={somenteLeitura}
                          onChange={(e) => alterarLinha(l.chave, 'quantidade', e.target.value)}
                          className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1.5 text-xs font-mono text-right text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand read-only:bg-transparent read-only:border-transparent"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={l.unidadeMedida}
                          disabled={somenteLeitura}
                          onChange={(e) => alterarLinha(l.chave, 'unidadeMedida', e.target.value)}
                          className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-transparent disabled:border-transparent"
                        >
                          {UNIDADES_MEDIDA.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={l.valorUnitarioReais}
                          readOnly={somenteLeitura}
                          onChange={(e) => alterarLinha(l.chave, 'valorUnitarioReais', e.target.value)}
                          className="w-full bg-surface border border-black/10 rounded-lg px-2 py-1.5 text-xs font-mono text-right text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand read-only:bg-transparent read-only:border-transparent"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-brand">
                        {formatCurrency(totalCentavosDaLinha(l))}
                      </td>
                      <td className="p-2 text-center">
                        {!somenteLeitura && (
                          <button
                            type="button"
                            onClick={() => removerLinha(l.chave)}
                            title="Remover item"
                            className="p-1 rounded-lg text-ink-muted hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-black/5 bg-surface-muted/60">
            <span className="text-xs text-ink-muted">
              {linhasDaUnidade(unidadeAberta).length} item(ns) nesta unidade
            </span>
            <span className="text-xs font-bold text-ink-primary">
              Total da unidade:{' '}
              <span className="font-mono text-brand">{formatCurrency(totalDaUnidade(unidadeAberta))}</span>
            </span>
          </div>
        </div>
      )}

      {/* MODAIS */}
      <AnimatePresence>
        {modalReplicar && (
          <ModalBase titulo="Replicar itens entre as unidades" onFechar={() => setModalReplicar(false)}>
            <div className="space-y-3">
              <p className="text-[11px] text-ink-muted leading-relaxed">
                A lista de itens da unidade escolhida é repetida nas demais unidades deste centro de
                custo. Item de mesma descrição que já exista não é recriado.
              </p>
              <div>
                <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                  Unidade modelo *
                </label>
                <select
                  value={unidadeModeloId}
                  onChange={(e) => setUnidadeModeloId(e.target.value)}
                  className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.codigo} - {u.nome} ({linhasDaUnidade(u.id).length} itens)
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-surface-muted rounded-xl border border-black/5 p-3 text-[11px] text-ink-primary">
                Serão avaliadas <strong>{Math.max(unidades.length - 1, 0)}</strong> outras unidades, com
                até <strong>{modeloDaUnidade(unidadeModeloId).length}</strong> item(ns) cada.
              </div>
            </div>
            <ModalAcoes
              onCancelar={() => setModalReplicar(false)}
              onConfirmar={confirmarReplicar}
              rotulo="Replicar"
              desabilitado={!unidadeModeloId}
            />
          </ModalBase>
        )}

        {modalCopiar && (
          <ModalBase titulo="Copiar itens de outro centro de custo" onFechar={() => setModalCopiar(false)}>
            <div className="space-y-3">
              <p className="text-[11px] text-ink-muted leading-relaxed">
                A lista de itens do centro de custo de origem é aplicada a{' '}
                <strong>todas as {unidades.length} unidades</strong> de{' '}
                <strong>{centroAtual?.nome}</strong>. Item de mesma descrição que já exista não é
                recriado.
              </p>
              <div>
                <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                  Centro de custo de origem *
                </label>
                <select
                  value={ccOrigemId}
                  onChange={(e) => setCcOrigemId(e.target.value)}
                  className="w-full bg-surface-muted border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Selecione...</option>
                  {centros
                    .filter((c) => !c.parentId && c.id !== ccId)
                    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} - {c.nome}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <ModalAcoes
              onCancelar={() => setModalCopiar(false)}
              onConfirmar={confirmarCopiar}
              rotulo={copiando ? 'Copiando...' : 'Copiar itens'}
              desabilitado={!ccOrigemId || copiando}
            />
          </ModalBase>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Casca de modal — mesmo visual dos modais da tela de Centro de Custos. */
function ModalBase({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-black/10 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 shrink-0">
          <h3 className="text-base font-bold text-ink-primary">{titulo}</h3>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-black/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </motion.div>
    </div>
  );
}

function ModalAcoes({
  onCancelar,
  onConfirmar,
  rotulo,
  desabilitado,
}: {
  onCancelar: () => void;
  onConfirmar: () => void;
  rotulo: string;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-black/5">
      <button
        type="button"
        onClick={onCancelar}
        className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5 transition-colors"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={onConfirmar}
        disabled={desabilitado}
        className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {rotulo}
      </button>
    </div>
  );
}

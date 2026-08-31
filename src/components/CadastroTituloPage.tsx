'use client';

/**
 * CADASTRO DE TÍTULOS A PAGAR / A RECEBER
 *
 * Tela de página inteira espelhada no formulário do ERP legado:
 * cabeçalho com trilha de abas e consistência do registro, labels alinhadas à
 * direita, campos de lookup com lupa, datas com botão de calendário e seções
 * colapsáveis.
 *
 * O registro é dividido em abas (Cadastro, Parcelas, Alocação e Apropriação),
 * mas continua sendo um único formulário: a validação é global e a barra de
 * ações fica visível em todas elas.
 *
 * Regras de negócio preservadas do fluxo anterior:
 *  - diferença de centavos do parcelamento vai toda na última parcela;
 *  - a soma das parcelas precisa bater exatamente com o valor líquido do título;
 *  - a apropriação por centro de custo precisa somar 100,00%;
 *  - estouro de orçamento não bloqueia, mas exige confirmação explícita.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  erpRepository,
  Pessoa,
  PlanoConta,
  CentroCusto,
  Subempresa,
  TipoTitulo,
  DisponibilidadeOrcamentariaResultado,
  TituloAuditLog,
  GrupoGestao,
  LinhaGestao,
  Orcamento,
  OrcamentoItem,
} from '@/data';
import { formatCurrency, formatDate, formatDocument, formatAuditDateHora } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import {
  ErpRow,
  ErpInput,
  ErpMoney,
  ErpDate,
  ErpLookup,
  ErpTextarea,
  ErpCheck,
  ErpSection,
  ErpLookupModal,
  ErpButton,
  ErpGridButton,
  ErpTabs,
  LookupItem,
  erpField,
  parseCentavos,
  formatCentavos,
  normalizeMoney,
} from './erp/ErpForm';
import { useToast } from './ui/ToastProvider';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Paperclip,
  ShieldCheck,
  UserCheck,
  Clock,
  History,
  User,
  Layers,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Tabelas auxiliares fixas                                            */
/* ------------------------------------------------------------------ */

const TIPOS_DOCUMENTO: LookupItem[] = [
  { id: 'AV', codigo: 'AV', nome: 'AVISO DE LANÇAMENTO' },
  { id: 'BOLE', codigo: 'BOLE', nome: 'BOLETO REAL' },
  { id: 'CDC', codigo: 'CDC', nome: 'CARTÃO DE CREDITO' },
  { id: 'CHE', codigo: 'CHE', nome: 'CHEQUE' },
  { id: 'DIN', codigo: 'DIN', nome: 'DINHEIRO' },
  { id: 'EMP', codigo: 'EMP', nome: 'EMPRESTIMO' },
  { id: 'FPAG', codigo: 'FPAG', nome: 'FOLHA DE PAGAMENTO' },
  { id: 'FRH', codigo: 'FRH', nome: 'FOLHA DE PAGAMENTO RH' },
  { id: 'GUIA', codigo: 'GUIA', nome: 'GUIAS DE RECOLHIMENTO DE IMPOSTOS' },
  { id: 'NF', codigo: 'NF', nome: 'NOTA FISCAL' },
  { id: 'PIX', codigo: 'PIX', nome: 'PAGAMENTO VIA PIX' },
];

const INDEXADORES: LookupItem[] = [
  { id: '0', codigo: '0', nome: 'REAL' },
  { id: '1', codigo: '1', nome: 'IGP-M' },
  { id: '2', codigo: '2', nome: 'IPCA' },
  { id: '3', codigo: '3', nome: 'INCC' },
];

const hoje = () => new Date().toISOString().split('T')[0];

/** "p-12" -> "000012" (o legado exibe credor/empresa por código numérico). */
function codigoSequencial(id: string): string {
  const digits = id.replace(/\D/g, '');
  return digits ? digits.padStart(6, '0') : id.toUpperCase();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

interface ItemParcelaState {
  numero: number;
  dataVencimento: string;
  valorReais: string;
}

/**
 * Uma linha da aba Apropriação:
 * Nome da Obra → Unidade Construtiva → Item de Orçamento.
 *
 * **A OBRA É O ORÇAMENTO.** "BOCA DE LOBO", "REFORMA COZINHA" e "CALÇADA" são
 * obras; o centro de custo que as contém (`GRAAL TAQUARI - FASE 7`) é só o
 * denominador que as agrupa, e não aparece como escolha.
 *
 * Antes a obra era o centro de custo raiz, e como um centro de custo carrega
 * várias planilhas foi preciso uma coluna "Orçamento" para desempatar. Com a
 * obra sendo a própria planilha, escolher a obra já escolhe o orçamento e a
 * coluna extra deixou de existir.
 *
 * Quais obras aparecem é decidido pela LINHA DE GESTÃO alocada na aba anterior:
 * a linha reúne centros de custo, e os orçamentos deles são as obras.
 */
interface ItemRateioState {
  /**
   * A obra — isto é, o id do ORÇAMENTO. **Não é gravado**: o item já pertence a
   * um orçamento só, então na releitura a obra é deduzida do item.
   */
  orcamentoId: string;
  /**
   * Destino do lançamento — é ele que vai para o banco, na coluna
   * centro_custo_id. É a Unidade Construtiva escolhida ou, quando a obra não
   * tem unidades, o próprio centro de custo do orçamento.
   */
  unidadeId: string;
  /** Item da planilha orçamentária da obra. Define o plano de contas gravado. */
  orcamentoItemId?: string;
  percentualStr: string;
  valorReais: string;
}

/*
 * Anexos de título ainda não existem: não há tabela no banco nem Storage.
 * O estado, os handlers de upload e o tipo AnexoState viviam aqui sem nenhuma
 * interface que os acionasse — código morto que anunciava um recurso ausente.
 * Removidos. A implementação está no ROADMAP (tabela `titulo_anexo`).
 */

/**
 * Unidades Construtivas de um centro de custo.
 *
 * Centro de custo sem filhos recebe o lançamento nele mesmo — é o que mantém o
 * título lançável enquanto a árvore da obra não foi detalhada.
 */
function unidadesDaObraEm(centroCustos: CentroCusto[], centroCustoId: string): CentroCusto[] {
  if (!centroCustoId) return [];
  const filhos = centroCustos.filter((c) => c.parentId === centroCustoId);
  if (filhos.length > 0) return filhos;
  return centroCustos.filter((c) => c.id === centroCustoId);
}

/**
 * Planilhas que não podem mais receber apropriação:
 * - `encerrado`: o orçamento da obra já foi fechado;
 * - `revisado`: foi substituído por uma revisão, e é a revisão que vale. Sem
 *   este segundo filtro, gerar uma revisão passava a oferecer as DUAS no combo,
 *   e a antiga voltaria a receber lançamento novo.
 *
 * Uma planilha nessas condições que já esteja apontada num rateio gravado
 * continua visível na linha, como opção desabilitada — ver o render da tabela.
 */
const STATUS_FORA_DA_APROPRIACAO = ['encerrado', 'revisado'];

/**
 * As obras que a Apropriação oferece — que agora são os ORÇAMENTOS.
 *
 * O caminho é: linhas de gestão alocadas no título → centros de custo que
 * apontam para elas (`centro_custo.linha_gestao_id`) → orçamentos vivos desses
 * centros de custo.
 *
 * Função de módulo porque a hidratação precisa exatamente da mesma resposta que
 * o combo: quando os dois lados tinham sua própria versão, um título abria com
 * o campo vazio e salvar de novo regravava a apropriação sem a obra.
 */
function obrasDasLinhasGestao(
  orcamentos: Orcamento[],
  centroCustos: CentroCusto[],
  linhaGestaoIds: string[]
): Orcamento[] {
  if (linhaGestaoIds.length === 0) return [];

  const linhas = new Set(linhaGestaoIds);
  /*
   * Entram dois tipos de Grupo Macro:
   * - os atrelados a uma das linhas alocadas;
   * - os GLOBAIS, que acompanham qualquer linha — é o macro que não pertence a
   *   uma linha só (administrativo, frota) e cujas obras podem ser apropriadas
   *   venha o título de onde vier.
   * Sem nenhuma linha alocada nada aparece, nem os globais: a Apropriação
   * continua exigindo a aba anterior.
   */
  const ccIds = new Set(
    centroCustos
      .filter((c) => c.escopoGlobal || (c.linhasGestaoIds ?? []).some((l) => linhas.has(l)))
      .map((c) => c.id)
  );
  if (ccIds.size === 0) return [];

  /*
   * A unidade construtiva herda a linha da obra-mãe: o vínculo é cadastrado no
   * nó de topo, e um orçamento pendurado numa unidade pertence à mesma linha.
   *
   * Repete até parar de crescer: uma passada só pegaria o neto apenas se ele
   * viesse depois do pai na ordenação por código, que é texto livre.
   */
  let cresceu = true;
  while (cresceu) {
    cresceu = false;
    for (const cc of centroCustos) {
      if (cc.parentId && ccIds.has(cc.parentId) && !ccIds.has(cc.id)) {
        ccIds.add(cc.id);
        cresceu = true;
      }
    }
  }

  return orcamentos
    .filter((o) => !STATUS_FORA_DA_APROPRIACAO.includes(o.status) && ccIds.has(o.centroCustoId))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Monta a grade de parcelas. A diferença de arredondamento fica toda na última.
 */
function montarParcelas(
  valorLiquidoCentavos: number,
  qtd: number,
  primeiroVencimento: string,
  intervaloDias: number
): ItemParcelaState[] {
  if (valorLiquidoCentavos <= 0 || qtd <= 0) return [];

  const valorBase = Math.floor(valorLiquidoCentavos / qtd);
  const resto = valorLiquidoCentavos - valorBase * qtd;
  const baseDate = new Date(`${primeiroVencimento || hoje()}T00:00:00`);

  const out: ItemParcelaState[] = [];
  for (let i = 1; i <= qtd; i++) {
    const venc = new Date(baseDate);
    venc.setDate(venc.getDate() + (i - 1) * intervaloDias);

    out.push({
      numero: i,
      dataVencimento: venc.toISOString().split('T')[0],
      valorReais: formatCentavos(i === qtd ? valorBase + resto : valorBase),
    });
  }
  return out;
}

type LookupKey =
  | 'documento'
  | 'empresa'
  | 'credor'
  | 'obra'
  | 'conta'
  | 'indexador'
  | 'unidade'
  | 'itemorcamento';

type Aba = 'cadastro' | 'parcelas' | 'alocacao' | 'apropria-obra';

interface CadastroTituloPageProps {
  tipo: TipoTitulo; // 'P' = Pagar, 'R' = Receber
  /** Quando informado, a tela abre em alteração em vez de inclusão. */
  tituloId?: string;
}

export function CadastroTituloPage({ tipo, tituloId }: CadastroTituloPageProps) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const usuarioLogado = user
    ? `${user.nome} (${user.cargo || 'Administrador'})`
    : 'Renan (Administrativo)';
  const isPagar = tipo === 'P';
  const listaHref = isPagar ? '/contas-pagar' : '/contas-receber';
  const isEdicao = Boolean(tituloId);

  const [aba, setAba] = useState<Aba>('cadastro');
  const [codigoTitulo, setCodigoTitulo] = useState('');
  const [erroGravacao, setErroGravacao] = useState<string | null>(null);
  const [idTituloSalvo, setIdTituloSalvo] = useState<string | null>(tituloId || null);
  const [salvoSucesso, setSalvoSucesso] = useState(false);

  /**
   * Trava a geração automática de parcelas enquanto o título existente está
   * sendo carregado — senão o efeito recriaria as parcelas por cima das gravadas.
   */
  const hidratadoRef = useRef(!tituloId);

  /* ---------------- listas base ---------------- */
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [centroCustos, setCentroCustos] = useState<CentroCusto[]>([]);
  /**
   * Árvore completa — inclui os agrupadores, que `centroCustos` não traz.
   * Usada só para montar a coluna "Centro de Custo" do rateio; os campos que
   * gravam lançamento continuam limitados às folhas.
   */
  const [centroCustosTodos, setCentroCustosTodos] = useState<CentroCusto[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [salvando, setSalvando] = useState(false);

  /* ---------------- cabeçalho do título ---------------- */
  const [tipoDocumento, setTipoDocumento] = useState<LookupItem | null>(null);
  const [numeroDocumento, setNumeroDocumento] = useState('');
  /** Obra / centro de custo do título — alimenta a apropriação. */
  const [centroCustoTituloId, setCentroCustoTituloId] = useState('');
  const [pessoaId, setPessoaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [valorTotalStr, setValorTotalStr] = useState('');
  const [descontoStr, setDescontoStr] = useState('');
  const [qtdParcelas, setQtdParcelas] = useState(1);

  /* ---------------- contabilidade ---------------- */
  const [dataContabil, setDataContabil] = useState('');
  const [planoContaId, setPlanoContaId] = useState('');
  /** Conta carregada de título antigo que não combina com o tipo (P/R). */
  const [planoContaIncompativel, setPlanoContaIncompativel] = useState<string | null>(null);
  const [contabilizarApenasBaixa, setContabilizarApenasBaixa] = useState(false);

  /* ---------------- geração das parcelas ---------------- */
  const [indexador, setIndexador] = useState<LookupItem | null>(null);
  const [dataBase, setDataBase] = useState('');
  const [primeiroVencimento, setPrimeiroVencimento] = useState('');
  const [intervaloDias, setIntervaloDias] = useState(30);
  const [parcelas, setParcelas] = useState<ItemParcelaState[]>([]);
  const [parcelasEditadasManualmente, setParcelasEditadasManualmente] = useState(false);

  /* ---------------- rateio gerencial (grupo / linha de gestão) ---------------- */
  const [rateiosGestao, setRateiosGestao] = useState<
    { grupoGestaoId: string; linhaGestaoId: string; percentualStr: string; valorReais: string }[]
  >([]);

  /* ---------------- apropriação por obra ---------------- */
  const [rateios, setRateios] = useState<ItemRateioState[]>([]);
  /** Planilhas orçamentárias das obras — alimentam a coluna Item de Orçamento. */
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [disponibilidades, setDisponibilidades] = useState<
    Record<number, DisponibilidadeOrcamentariaResultado>
  >({});
  const [confirmarEstouroCheck, setConfirmarEstouroCheck] = useState(false);

  /* ---------------- alocação de títulos (Grupos & Linhas de Gestão) ---------------- */
  const [gruposGestao, setGruposGestao] = useState<GrupoGestao[]>([]);
  const [linhasGestao, setLinhasGestao] = useState<LinhaGestao[]>([]);
  const [grupoGestaoId, setGrupoGestaoId] = useState('');
  const [linhaGestaoId, setLinhaGestaoId] = useState('');

  /* ---------------- janela de consulta e validação ---------------- */
  const [lookupAberto, setLookupAberto] = useState<LookupKey | null>(null);
  /** Linha do rateio que a consulta aberta vai preencher. */
  const [rateioLookupIndex, setRateioLookupIndex] = useState<number | null>(null);

  /** Linha do rateio aberta para edição pelo lápis (as demais ficam em leitura). */
  const [linhaRateioEditando, setLinhaRateioEditando] = useState<number | null>(null);
  /** Indica se o usuário tentou avançar para uma aba bloqueada ou salvar sem preencher os campos obrigatórios. */
  const [tentouAvancar, setTentouAvancar] = useState(false);

  /**
   * Retrato dos campos preenchidos pelo usuário. Comparado com a linha de base
   * (carga do título ou última gravação) para avisar antes de descartar o trabalho.
   */
  const formSnapshot = useMemo(
    () =>
      JSON.stringify([
        tipoDocumento?.codigo ?? null, numeroDocumento, centroCustoTituloId,
        pessoaId, descricao, dataEmissao, observacao, valorTotalStr, descontoStr, qtdParcelas,
        dataContabil, planoContaId, contabilizarApenasBaixa,
        indexador?.codigo ?? null, dataBase, primeiroVencimento, intervaloDias,
        parcelas, rateios, rateiosGestao, grupoGestaoId, linhaGestaoId,
      ]),
    [
      tipoDocumento, numeroDocumento, centroCustoTituloId,
      pessoaId, descricao, dataEmissao, observacao, valorTotalStr, descontoStr, qtdParcelas,
      dataContabil, planoContaId, contabilizarApenasBaixa,
      indexador, dataBase, primeiroVencimento, intervaloDias,
      parcelas, rateios, rateiosGestao, grupoGestaoId, linhaGestaoId,
    ],
  );
  const snapshotSalvo = useRef<string | null>(null);
  const isDirty = snapshotSalvo.current !== null && formSnapshot !== snapshotSalvo.current;

  // Fixa a linha de base depois que a carga terminou. O rAF dá espaço para o
  // efeito que gera as parcelas rodar antes, senão o formulário nasceria "sujo".
  useEffect(() => {
    if (loadingBase) return;
    const id = requestAnimationFrame(() => {
      snapshotSalvo.current = formSnapshot;
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingBase]);

  const { guard } = useUnsavedChanges(isDirty, {
    description:
      'Este título tem alterações que ainda não foram gravadas. Se sair agora, elas serão perdidas.',
  });

  /* ---------------- auditoria e histórico ---------------- */
  const [criadoPor, setCriadoPor] = useState<string>('');
  const [criadoEm, setCriadoEm] = useState<string>('');
  const [alteradoPor, setAlteradoPor] = useState<string>('');
  const [alteradoEm, setAlteradoEm] = useState<string>('');
  const [logsAudit, setLogsAudit] = useState<TituloAuditLog[]>([]);

  /* ------------------------------------------------------------------ */
  /* Carga inicial                                                       */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    let cancelado = false;

    (async () => {
      setLoadingBase(true);
      const [pesList, pcList, ccList, ccTodos, ggList, lgList, orcList] = await Promise.all([
        erpRepository.getPessoas({
          apenasAtivos: true,
          apenasFornecedores: isPagar,
          apenasClientes: !isPagar,
        }),
        erpRepository.getPlanoContasFolhas(),
        erpRepository.getCentroCustosFolhas(),
        erpRepository.getCentrosCusto({ apenasAtivos: true }),
        erpRepository.getGruposGestao({ apenasAtivos: true }),
        erpRepository.getLinhasGestao(undefined, { apenasAtivos: true }),
        erpRepository.getOrcamentos(),
      ]);

      if (cancelado) return;

      setPessoas(pesList);
      setPlanoContas(pcList);
      setCentroCustos(ccList);
      setCentroCustosTodos(ccTodos);
      setGruposGestao(ggList);
      setLinhasGestao(lgList);
      setOrcamentos(orcList);

      if (tituloId) {
        // ---- ALTERAÇÃO: repõe a tela com o que está gravado ----
        const t = await erpRepository.getTituloById(tituloId);
        if (cancelado) return;

        if (t) {
          setCodigoTitulo(t.codigo);
          setTipoDocumento(TIPOS_DOCUMENTO.find((d) => d.codigo === t.serie) || null);
          setNumeroDocumento(t.numeroDocumento || '');
          setPessoaId(t.pessoaId);
          setDescricao(t.descricao || '');
          setDataEmissao(t.dataEmissao);
          setObservacao(t.observacao || '');
          // Desconto não é gravado no título; o valor bruto já vem líquido.
          setValorTotalStr(formatCentavos(t.valorBrutoCentavos));
          setDescontoStr('0,00');
          setQtdParcelas(t.qtdParcelas);
          setDataContabil(t.dataCompetencia);
          /*
           * Títulos antigos podem trazer conta incompatível com o tipo — os
           * primeiros lançamentos do banco ficaram todos em "1.1.01 Locação de
           * equipamentos" (receita) mesmo sendo contas a pagar.
           *
           * Carregar essa conta fazia o salvamento ser recusado sem que o
           * usuário entendesse o motivo: o campo mostrava um valor que o
           * sistema não aceitava. Limpamos e sinalizamos para reclassificar.
           */
          setPlanoContaId(t.planoContaId);
          setPlanoContaIncompativel(null);
          setGrupoGestaoId(t.grupoGestaoId || '');
          // Rateio gerencial gravado; sem ele, o modelo antigo vira uma linha de 100%.
          setRateiosGestao(
            (t.rateiosGestao ?? []).map((r) => ({
              grupoGestaoId: r.grupoGestaoId,
              linhaGestaoId: r.linhaGestaoId || '',
              percentualStr: r.percentual.toFixed(2).replace('.', ','),
              valorReais: formatCentavos(r.valorCentavos),
            }))
          );
          setLinhaGestaoId(t.linhaGestaoId || '');
          // Indexador e data base não são gravados no título; repõe os padrões do legado.
          setIndexador(INDEXADORES[0]);
          setDataBase(hoje());

          // Auditoria
          setCriadoPor(t.createdBy || usuarioLogado);
          setCriadoEm(t.createdAt || '');
          setAlteradoPor(t.updatedBy || '');
          setAlteradoEm(t.updatedAt || '');
          setLogsAudit(t.logsAudit || []);

          const parcelasGravadas = t.parcelas || [];
          if (parcelasGravadas.length > 0) {
            setPrimeiroVencimento(parcelasGravadas[0].dataVencimento);
            setParcelas(
              parcelasGravadas.map((p) => ({
                numero: p.numero,
                dataVencimento: p.dataVencimento,
                valorReais: formatCentavos(p.valorCentavos),
              }))
            );

            // A apropriação do título é a da 1ª parcela (as demais repetem os percentuais).
            const rateiosGravados = parcelasGravadas[0].rateios || [];
            if (rateiosGravados.length > 0) {
              setRateios(
                rateiosGravados.map((r) => {
                  /*
                   * A obra é o orçamento, e o orçamento vem do ITEM gravado —
                   * é o único vínculo que o banco guarda.
                   *
                   * Rateio antigo sem item não tem como dizer de qual obra era:
                   * o campo abre vazio e a pendência cobra o preenchimento.
                   * Chutar a obra a partir do centro de custo seria pior — o
                   * mesmo centro de custo carrega várias obras, que é a razão
                   * de toda esta mudança.
                   */
                  const orcDoItem = r.orcamentoItemId
                    ? orcList.find((o) => o.itens.some((i) => i.id === r.orcamentoItemId))
                    : undefined;

                  return {
                    orcamentoId: orcDoItem?.id || '',
                    unidadeId: r.centroCustoId,
                    orcamentoItemId: r.orcamentoItemId,
                    percentualStr: r.percentual.toFixed(2).replace('.', ','),
                    valorReais: formatCentavos(
                      Math.round((t.valorBrutoCentavos * r.percentual) / 100)
                    ),
                  };
                })
              );
              setCentroCustoTituloId(rateiosGravados[0].centroCustoId);
            }
          }
        }

        // Libera a geração automática só depois do estado carregado ser aplicado.
        setTimeout(() => {
          hidratadoRef.current = true;
        }, 0);
      }
      // ---- INCLUSÃO: formulário começa todo em branco, sem pré-seleções ----

      setLoadingBase(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [isPagar, tituloId]);

  /* ------------------------------------------------------------------ */
  /* Derivados                                                           */
  /* ------------------------------------------------------------------ */

  const valorTotalCentavos = parseCentavos(valorTotalStr);
  const descontoCentavos = parseCentavos(descontoStr);
  const valorLiquidoCentavos = Math.max(0, valorTotalCentavos - descontoCentavos);

  const pessoaSel = pessoas.find((p) => p.id === pessoaId) || null;
  const centroCustoTituloSel = centroCustos.find((cc) => cc.id === centroCustoTituloId) || null;
  /*
   * O combo listava as 25 contas folha, mas o repositório recusa conta de
   * receita em título a pagar (e vice-versa) — dava para escolher uma opção
   * inválida e só descobrir com erro na hora de salvar.
   */
  const planoContasDisponiveis = useMemo(
    () =>
      planoContas.filter((pc) =>
        isPagar ? pc.natureza !== 'receita' : pc.natureza === 'receita'
      ),
    [planoContas, isPagar]
  );

  const planoContaSel = planoContas.find((pc) => pc.id === planoContaId) || null;

  /*
   * Guarda de natureza: título a receber usa conta de receita; a pagar usa
   * custo, despesa ou investimento. Se a conta carregada não obedecer, é
   * removida do campo e o usuário é avisado — em vez de o erro só aparecer
   * ao salvar, com a tela mostrando uma conta que o sistema recusa.
   */
  useEffect(() => {
    if (!planoContaId || planoContas.length === 0) return;
    const pc = planoContas.find((c) => c.id === planoContaId);
    if (!pc) return;

    const compativel = isPagar ? pc.natureza !== 'receita' : pc.natureza === 'receita';
    if (compativel) {
      // Sem este ramo o aviso ficava na tela para sempre, mesmo depois de o
      // usuário escolher a conta certa.
      setPlanoContaIncompativel(null);
    } else {
      // O aviso visual saiu junto com a seção de classificação; sem ele, limpar
      // em silêncio faria o título ser reclassificado sozinho no salvamento.
      // A conta agora vem das linhas de rateio, então só avisamos.
      setPlanoContaIncompativel(`${pc.codigo} ${pc.nome} (${pc.natureza})`);
    }
  }, [planoContaId, planoContas, isPagar]);

  const somaParcelasCentavos = parcelas.reduce((s, p) => s + parseCentavos(p.valorReais), 0);

  /* Derivado, não estado: como estado só era recalculado ao editar uma parcela,
     alterar o valor do título deixava a soma divergente sem acusar nada. */
  const parcelaSumError =
    parcelas.length > 0 && somaParcelasCentavos !== valorLiquidoCentavos
      ? `A soma das parcelas (${formatCurrency(somaParcelasCentavos)}) difere do valor do título (${formatCurrency(valorLiquidoCentavos)}).`
      : null;
  const somaPercentualRateio = rateios.reduce(
    (s, r) => s + (parseFloat(r.percentualStr.replace(',', '.')) || 0),
    0
  );
  const isRateioValido = rateios.length === 0 || Math.abs(somaPercentualRateio - 100) <= 0.01;
  const temAlgumEstouro = Object.values(disponibilidades).some((d) => d?.isEstouro);

  /* ------------------------------------------------------------------ */
  /* Parcelamento automático                                             */
  /* ------------------------------------------------------------------ */

  /*
   * Regenerar as parcelas apagava datas e valores ajustados à mão: bastava
   * voltar à aba Cadastro e mexer em um centavo para perder os vencimentos
   * negociados, sem aviso nenhum.
   *
   * A partir da primeira edição manual, a regeneração automática para. O
   * usuário continua podendo refazer tudo pelo botão "Regerar parcelas", que
   * é explícito e zera essa trava.
   */
  useEffect(() => {
    // Em alteração, não regera por cima das parcelas gravadas durante a carga.
    if (!hidratadoRef.current) return;
    if (parcelasEditadasManualmente) return;
    setParcelas(montarParcelas(valorLiquidoCentavos, qtdParcelas, primeiroVencimento, intervaloDias));
  }, [valorLiquidoCentavos, qtdParcelas, primeiroVencimento, intervaloDias, parcelasEditadasManualmente]);

  const regerarParcelas = () => {
    setParcelas(montarParcelas(valorLiquidoCentavos, qtdParcelas, primeiroVencimento, intervaloDias));
    setParcelasEditadasManualmente(false);
  };

  const handleParcelaChange = (index: number, field: 'dataVencimento' | 'valorReais', value: string) => {
    const copy = [...parcelas];
    copy[index] = { ...copy[index], [field]: value };
    setParcelas(copy);
    setParcelasEditadasManualmente(true);
  };

  const handleAdicionarParcela = () => {
    const proximaNum = parcelas.length + 1;
    let proxVenc = primeiroVencimento || hoje();
    if (parcelas.length > 0) {
      const ultVenc = parcelas[parcelas.length - 1].dataVencimento;
      if (ultVenc) {
        const d = new Date(ultVenc + 'T12:00:00');
        d.setDate(d.getDate() + 30);
        proxVenc = d.toISOString().split('T')[0];
      }
    }

    const somaAtual = parcelas.reduce((s, p) => s + parseCentavos(p.valorReais), 0);
    const restante = Math.max(0, valorLiquidoCentavos - somaAtual);

    const novaParcela: ItemParcelaState = {
      numero: proximaNum,
      dataVencimento: proxVenc,
      valorReais: formatCentavos(restante > 0 ? restante : 0),
    };

    const novas = [...parcelas, novaParcela];
    setParcelas(novas);
    setQtdParcelas(novas.length);
    setParcelasEditadasManualmente(true);
  };

  const handleRemoverParcela = (index: number) => {
    if (parcelas.length <= 1) return;
    const filtradas = parcelas.filter((_, i) => i !== index);
    const reordenadas = filtradas.map((p, i) => ({
      ...p,
      numero: i + 1,
    }));
    setParcelas(reordenadas);
    setQtdParcelas(reordenadas.length);
    setParcelasEditadasManualmente(true);
  };

  const handleDividirParcelasIgualmente = () => {
    if (parcelas.length === 0) return;
    setParcelas(montarParcelas(valorLiquidoCentavos, parcelas.length, primeiroVencimento, 30));
    setParcelasEditadasManualmente(false);
  };

  const somaPercentualGestao = rateiosGestao.reduce(
    (acc, r) => acc + (parseFloat(r.percentualStr.replace(',', '.')) || 0),
    0
  );
  const isRateioGestaoValido =
    rateiosGestao.length === 0 || Math.abs(somaPercentualGestao - 100) <= 0.01;

  /** Recalcula o valor da linha a partir do percentual e do valor do título. */
  const valorDaLinhaGestao = (percentualStr: string) => {
    const perc = parseFloat(percentualStr.replace(',', '.')) || 0;
    return formatCentavos(Math.round((valorLiquidoCentavos * perc) / 100));
  };

  const handleAdicionarGestao = () => {
    const restante = Math.max(0, 100 - somaPercentualGestao);
    const percStr = restante.toFixed(2).replace('.', ',');
    setRateiosGestao((prev) => [
      ...prev,
      { grupoGestaoId: '', linhaGestaoId: '', percentualStr: percStr, valorReais: valorDaLinhaGestao(percStr) },
    ]);
  };

  const handleRemoverGestao = (idx: number) =>
    setRateiosGestao((prev) => prev.filter((_, i) => i !== idx));

  const handleGestaoChange = (
    idx: number,
    campo: 'grupoGestaoId' | 'linhaGestaoId' | 'percentualStr',
    valor: string
  ) => {
    setRateiosGestao((prev) => {
      const copia = [...prev];
      const linha = { ...copia[idx], [campo]: valor };
      // Trocar de grupo invalida a linha escolhida.
      if (campo === 'grupoGestaoId') linha.linhaGestaoId = '';
      if (campo === 'percentualStr') linha.valorReais = valorDaLinhaGestao(valor);
      copia[idx] = linha;
      return copia;
    });
  };

  const handleDividirGestaoIgualmente = () => {
    if (rateiosGestao.length === 0) return;
    const base = Number((100 / rateiosGestao.length).toFixed(2));
    setRateiosGestao((prev) =>
      prev.map((r, i) => {
        // A diferença de arredondamento fica toda na última linha.
        const perc = i === prev.length - 1 ? Number((100 - base * (prev.length - 1)).toFixed(2)) : base;
        const percStr = perc.toFixed(2).replace('.', ',');
        return { ...r, percentualStr: percStr, valorReais: valorDaLinhaGestao(percStr) };
      })
    );
  };

  /* Mudou o valor do título: os percentuais mandam, os valores acompanham. */
  useEffect(() => {
    setRateiosGestao((prev) =>
      prev.map((r) => ({ ...r, valorReais: valorDaLinhaGestao(r.percentualStr) }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorLiquidoCentavos]);

  const linhasGestaoFiltradas = useMemo(() => {
    if (!grupoGestaoId) return [];
    return linhasGestao.filter((l) => l.grupoGestaoId === grupoGestaoId);
  }, [linhasGestao, grupoGestaoId]);

  const grupoGestaoSel = useMemo(
    () => gruposGestao.find((g) => g.id === grupoGestaoId) || null,
    [gruposGestao, grupoGestaoId]
  );
  const linhaGestaoSel = useMemo(
    () => linhasGestao.find((l) => l.id === linhaGestaoId) || null,
    [linhasGestao, linhaGestaoId]
  );

  /* ------------------------------------------------------------------ */
  /* Apropriação por centro de custo                                     */
  /* ------------------------------------------------------------------ */

  // Ao mudar o valor do título, os valores do rateio acompanham os percentuais.
  useEffect(() => {
    setRateios((prev) =>
      prev.map((r) => {
        const perc = parseFloat(r.percentualStr.replace(',', '.')) || 0;
        return { ...r, valorReais: formatCentavos(Math.round((valorLiquidoCentavos * perc) / 100)) };
      })
    );
  }, [valorLiquidoCentavos]);

  /** As linhas de gestão alocadas na aba anterior — é o que filtra as obras. */
  const linhasAlocadas = useMemo(
    () => rateiosGestao.map((r) => r.linhaGestaoId).filter((id): id is string => !!id),
    [rateiosGestao]
  );

  /**
   * As obras que a Apropriação oferece — os ORÇAMENTOS das linhas alocadas.
   *
   * É o elo entre as duas abas: a linha de gestão reúne centros de custo, e os
   * orçamentos deles são as obras. Antes cada linha carregava UMA obra no
   * próprio cadastro (`linha_gestao.centro_custo_id`), o que limitava a uma obra
   * por linha; agora o vínculo mora no centro de custo e várias obras cabem na
   * mesma linha.
   */
  const obrasDisponiveis = useMemo(() => {
    const lista = obrasDasLinhasGestao(orcamentos, centroCustosTodos, linhasAlocadas);

    /*
     * A obra já apropriada no título entra na lista mesmo que hoje não pertença
     * mais a nenhuma linha alocada — planilha encerrada, ou centro de custo que
     * mudou de linha. Sem isto o combo abriria vazio num título gravado, e
     * salvar de novo regravaria a apropriação sem a obra.
     */
    // O Set cresce enquanto acumula: duas linhas na MESMA obra fora da lista
    // acrescentariam a opção duas vezes, com chave de React repetida.
    const jaNaLista = new Set(lista.map((o) => o.id));
    const extras: Orcamento[] = [];
    for (const r of rateios) {
      if (!r.orcamentoId || jaNaLista.has(r.orcamentoId)) continue;
      const orc = orcamentos.find((o) => o.id === r.orcamentoId);
      if (!orc) continue;
      jaNaLista.add(orc.id);
      extras.push(orc);
    }

    return [...lista, ...extras];
  }, [orcamentos, centroCustosTodos, linhasAlocadas, rateios]);

  /** O centro de custo que contém a obra — o "denominador" que a agrupa. */
  const centroCustoDaObra = (orcamentoId: string): CentroCusto | null => {
    const orc = orcamentos.find((o) => o.id === orcamentoId);
    if (!orc) return null;
    return centroCustosTodos.find((c) => c.id === orc.centroCustoId) || null;
  };

  /**
   * Unidades Construtivas da obra: os filhos do centro de custo dela, ou o
   * próprio centro de custo quando a árvore ainda não foi detalhada.
   */
  const unidadesDaObra = (orcamentoId: string): CentroCusto[] => {
    const cc = centroCustoDaObra(orcamentoId);
    return cc ? unidadesDaObraEm(centroCustosTodos, cc.id) : [];
  };

  /**
   * Itens oferecidos para (obra, unidade).
   *
   * Item sem unidade construtiva vale para a obra inteira; item com unidade só
   * aparece na sua.
   */
  const itensDaUnidade = (
    orcamentoId: string,
    unidadeId: string,
    currentItemId?: string
  ): OrcamentoItem[] => {
    let orc = orcamentoId ? orcamentos.find((o) => o.id === orcamentoId) || null : null;

    /*
     * O item já gravado manda mais que a escolha da tela: sem isto, reabrir um
     * título cuja obra saiu da lista (planilha encerrada) mostrava o campo em
     * branco e a regravação perdia a apropriação em silêncio.
     */
    if (!orc && currentItemId) {
      orc = orcamentos.find((o) => o.itens.some((i) => i.id === currentItemId)) || null;
    }
    if (!orc) {
      if (currentItemId) {
        const itemGlobal = itemOrcamentoPorId.get(currentItemId);
        if (itemGlobal) return [itemGlobal];
      }
      return [];
    }
    const list = orc.itens.filter(
      (i) => !i.centroCustoId || !unidadeId || i.centroCustoId === unidadeId || i.id === currentItemId
    );
    if (currentItemId && !list.some((i) => i.id === currentItemId)) {
      const it = orc.itens.find((i) => i.id === currentItemId) || itemOrcamentoPorId.get(currentItemId);
      if (it) list.push(it);
    }
    return list;
  };

  /** Índice de itens por id, para ler o item de uma linha já escolhida. */
  const itemOrcamentoPorId = useMemo(() => {
    const mapa = new Map<string, OrcamentoItem>();
    for (const o of orcamentos) {
      for (const i of o.itens) mapa.set(i.id, i);
    }
    return mapa;
  }, [orcamentos]);

  /** De qual planilha veio um item — é assim que a releitura deduz o orçamento. */
  const orcamentoDoItem = (itemId?: string): Orcamento | null =>
    itemId ? orcamentos.find((o) => o.itens.some((i) => i.id === itemId)) || null : null;

  /**
   * Rótulo da obra no combo — lembrando que a obra É o orçamento.
   *
   * Leva o centro de custo junto porque ele é o denominador que agrupa as obras,
   * e duas obras de linhas diferentes podem ter nome parecido; sem ele, "CALÇADA"
   * de um centro de custo é indistinguível da "CALÇADA" de outro.
   *
   * O `v{n}` só aparece quando a planilha é revisão de outra. Sem isso, a segunda
   * obra de um centro de custo — que nasce "v2" só porque o número é sequencial
   * por centro de custo — seria lida como "revisão 2" de algo que ela não revisa.
   */
  const rotuloObra = (o: Orcamento) => {
    const cc = centroCustosTodos.find((c) => c.id === o.centroCustoId);
    const denominador = cc ? ` · ${cc.codigo}` : '';
    const revisao = o.orcamentoBaseId ? ` (v${o.versao})` : '';
    const situacao = o.status === 'aprovado' ? '' : ` [${o.status}]`;
    return `${o.nome.trim()}${denominador}${revisao}${situacao}`;
  };

  const rotuloItemOrcamento = (i: OrcamentoItem) => {
    const cod = i.codigo ? `${i.codigo} - ` : '';
    const desc = i.descricao || i.planoContaNome;
    const valorEsperado = i.valorTotalCentavos > 0 ? ` (Previsto: ${formatCentavos(i.valorTotalCentavos)})` : '';
    return `${cod}${desc}${valorEsperado}`;
  };

  /**
   * Plano de contas do título = o do item de orçamento da linha de maior valor.
   *
   * A tela não mostra mais plano de contas, mas o banco continua gravando —
   * DRE, dashboard e BI agrupam por ele. Quem define passa a ser o Item de
   * Orçamento escolhido, que já carrega o seu plano.
   */
  const planoContaDominante = (() => {
    const comItem = rateios
      .map((r) => ({ r, item: r.orcamentoItemId ? itemOrcamentoPorId.get(r.orcamentoItemId) : undefined }))
      .filter((x) => !!x.item?.planoContaId);

    if (comItem.length > 0) {
      const maior = comItem.reduce((a, b) =>
        parseCentavos(b.r.valorReais) > parseCentavos(a.r.valorReais) ? b : a
      );
      return maior.item!.planoContaId;
    }
    return planoContaId || (planoContasDisponiveis.length > 0 ? planoContasDisponiveis[0].id : '');
  })();

  /** Primeira unidade da obra — o destino padrão ao criar/trocar uma linha. */
  const unidadePadrao = (orcamentoId: string) => unidadesDaObra(orcamentoId)[0]?.id || '';

  const handleAddRateio = () => {
    if (obrasDisponiveis.length === 0) return;
    const restante = Math.max(0, Number((100 - somaPercentualRateio).toFixed(2)));
    const percStr = restante > 0 ? restante.toFixed(2).replace('.', ',') : '0,00';
    const valStr = formatCentavos(Math.round((valorLiquidoCentavos * restante) / 100));

    // Só pré-seleciona a obra quando há uma única possibilidade: com várias, a
    // escolha é do usuário — chutar uma esconderia a decisão dentro do rateio.
    const orcamentoId = obrasDisponiveis.length === 1 ? obrasDisponiveis[0].id : '';

    setRateios((prev) => [
      ...prev,
      {
        orcamentoId,
        unidadeId: orcamentoId ? unidadePadrao(orcamentoId) : '',
        orcamentoItemId: undefined,
        percentualStr: percStr,
        valorReais: valStr,
      },
    ]);
  };

  const handleRemoveRateio = (index: number) => {
    setRateios((prev) => prev.filter((_, i) => i !== index));
    setLinhaRateioEditando(null);
  };

  const handleRateioChange = (
    idx: number,
    campo: 'orcamentoId' | 'unidadeId' | 'orcamentoItemId',
    valor: string
  ) => {
    setRateios((prev) => {
      const copy = [...prev];
      const item: ItemRateioState = { ...copy[idx], [campo]: valor };

      if (campo === 'orcamentoId') {
        // Trocou a obra: unidade e item da obra anterior não valem mais.
        item.unidadeId = valor ? unidadePadrao(valor) : '';
        item.orcamentoItemId = undefined;
      } else if (campo === 'unidadeId') {
        /*
         * Item preso à unidade antiga precisa cair. Itens sem unidade valem para
         * a obra inteira e sobrevivem à troca — por isso a checagem consulta a
         * lista da unidade nova em vez de limpar sempre.
         */
        const aindaVale = itensDaUnidade(item.orcamentoId, valor, item.orcamentoItemId).some(
          (i) => i.id === item.orcamentoItemId
        );
        if (!aindaVale) item.orcamentoItemId = undefined;
      } else if (campo === 'orcamentoItemId') {
        item.orcamentoItemId = valor || undefined;
      }

      copy[idx] = item;
      return copy;
    });
  };

  /** Joga 100% na primeira obra disponível — o caso comum de título de uma obra só. */
  const handleRateioPadrao = () => {
    const obra = obrasDisponiveis[0];
    if (!obra) return;
    setRateios([
      {
        orcamentoId: obra.id,
        unidadeId: unidadePadrao(obra.id),
        orcamentoItemId: undefined,
        percentualStr: '100,00',
        valorReais: formatCentavos(valorLiquidoCentavos),
      },
    ]);
    setLinhaRateioEditando(null);
  };

  const handleDividirIgualmente = () => {
    if (rateios.length === 0) return;
    const percBase = Number((100 / rateios.length).toFixed(2));

    setRateios(
      rateios.map((r, i) => {
        // A última linha absorve a sobra para fechar 100,00% exato.
        const perc =
          i === rateios.length - 1 ? Number((100 - percBase * (rateios.length - 1)).toFixed(2)) : percBase;
        return {
          ...r,
          percentualStr: perc.toFixed(2).replace('.', ','),
          valorReais: formatCentavos(Math.round((valorLiquidoCentavos * perc) / 100)),
        };
      })
    );
  };

  const handleRateioPercentual = (index: number, valStr: string) => {
    const perc = parseFloat(valStr.replace(',', '.')) || 0;
    const copy = [...rateios];
    copy[index] = {
      ...copy[index],
      percentualStr: valStr,
      valorReais: formatCentavos(Math.round((valorLiquidoCentavos * perc) / 100)),
    };
    setRateios(copy);
  };

  const handleRateioValor = (index: number, valStr: string) => {
    const valCentavos = parseCentavos(valStr);
    const perc = valorLiquidoCentavos > 0 ? (valCentavos / valorLiquidoCentavos) * 100 : 0;
    const copy = [...rateios];
    copy[index] = { ...copy[index], percentualStr: perc.toFixed(2).replace('.', ','), valorReais: valStr };
    setRateios(copy);
  };


  /* ------------------------------------------------------------------ */
  /* Disponibilidade orçamentária                                        */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    /*
     * MÓDULO DE ORÇAMENTO DESATIVADO.
     *
     * Este efeito consultava validarDisponibilidadeOrcamentaria() por linha de
     * rateio e, se acusasse estouro, exigia um checkbox de confirmação para
     * liberar o salvamento do título. Com o Orçamento desligado, esse bloqueio
     * ficaria travando o lançamento com base em dados do mock em memória — não
     * há orçamento cadastrado no banco.
     *
     * Para reativar: restaure a consulta abaixo e remova `inativo: true` do
     * módulo Orçamentos em src/data/departments.ts.
     *
     *   if (isPagar) {                       // <- orçamento é conceito de DESPESA
     *     for (const r of rateios) {
     *       res[i] = await erpRepository.validarDisponibilidadeOrcamentaria(
     *         r.unidadeId, planoDoItem(r), parseCentavos(r.valorReais));
     *     }
     *   }
     *
     * O guarda `isPagar` é obrigatório: sem ele, reativar passaria a exigir
     * confirmação de estouro orçamentário em títulos a RECEBER, invertendo a
     * regra que o resto do sistema aplica (mock.repository.ts filtra tipo === 'P').
     */
    setDisponibilidades({});
    setConfirmarEstouroCheck(false);
  }, [isPagar, planoContaId, rateios, valorLiquidoCentavos]);

  /* ------------------------------------------------------------------ */
  /* Consistência do registro (agrupada por aba)                         */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Consistência do registro & Bloqueio do cadastro inicial            */
  /* ------------------------------------------------------------------ */

  const errosCadastro = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!tipoDocumento) errs.tipoDocumento = 'Informe o tipo de documento.';
    if (!numeroDocumento.trim()) errs.numeroDocumento = 'Informe o número do documento.';
    if (!pessoaId) errs.pessoaId = isPagar ? 'Informe o credor.' : 'Informe o devedor.';
    if (!dataEmissao) errs.dataEmissao = 'Informe a data de emissão.';
    if (valorTotalCentavos <= 0) errs.valorTotal = 'Informe o valor total do título (maior que R$ 0,00).';
    if (descontoCentavos > valorTotalCentavos)
      errs.desconto = 'O desconto não pode ser maior que o valor total.';
    if (!dataContabil) errs.dataContabil = 'Informe a data contábil.';
    if (!primeiroVencimento) errs.primeiroVencimento = 'Informe a data do 1º vencimento.';
    if (!planoContaId) {
      errs.planoContaId = 'Selecione o plano financeiro.';
    } else if (planoContaIncompativel) {
      errs.planoContaId = `O plano financeiro selecionado (${planoContaIncompativel}) é incompatível com título a ${isPagar ? 'pagar' : 'receber'}.`;
    }
    return errs;
  }, [
    tipoDocumento,
    numeroDocumento,
    pessoaId,
    dataEmissao,
    valorTotalCentavos,
    descontoCentavos,
    dataContabil,
    primeiroVencimento,
    planoContaId,
    planoContaIncompativel,
    isPagar,
  ]);

  const isCadastroCompleto = Object.keys(errosCadastro).length === 0;

  const pendenciasPorAba = useMemo(() => {
    const cadastro = Object.values(errosCadastro);

    const parcelasPend: string[] = [];
    if (parcelaSumError) parcelasPend.push(parcelaSumError);

    const alocacaoPend: string[] = [];
    if (rateiosGestao.length > 0 && !isRateioGestaoValido)
      alocacaoPend.push('A alocação por grupo/linha de gestão deve somar 100,00%.');
    if (rateiosGestao.some((r) => !r.grupoGestaoId))
      alocacaoPend.push('Há linha de alocação sem grupo de gestão informado.');

    const apropPend: string[] = [];
    if (rateios.length > 0 && !isRateioValido)
      apropPend.push('A apropriação por obra deve somar 100,00%.');
    /*
     * A obra é a primeira escolha e destrava as outras duas. Título antigo,
     * gravado sem item de orçamento, reabre exatamente aqui: não há como deduzir
     * de qual obra ele era, então o campo vem vazio e esta pendência cobra.
     */
    if (rateios.some((r) => !r.orcamentoId))
      apropPend.push('Há linha de apropriação sem obra informada.');
    // Sem unidade construtiva o rateio iria para o banco com o destino em branco.
    if (rateios.some((r) => r.orcamentoId && !r.unidadeId))
      apropPend.push('Há linha de apropriação sem unidade construtiva informada.');
    /*
     * Item de orçamento só é exigido onde existe item para escolher. Exigir
     * sempre travaria o lançamento em obra cuja planilha ainda está vazia; não
     * exigir nunca deixaria passar em branco justamente onde o orçamento existe
     * — que é o ponto da aba.
     */
    if (
      rateios.some((r) => !r.orcamentoItemId && itensDaUnidade(r.orcamentoId, r.unidadeId).length > 0)
    )
      apropPend.push('Há linha de apropriação sem item de orçamento informado.');
    if (temAlgumEstouro && !confirmarEstouroCheck)
      apropPend.push('Confirme o estouro de orçamento para prosseguir.');

    return {
      cadastro,
      parcelas: parcelasPend,
      alocacao: alocacaoPend,
      'apropria-obra': apropPend,
    };
  }, [
    errosCadastro,
    parcelaSumError,
    isRateioGestaoValido,
    rateiosGestao,
    isRateioValido,
    rateios,
    // A pendência de item de orçamento consulta as planilhas carregadas: sem
    // esta dependência, a checagem ficaria presa ao array vazio do primeiro
    // render e nunca cobraria o item.
    orcamentos,
    temAlgumEstouro,
    confirmarEstouroCheck,
  ]);

  /** Ordem real do processo — a mesma da barra de abas. */
  const ORDEM_ETAPAS: Aba[] = ['cadastro', 'parcelas', 'alocacao', 'apropria-obra'];

  /**
   * Tudo que falta, para liberar o Salvar. Continua exigindo o registro inteiro.
   */
  const pendenciasTotais = useMemo(
    () => ORDEM_ETAPAS.flatMap((etapa) => pendenciasPorAba[etapa]),
    [pendenciasPorAba]
  );
  const consistente = pendenciasTotais.length === 0;

  /**
   * O que a barra inferior mostra: apenas a PRIMEIRA etapa não resolvida.
   *
   * Antes exibia todas as pendências de uma vez, então bastava completar o
   * cadastro básico para a tela já cobrar a apropriação por centro de custo —
   * que é a última etapa do processo, não a primeira. Agora cobra uma etapa por
   * vez, na ordem em que o usuário percorre as abas.
   */
  const pendencias = useMemo(() => {
    const etapa = ORDEM_ETAPAS.find((e) => pendenciasPorAba[e].length > 0);
    return etapa ? pendenciasPorAba[etapa] : [];
  }, [pendenciasPorAba]);

  /** Leva o usuário direto para a aba que tem a primeira pendência. */
  const primeiraAbaComPendencia = (Object.keys(pendenciasPorAba) as Aba[]).find(
    (k) => pendenciasPorAba[k].length > 0
  );

  const abas = [
    { key: 'cadastro', label: 'Cadastro', alerta: !isCadastroCompleto },
    {
      key: 'parcelas',
      label: `Parcelas${parcelas.length > 0 ? ` (${parcelas.length})` : ''}`,
      alerta: pendenciasPorAba.parcelas.length > 0,
      disabled: !isCadastroCompleto,
      disabledReason: 'Preencha o cadastro inicial completo (incluindo o Plano Financeiro) para liberar a aba Parcelas.',
    },
    {
      key: 'alocacao',
      label: 'Alocação de Títulos',
      alerta: false,
      disabled: !isCadastroCompleto,
      disabledReason: 'Preencha o cadastro inicial completo (incluindo o Plano Financeiro) para liberar a aba Alocação de Títulos.',
    },
    {
      key: 'apropria-obra',
      label: 'Apropriação',
      alerta: pendenciasPorAba['apropria-obra'].length > 0,
      disabled: !isCadastroCompleto,
      disabledReason: 'Preencha o cadastro inicial completo (incluindo o Plano Financeiro) para liberar a aba Apropriação.',
    },
  ];

  /**
   * Único caminho para trocar de aba.
   *
   * A barra de abas já respeitava o bloqueio, mas os atalhos em texto
   * chamavam `setAba` direto e furavam a trava — dava para pular o cadastro
   * inicial e cair nas Parcelas com o título ainda sem credor, valor ou
   * vencimento, quebrando a ordem do processo.
   *
   * Aba bloqueada não navega: sinaliza as pendências para o usuário ver o que
   * falta preencher.
   */
  const irParaAba = (destino: Aba) => {
    const alvo = abas.find((a) => a.key === destino);
    if (alvo?.disabled) {
      setTentouAvancar(true);
      return;
    }
    setAba(destino);
  };

  /* ------------------------------------------------------------------ */
  /* Lookups                                                             */
  /* ------------------------------------------------------------------ */

  const lookupConfig: Record<
    LookupKey,
    { title: string; items: LookupItem[]; extraHeader?: string; onSelect: (i: LookupItem) => void }
  > = {
    documento: {
      title: 'Tipos de documento',
      items: TIPOS_DOCUMENTO,
      onSelect: (i) => setTipoDocumento(i),
    },
    empresa: {
      title: 'Empresas',
      items: [],
      onSelect: () => {},
    },
    obra: {
      title: 'Obras / centros de custo',
      items: centroCustos.map((cc) => ({
        id: cc.id,
        codigo: cc.codigo,
        nome: cc.nome,
        extra: cc.tipo.toUpperCase(),
      })),
      extraHeader: 'Tipo',
      onSelect: (i) => handleCentroCustoTituloChange(i.id),
    },
    credor: {
      title: isPagar ? 'Credores' : 'Devedores',
      items: pessoas.map((p) => ({
        id: p.id,
        codigo: codigoSequencial(p.id),
        nome: p.nome,
        extra: formatDocument(p.cpfCnpj),
      })),
      extraHeader: 'CPF / CNPJ',
      onSelect: (i) => handlePessoaChange(i.id),
    },
    conta: {
      title: 'Plano financeiro',
      items: planoContasDisponiveis.map((pc) => ({
        id: pc.id,
        codigo: pc.codigo,
        nome: pc.nome,
        extra: pc.natureza.toUpperCase(),
      })),
      extraHeader: 'Natureza',
      onSelect: (i) => setPlanoContaId(i.id),
    },
    indexador: {
      title: 'Indexadores',
      items: INDEXADORES,
      onSelect: (i) => setIndexador(i),
    },
    unidade: {
      title: 'Unidades construtivas',
      items: centroCustosTodos
        .filter((cc) => !!cc.parentId)
        .map((cc) => ({
          id: cc.id,
          codigo: cc.codigo,
          nome: cc.nome,
          extra: centroCustosTodos.find((o) => o.id === cc.parentId)?.nome ?? '',
        })),
      extraHeader: 'Obra',
      onSelect: (i) => {
        if (rateioLookupIndex === null) return;
        const copy = [...rateios];
        copy[rateioLookupIndex] = { ...copy[rateioLookupIndex], unidadeId: i.id };
        setRateios(copy);
      },
    },
    /*
     * A consulta oferece só os itens que o combo da linha ofereceria.
     *
     * Antes ela listava TODOS os itens de TODOS os orçamentos e escrevia direto
     * no rateio: dava para apropriar num item de outra obra, furando o filtro de
     * obra e unidade sem nenhum aviso.
     */
    itemorcamento: {
      title: 'Itens de orçamento',
      items: (() => {
        const linha = rateioLookupIndex !== null ? rateios[rateioLookupIndex] : null;
        const disponiveis = linha
          ? itensDaUnidade(linha.orcamentoId, linha.unidadeId, linha.orcamentoItemId)
          : [];
        return disponiveis.map((i) => ({
          id: i.id,
          codigo: i.codigo || '',
          nome: i.descricao || i.planoContaNome,
          extra: orcamentoDoItem(i.id)?.nome || '',
        }));
      })(),
      extraHeader: 'Obra',
      onSelect: (i) => {
        if (rateioLookupIndex === null) return;
        const copy = [...rateios];
        copy[rateioLookupIndex] = {
          ...copy[rateioLookupIndex],
          // A obra É o orçamento do item: mantém as duas colunas coerentes.
          orcamentoId: orcamentoDoItem(i.id)?.id || copy[rateioLookupIndex].orcamentoId,
          orcamentoItemId: i.id,
        };
        setRateios(copy);
      },
    },
  };

  /** Resolve um código digitado direto no campo do lookup. */
  const commitCodigo = (key: LookupKey) => (codigo: string) => {
    const alvo = lookupConfig[key].items.find(
      (i) => i.codigo.toLowerCase() === codigo.trim().toLowerCase()
    );
    if (alvo) lookupConfig[key].onSelect(alvo);
  };

  /* ---------------- cascata da hierarquia ---------------- */

  /**
   * O centro de custo do cadastro vira a unidade da apropriação padrão.
   *
   * A OBRA não é derivada daqui: obra passou a ser o orçamento, e o mesmo centro
   * de custo carrega várias. Só a Linha de Gestão alocada diz quais estão em
   * jogo, então a obra fica em branco esperando a escolha — a menos que exista
   * uma só, e aí o `handleAddRateio` já a pré-seleciona.
   */
  const handleCentroCustoTituloChange = (novoCcId: string) => {
    setCentroCustoTituloId(novoCcId);
    const obraUnica = obrasDisponiveis.length === 1 ? obrasDisponiveis[0].id : '';

    /*
     * A unidade só é aproveitada se pertencer à obra escolhida. Emparelhar as
     * duas às cegas gravava uma apropriação cujo centro de custo fica FORA do
     * orçamento que ela consome: o combo de unidade renderizava em branco (o CC
     * não está na árvore da obra) mas a pendência passava, porque `unidadeId`
     * estava preenchido.
     */
    const unidadeVale =
      obraUnica && unidadesDaObra(obraUnica).some((u) => u.id === novoCcId);

    setRateios([
      {
        orcamentoId: obraUnica,
        unidadeId: unidadeVale ? novoCcId : obraUnica ? unidadePadrao(obraUnica) : '',
        orcamentoItemId: undefined,
        percentualStr: '100,00',
        valorReais: formatCentavos(valorLiquidoCentavos),
      },
    ]);
    setLinhaRateioEditando(null);
  };

  /** Fornecedor/cliente traz conta contábil e condição de pagamento padrão. */
  const handlePessoaChange = (novoPessoaId: string) => {
    setPessoaId(novoPessoaId);
    const pes = pessoas.find((p) => p.id === novoPessoaId);
    if (!pes) return;
    if (pes.planoContaPadraoId && planoContasDisponiveis.some((pc) => pc.id === pes.planoContaPadraoId)) {
      setPlanoContaId(pes.planoContaPadraoId);
    }
    if (pes.condicaoPagamentoPadrao && pes.condicaoPagamentoPadrao > 0) {
      setIntervaloDias(pes.condicaoPagamentoPadrao);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Gravação                                                            */
  /* ------------------------------------------------------------------ */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCadastroCompleto || !consistente || salvando) {
      setTentouAvancar(true);
      return;
    }

    setSalvando(true);
    setErroGravacao(null);
    try {
      const descBase = (descricao.trim() || observacao.trim());
      let observacaoFinal = descBase;
      if (temAlgumEstouro) {
        observacaoFinal += `\n[ESTOURO DE ORÇAMENTO CONFIRMADO EM ${new Date().toLocaleString('pt-BR')}]`;
      }
      if (contabilizarApenasBaixa) {
        observacaoFinal += `\n[CONTABILIZAR APENAS A BAIXA]`;
      }

      const defaultCcId = centroCustoTituloId || (centroCustos.length > 0 ? centroCustos[0].id : 'cc-999');
      const rateiosFinal =
        rateios.length > 0
          ? rateios.map((r) => ({
              /*
               * A Unidade Construtiva é o destino gravado; no domínio/banco o
               * campo continua se chamando centroCustoId / centro_custo_id.
               * Sem unidade, cai no centro de custo da obra — que é o que
               * `unidadePadrao` já teria escolhido — e só então no do cadastro.
               */
              centroCustoId:
                r.unidadeId || centroCustoDaObra(r.orcamentoId)?.id || defaultCcId,
              orcamentoItemId: r.orcamentoItemId || undefined,
              // O repositório prefere o plano do item de orçamento; este aqui é
              // só o fallback de quem apropriou em obra ainda sem planilha.
              planoContaId: planoContaId || undefined,
              percentual: parseFloat(r.percentualStr.replace(',', '.')) || 0,
              valorCentavos: parseCentavos(r.valorReais),
            }))
          : [
              {
                centroCustoId: defaultCcId,
                orcamentoItemId: undefined,
                planoContaId: planoContaId || undefined,
                percentual: 100,
                valorCentavos: valorLiquidoCentavos,
              },
            ];

      const parcelasEfetivas =
        parcelas.length > 0
          ? parcelas
          : montarParcelas(valorLiquidoCentavos, qtdParcelas || 1, primeiroVencimento || hoje(), intervaloDias || 30);

      const payload = {
        tipo,
        pessoaId,
        pessoaNome: pessoaSel?.nome,
        grupoGestaoId: grupoGestaoId || undefined,
        linhaGestaoId: linhaGestaoId || undefined,
        planoContaId: planoContaDominante ?? '',
        numeroDocumento,
        serie: tipoDocumento?.codigo,
        dataEmissao,
        dataCompetencia: dataContabil,
        valorBrutoCentavos: valorLiquidoCentavos,
        qtdParcelas: parcelasEfetivas.length,
        descricao: descBase,
        observacao: observacaoFinal,
        usuario: usuarioLogado,
        rateiosGestao: rateiosGestao
          .filter((r) => r.grupoGestaoId)
          .map((r) => ({
            grupoGestaoId: r.grupoGestaoId,
            linhaGestaoId: r.linhaGestaoId || undefined,
            percentual: parseFloat(r.percentualStr.replace(',', '.')) || 0,
            valorCentavos: parseCentavos(r.valorReais),
          })),
        parcelas: parcelasEfetivas.map((p) => ({
          numero: p.numero,
          dataVencimento: p.dataVencimento,
          valorCentavos: parseCentavos(p.valorReais),
          observacao: `Parcela ${p.numero}/${parcelasEfetivas.length}`,
          rateios: rateiosFinal.map((r) => ({
            ...r,
            valorCentavos: Math.round((parseCentavos(p.valorReais) * r.percentual) / 100),
          })),
        })),
      };

      // setCodigoTitulo é assíncrono: ler `codigoTitulo` logo abaixo devolvia o
      // valor antigo e o toast da criação sempre dizia "Novo título".
      let codigoParaMensagem = codigoTitulo;

      const targetId = tituloId || idTituloSalvo;
      if (targetId) {
        const atualizado = await erpRepository.updateTitulo(targetId, payload);
        if (atualizado) {
          setAlteradoPor(atualizado.updatedBy || usuarioLogado);
          setAlteradoEm(atualizado.updatedAt || new Date().toISOString());
          if (atualizado.logsAudit) setLogsAudit(atualizado.logsAudit);
        }
      } else {
        const criado = await erpRepository.createTitulo(payload);
        setIdTituloSalvo(criado.id);
        setCodigoTitulo(criado.codigo);
        codigoParaMensagem = criado.codigo;
        setCriadoPor(criado.createdBy || usuarioLogado);
        setCriadoEm(criado.createdAt || new Date().toISOString());
        if (criado.logsAudit) setLogsAudit(criado.logsAudit);
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/contas-${isPagar ? 'pagar' : 'receber'}/cadastro/${criado.id}`);
        }
      }

      setSalvoSucesso(true);
      // Nova linha de base: o que está na tela agora é o que está gravado.
      snapshotSalvo.current = formSnapshot;
      toast.success(isEdicao ? 'Título atualizado' : 'Título criado', {
        description: `${codigoParaMensagem || 'Novo título'} — ${formatCurrency(valorLiquidoCentavos)}`,
      });
      // Não trocamos mais de aba automaticamente: pular de Cadastro para Parcelas
      // logo após salvar parecia erro de preenchimento, não confirmação.
    } catch (err) {
      setErroGravacao(err instanceof Error ? err.message : 'Não foi possível salvar o título.');
    } finally {
      setSalvando(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const tituloTela = isPagar ? 'CADASTRO DE TÍTULOS A PAGAR' : 'CADASTRO DE TÍTULOS A RECEBER';
  const breadcrumbRaiz = isPagar ? 'Títulos a Pagar' : 'Títulos a Receber';
  const lookup = lookupAberto ? lookupConfig[lookupAberto] : null;

  return (
    <div className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] px-4 sm:px-6 py-5 min-h-[calc(100vh-7rem)]">
      {/* ---------------- Cabeçalho da tela ---------------- */}
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-erp-title tracking-tight">
            {tituloTela}
          </h1>

          <ErpTabs
            raiz={{ label: breadcrumbRaiz, href: listaHref }}
            abas={abas}
            ativa={aba}
            onChange={(k) => irParaAba(k as Aba)}
            onDisabledClick={() => setTentouAvancar(true)}
          />
        </div>

        <div className="text-[12px] text-erp-label md:pt-1">
          Consistência do registro :{' '}
          <span className={consistente ? 'text-emerald-700 font-medium' : 'text-erp-status font-medium'}>
            {consistente ? 'Consistente' : isEdicao ? 'Em alteração' : 'Em inclusão'}
          </span>
        </div>
      </header>

      {loadingBase ? (
        <div className="py-16 text-center text-[12px] text-erp-label/70">Carregando formulário...</div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6">
          {salvoSucesso && (
            <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded-r text-emerald-800 text-[12px] flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Título salvo com sucesso!</strong> Os dados foram salvos. Você pode continuar preenchendo as demais abas (Parcelas, Alocação de Títulos e Apropriação).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSalvoSucesso(false)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold underline ml-2"
              >
                OK
              </button>
            </div>
          )}

          {!isCadastroCompleto && tentouAvancar && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-600 rounded-r text-red-800 text-[12px] flex items-center justify-between shadow-sm animate-pulse">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  <strong>Cadastro Inicial Incompleto:</strong> Preencha os campos obrigatórios destacados em vermelho abaixo (incluindo o Plano Financeiro) para liberar as abas de Parcelas, Alocação de Títulos e Apropriação e salvar o título.
                </span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ABA: CADASTRO                                                */}
          {/* ============================================================ */}
          {aba === 'cadastro' && (
            <>
              <ErpRow label="Título">
                <input
                  type="text"
                  value={codigoTitulo}
                  readOnly
                  disabled
                  title={
                    isEdicao ? 'Código do título em alteração' : 'Gerado automaticamente na gravação'
                  }
                  className={`${erpField} w-[75px] font-mono`}
                />
              </ErpRow>

              <ErpRow
                label="Documento"
                required
                hasError={tentouAvancar && Boolean(errosCadastro.tipoDocumento)}
                error={tentouAvancar ? errosCadastro.tipoDocumento : undefined}
              >
                <ErpLookup
                  codigo={tipoDocumento?.codigo || ''}
                  descricao={tipoDocumento?.nome || ''}
                  options={lookupConfig.documento.items}
                  onSelect={lookupConfig.documento.onSelect}
                  onOpen={() => setLookupAberto('documento')}
                  onCodeCommit={commitCodigo('documento')}
                  required
                  hasError={tentouAvancar && Boolean(errosCadastro.tipoDocumento)}
                />
              </ErpRow>

              <ErpRow
                label="Número do documento"
                required
                hasError={tentouAvancar && Boolean(errosCadastro.numeroDocumento)}
                error={tentouAvancar ? errosCadastro.numeroDocumento : undefined}
              >
                <ErpInput
                  value={numeroDocumento}
                  onChange={(e) => setNumeroDocumento(e.target.value)}
                  placeholder="1234"
                  required
                  widthClass="w-[110px]"
                  hasError={tentouAvancar && Boolean(errosCadastro.numeroDocumento)}
                />
              </ErpRow>

              <ErpRow
                label={isPagar ? 'Credor' : 'Devedor'}
                required
                hasError={tentouAvancar && Boolean(errosCadastro.pessoaId)}
                error={tentouAvancar ? errosCadastro.pessoaId : undefined}
              >
                <ErpLookup
                  codigo={pessoaSel ? codigoSequencial(pessoaSel.id) : ''}
                  middle={pessoaSel ? formatDocument(pessoaSel.cpfCnpj) : ''}
                  middleWidthClass="w-[150px]"
                  descricao={pessoaSel?.nome || ''}
                  options={lookupConfig.credor.items}
                  onSelect={lookupConfig.credor.onSelect}
                  onOpen={() => setLookupAberto('credor')}
                  onCodeCommit={commitCodigo('credor')}
                  required
                  hasError={tentouAvancar && Boolean(errosCadastro.pessoaId)}
                />
              </ErpRow>

              <ErpRow label="Descrição" alignTop>
                <ErpTextarea
                  value={descricao}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDescricao(val);
                    setObservacao(val);
                  }}
                  placeholder="Ex: TROCA DA CORREIA DENTADA E TENSOR, TROCA DA BOMBA D'AGUA - GOL BOLA BRANCO"
                  rows={4}
                />
              </ErpRow>

              <ErpRow
                label="Data de emissão"
                required
                hasError={tentouAvancar && Boolean(errosCadastro.dataEmissao)}
                error={tentouAvancar ? errosCadastro.dataEmissao : undefined}
              >
                <ErpDate
                  value={dataEmissao}
                  onChange={(val) => {
                    setDataEmissao(val);
                    setDataContabil(val);
                  }}
                  required
                  hasError={tentouAvancar && Boolean(errosCadastro.dataEmissao)}
                />
              </ErpRow>

              {/* Com o rótulo acima do campo, "Parcelas" virou um campo próprio
                  em vez de um apêndice à direita do valor total. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <ErpRow
                  label="Valor total"
                  required
                  hasError={tentouAvancar && Boolean(errosCadastro.valorTotal)}
                  error={tentouAvancar ? errosCadastro.valorTotal : undefined}
                >
                  <ErpMoney
                    value={valorTotalStr}
                    onChange={setValorTotalStr}
                    required
                    widthClass="w-[130px]"
                    hasError={tentouAvancar && Boolean(errosCadastro.valorTotal)}
                  />
                </ErpRow>

                <ErpRow label="Parcelas" required>
                  <ErpInput
                    type="number"
                    min={1}
                    max={360}
                    value={qtdParcelas}
                    onChange={(e) => setQtdParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                    widthClass="w-[96px]"
                  />
                </ErpRow>
              </div>

              <ErpRow
                label="Valor do desconto"
                hasError={tentouAvancar && Boolean(errosCadastro.desconto)}
                error={tentouAvancar ? errosCadastro.desconto : undefined}
                trailing={
                  <span className="text-[12px] text-erp-label whitespace-nowrap">
                    Valor do título:{' '}
                    <strong className="font-semibold">{formatCurrency(valorLiquidoCentavos)}</strong>
                  </span>
                }
              >
                <ErpMoney
                  value={descontoStr}
                  onChange={setDescontoStr}
                  widthClass="w-[130px]"
                  hasError={tentouAvancar && Boolean(errosCadastro.desconto)}
                />
              </ErpRow>

              <ErpSection title="Informações para a contabilidade">
                <ErpRow
                  label="Data contábil"
                  required
                  hasError={tentouAvancar && Boolean(errosCadastro.dataContabil)}
                  error={tentouAvancar ? errosCadastro.dataContabil : undefined}
                >
                  <ErpDate
                    value={dataContabil}
                    onChange={setDataContabil}
                    required
                    hasError={tentouAvancar && Boolean(errosCadastro.dataContabil)}
                  />
                </ErpRow>

                <ErpRow label="">
                  <ErpCheck
                    checked={contabilizarApenasBaixa}
                    onChange={setContabilizarApenasBaixa}
                    label="Contabilizar apenas a baixa"
                  />
                </ErpRow>
              </ErpSection>

              <ErpSection title="Informações para geração das parcelas">
                <div className="grid grid-cols-1 gap-x-6">
                  <ErpRow
                    label="Data 1º vencimento"
                    required
                    hasError={tentouAvancar && Boolean(errosCadastro.primeiroVencimento)}
                    error={tentouAvancar ? errosCadastro.primeiroVencimento : undefined}
                  >
                    <ErpDate
                      value={primeiroVencimento}
                      onChange={setPrimeiroVencimento}
                      required
                      hasError={tentouAvancar && Boolean(errosCadastro.primeiroVencimento)}
                    />
                  </ErpRow>
                </div>

                {/* Texto puramente informativo. O atalho clicável que existia aqui
                    convidava a pular o cadastro inicial no meio do preenchimento —
                    a navegação entre abas fica só na barra do topo. */}
                <p className="text-[12px] text-erp-label/70 mt-2">
                  As parcelas podem ser adicionadas, ajustadas e parceladas livremente na aba{' '}
                  <span className="font-medium">Parcelas</span>.
                </p>
              </ErpSection>

              <ErpSection title="Plano Financeiro">
                <ErpRow
                  label="Plano financeiro"
                  required
                  hasError={tentouAvancar && Boolean(errosCadastro.planoContaId)}
                  error={tentouAvancar ? errosCadastro.planoContaId : undefined}
                >
                  <ErpLookup
                    codigo={planoContaSel?.codigo || ''}
                    codeWidthClass="w-[100px]"
                    descricao={
                      planoContaSel
                        ? `${planoContaSel.nome} (${planoContaSel.natureza.toUpperCase()})`
                        : ''
                    }
                    options={lookupConfig.conta.items}
                    onSelect={lookupConfig.conta.onSelect}
                    onOpen={() => setLookupAberto('conta')}
                    onCodeCommit={commitCodigo('conta')}
                    required
                    hasError={tentouAvancar && Boolean(errosCadastro.planoContaId)}
                  />
                </ErpRow>

                {planoContaIncompativel && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded text-amber-800 text-[11px] flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      Conta incompatível com títulos a {isPagar ? 'pagar' : 'receber'}: <strong>{planoContaIncompativel}</strong>. Selecione uma conta de {isPagar ? 'despesa/custo' : 'receita'}.
                    </span>
                  </div>
                )}
              </ErpSection>
            </>
          )}

          {/* ============================================================ */}
          {/* ABA: PARCELAS                                                */}
          {/* ============================================================ */}
          {aba === 'parcelas' && (
            <ErpSection
              title="Parcelas do título"
              aside={
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[12px] ${
                    somaParcelasCentavos === valorLiquidoCentavos
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-erp-req/40 bg-red-50 text-erp-req'
                  }`}
                >
                  {somaParcelasCentavos === valorLiquidoCentavos ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  Total das parcelas: {formatCurrency(somaParcelasCentavos)}
                </span>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200/80">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-erp-label">
                  <span>
                    Valor do título: <strong className="font-semibold">{formatCurrency(valorLiquidoCentavos)}</strong>
                  </span>
                  <span>
                    Quantidade de parcelas: <strong className="font-semibold">{parcelas.length}</strong>
                  </span>
                  <span>
                    1º vencimento:{' '}
                    <strong className="font-semibold">
                      {primeiroVencimento ? formatDate(primeiroVencimento) : '—'}
                    </strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAdicionarParcela}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Parcela
                  </button>

                  <button
                    type="button"
                    onClick={handleDividirParcelasIgualmente}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all border border-slate-300/60"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Dividir igualmente
                  </button>
                </div>
              </div>

              {parcelas.length === 0 ? (
                <div className="border border-erp-border px-3 py-8 text-center text-[12px] text-erp-label/60">
                  Nenhuma parcela cadastrada.{' '}
                  <button
                    type="button"
                    onClick={handleAdicionarParcela}
                    className="text-indigo-600 hover:underline font-bold"
                  >
                    Clique aqui para adicionar a primeira parcela
                  </button>
                  .
                </div>
              ) : (
                <>
                  <div className="border border-erp-border max-h-[420px] overflow-y-auto rounded-xl">
                    <table className="w-full border-collapse text-[12px] text-erp-label">
                      <thead className="sticky top-0">
                        <tr className="bg-erp-head text-[11px] uppercase tracking-wide text-ink-muted">
                          <th className="text-left font-semibold px-3 py-2 border-b border-erp-border w-[90px]">
                            Parcela
                          </th>
                          <th className="text-left font-semibold px-3 py-2 border-b border-erp-border w-[160px]">
                            Vencimento
                          </th>
                          <th className="text-right font-semibold px-3 py-2 border-b border-erp-border">
                            Valor (R$)
                          </th>
                          <th className="text-center font-semibold px-3 py-2 border-b border-erp-border w-[70px]">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {parcelas.map((p, idx) => (
                          <tr key={idx} className={idx % 2 ? 'bg-erp-zebra' : 'bg-white'}>
                            <td className="px-3 py-1.5 border-b border-erp-rule font-mono font-bold">
                              {p.numero}/{parcelas.length}
                            </td>
                            <td className="px-3 py-1.5 border-b border-erp-rule">
                              <div className="flex items-center gap-1.5">
                                <ErpDate
                                  value={p.dataVencimento}
                                  onChange={(v) => handleParcelaChange(idx, 'dataVencimento', v)}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-1.5 border-b border-erp-rule">
                              <div className="flex justify-end">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={p.valorReais}
                                  onChange={(e) => handleParcelaChange(idx, 'valorReais', e.target.value)}
                                  onBlur={(e) =>
                                    handleParcelaChange(idx, 'valorReais', normalizeMoney(e.target.value))
                                  }
                                  className={`${erpField} w-[140px] text-right font-bold text-slate-800`}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-1.5 border-b border-erp-rule text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoverParcela(idx)}
                                disabled={parcelas.length <= 1}
                                title="Remover parcela"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-erp-head">
                          <td
                            colSpan={2}
                            className="px-3 py-2 text-right font-semibold border-t border-erp-border"
                          >
                            Total das parcelas:
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-bold border-t border-erp-border font-mono ${
                              somaParcelasCentavos === valorLiquidoCentavos
                                ? 'text-emerald-700'
                                : 'text-erp-req'
                            }`}
                          >
                            {formatCurrency(somaParcelasCentavos)}
                          </td>
                          <td className="border-t border-erp-border"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {parcelaSumError && (
                    <p className="mt-2 text-[12px] text-erp-req flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {parcelaSumError}
                    </p>
                  )}
                </>
              )}
            </ErpSection>
          )}

          {/* ============================================================ */}
          {/* ABA: ALOCAÇÃO DE TÍTULOS (GRUPO & LINHA DE GESTÃO)           */}
          {/* ============================================================ */}
          {aba === 'alocacao' && (
            <ErpSection
              title="Alocação de Títulos — Grupos & Linhas de Gestão"
              aside={
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[12px] ${
                    isRateioGestaoValido
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-erp-req/40 bg-red-50 text-erp-req'
                  }`}
                >
                  {isRateioGestaoValido ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  Total alocado: {somaPercentualGestao.toFixed(2).replace('.', ',')}%
                </span>
              }
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-erp-label mb-3">
                <span>
                  Valor a alocar:{' '}
                  <strong className="font-semibold">{formatCurrency(valorLiquidoCentavos)}</strong>
                </span>
                <span>
                  Linhas: <strong className="font-semibold">{rateiosGestao.length}</strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleAdicionarGestao}
                  className="px-3 py-1.5 border border-erp-rule bg-white text-[12px] font-semibold text-ink-primary hover:bg-black/[0.03]"
                >
                  + Adicionar linha
                </button>
                <button
                  type="button"
                  onClick={handleDividirGestaoIgualmente}
                  disabled={rateiosGestao.length === 0}
                  className="px-3 py-1.5 border border-erp-rule bg-white text-[12px] font-semibold text-ink-primary hover:bg-black/[0.03] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Dividir igualmente
                </button>
              </div>

              <div className="overflow-x-auto border border-erp-rule">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-black/[0.03] text-erp-label">
                      <th className="px-2 py-1.5 text-left font-semibold border-b border-erp-rule">Grupo de Gestão</th>
                      <th className="px-2 py-1.5 text-left font-semibold border-b border-erp-rule">Linha de Gestão</th>
                      <th className="px-2 py-1.5 text-right font-semibold border-b border-erp-rule w-[110px]">%</th>
                      <th className="px-2 py-1.5 text-right font-semibold border-b border-erp-rule w-[150px]">Valor alocado</th>
                      <th className="px-2 py-1.5 border-b border-erp-rule w-[48px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {rateiosGestao.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-erp-label">
                          Nenhuma linha alocada. O título ficará sem classificação gerencial.
                        </td>
                      </tr>
                    )}

                    {rateiosGestao.map((r, idx) => {
                      const linhasDoGrupo = linhasGestao.filter((l) => l.grupoGestaoId === r.grupoGestaoId);
                      return (
                        <tr key={idx}>
                          <td className="px-2 py-1 border-b border-erp-rule">
                            <select
                              value={r.grupoGestaoId}
                              onChange={(e) => handleGestaoChange(idx, 'grupoGestaoId', e.target.value)}
                              className={`${erpField} w-full`}
                            >
                              <option value="">Selecione...</option>
                              {gruposGestao.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.codigo} - {g.nome}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-2 py-1 border-b border-erp-rule">
                            <select
                              value={r.linhaGestaoId}
                              disabled={!r.grupoGestaoId}
                              onChange={(e) => handleGestaoChange(idx, 'linhaGestaoId', e.target.value)}
                              className={`${erpField} w-full disabled:opacity-50`}
                            >
                              <option value="">
                                {r.grupoGestaoId ? 'Selecione...' : 'Escolha o grupo antes'}
                              </option>
                              {linhasDoGrupo.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.codigo} - {l.nome}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="px-2 py-1 border-b border-erp-rule text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={r.percentualStr}
                              onChange={(e) => handleGestaoChange(idx, 'percentualStr', e.target.value)}
                              className={`${erpField} w-full text-right`}
                            />
                          </td>

                          <td className="px-2 py-1 border-b border-erp-rule text-right font-semibold tabular-nums">
                            {r.valorReais}
                          </td>

                          <td className="px-2 py-1 border-b border-erp-rule text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoverGestao(idx)}
                              title="Remover linha"
                              className="text-erp-icon hover:text-erp-req"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {rateiosGestao.length > 0 && (
                    <tfoot>
                      <tr className="bg-black/[0.03] font-semibold">
                        <td colSpan={2} className="px-2 py-1.5 text-right border-t border-erp-rule">
                          Total
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right border-t border-erp-rule tabular-nums ${
                            isRateioGestaoValido ? 'text-emerald-700' : 'text-erp-req'
                          }`}
                        >
                          {somaPercentualGestao.toFixed(2).replace('.', ',')}%
                        </td>
                        <td className="px-2 py-1.5 text-right border-t border-erp-rule tabular-nums">
                          {formatCentavos(
                            rateiosGestao.reduce((acc, r) => acc + parseCentavos(r.valorReais), 0)
                          )}
                        </td>
                        <td className="border-t border-erp-rule" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {!isRateioGestaoValido && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-erp-req">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  A alocação gerencial deve somar 100,00%.
                </p>
              )}
            </ErpSection>
          )}

          {/* ============================================================ */}
          {/* ABA: APROPRIAÇÃO DE OBRA                                     */}
          {/* ============================================================ */}
          {aba === 'apropria-obra' && (
            <ErpSection
              title="Apropriação por Obra — Unidade Construtiva & Item de Orçamento"
              aside={
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[12px] ${
                    isRateioValido
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-erp-req/40 bg-red-50 text-erp-req'
                  }`}
                >
                  {isRateioValido ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  Total apropriado: {somaPercentualRateio.toFixed(2).replace('.', ',')}%
                </span>
              }
            >
              {obrasDisponiveis.length === 0 && (
                <div className="mb-3 flex items-start gap-2 border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Nenhuma obra disponível.</strong>{' '}
                    {linhasAlocadas.length === 0 ? (
                      <>
                        As obras desta aba vêm da Linha de Gestão escolhida em{' '}
                        <strong>Alocação de Títulos</strong>. Aloque uma linha para ver as obras dela
                        aqui.
                      </>
                    ) : (
                      <>
                        A Linha de Gestão alocada não tem nenhuma obra com orçamento. Vincule os
                        centros de custo a esta linha em <strong>Cadastros → Centro de Custos</strong>{' '}
                        e cadastre a planilha da obra em <strong>Financeiro → Orçamento de Obra</strong>.
                      </>
                    )}{' '}
                    Enquanto isso, o título é lançado em &quot;Não alocado&quot;.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-erp-label mb-3">
                <span>
                  Valor a apropriar:{' '}
                  <strong className="font-semibold">{formatCurrency(valorLiquidoCentavos)}</strong>
                </span>
                <span>
                  Linhas: <strong className="font-semibold">{rateios.length}</strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleAddRateio}
                  disabled={obrasDisponiveis.length === 0}
                  className="px-3 py-1.5 border border-erp-rule bg-white text-[12px] font-semibold text-ink-primary hover:bg-black/[0.03] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Adicionar linha
                </button>
                <button
                  type="button"
                  onClick={handleDividirIgualmente}
                  disabled={rateios.length === 0}
                  className="px-3 py-1.5 border border-erp-rule bg-white text-[12px] font-semibold text-ink-primary hover:bg-black/[0.03] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Dividir igualmente
                </button>
                <button
                  type="button"
                  onClick={handleRateioPadrao}
                  disabled={obrasDisponiveis.length === 0}
                  className="px-3 py-1.5 border border-erp-rule bg-white text-[12px] font-semibold text-ink-primary hover:bg-black/[0.03] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Rateio padrão (100%)
                </button>
              </div>

              <div className="overflow-x-auto border border-erp-rule">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-black/[0.03] text-erp-label">
                      <th className="px-2 py-1.5 text-left font-semibold border-b border-erp-rule">
                        Nome da Obra
                      </th>
                      <th className="px-2 py-1.5 text-left font-semibold border-b border-erp-rule">
                        Unidade Construtiva
                      </th>
                      <th className="px-2 py-1.5 text-left font-semibold border-b border-erp-rule">
                        Item Orçamento
                      </th>
                      <th className="px-2 py-1.5 text-right font-semibold border-b border-erp-rule w-[100px]">
                        %
                      </th>
                      <th className="px-2 py-1.5 text-right font-semibold border-b border-erp-rule w-[140px]">
                        Valor apropriado
                      </th>
                      <th className="px-2 py-1.5 border-b border-erp-rule w-[48px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {rateios.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-erp-label">
                          Nenhuma apropriação informada — o título será alocado em “Não alocado”.
                        </td>
                      </tr>
                    ) : (
                      rateios.map((r, idx) => {
                        const unidades = unidadesDaObra(r.orcamentoId);
                        const ccDaObra = centroCustoDaObra(r.orcamentoId);
                        /*
                         * Obra já apontada que não está mais entre as oferecidas
                         * — planilha encerrada depois do lançamento, ou centro
                         * de custo que mudou de linha de gestão. Sem mostrá-la,
                         * o combo aparecia em branco ao lado de um Item
                         * preenchido e o primeiro toque apagava o item gravado.
                         * Entra como opção DESABILITADA: exibe o que está
                         * gravado sem virar destino de apropriação nova.
                         */
                        const obraDaLinha =
                          orcamentoDoItem(r.orcamentoItemId) ||
                          orcamentos.find((o) => o.id === r.orcamentoId) ||
                          null;
                        const obraForaDaLista =
                          obraDaLinha && !obrasDisponiveis.some((o) => o.id === obraDaLinha.id)
                            ? obraDaLinha
                            : null;
                        const itens = itensDaUnidade(r.orcamentoId, r.unidadeId, r.orcamentoItemId);

                        return (
                          <tr key={idx}>
                            {/* 1. Nome da Obra — é o ORÇAMENTO */}
                            <td className="px-2 py-1 border-b border-erp-rule">
                              <select
                                value={r.orcamentoId}
                                onChange={(e) => handleRateioChange(idx, 'orcamentoId', e.target.value)}
                                title={ccDaObra ? `Centro de custo: ${ccDaObra.codigo} ${ccDaObra.nome}` : undefined}
                                className={`${erpField} w-full`}
                              >
                                <option value="">Selecione a Obra...</option>
                                {obrasDisponiveis.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {rotuloObra(o)}
                                  </option>
                                ))}
                                {obraForaDaLista && (
                                  <option key={obraForaDaLista.id} value={obraForaDaLista.id} disabled>
                                    {rotuloObra(obraForaDaLista)}
                                  </option>
                                )}
                              </select>
                            </td>

                            {/* 2. Unidade Construtiva */}
                            <td className="px-2 py-1 border-b border-erp-rule">
                              <select
                                value={r.unidadeId}
                                disabled={!r.orcamentoId}
                                onChange={(e) => handleRateioChange(idx, 'unidadeId', e.target.value)}
                                className={`${erpField} w-full disabled:opacity-50`}
                              >
                                <option value="">
                                  {r.orcamentoId ? 'Selecione a Unidade...' : 'Escolha a obra antes'}
                                </option>
                                {/* Obra sem unidades cadastradas aparece aqui como a
                                    própria opção: é ela que recebe o lançamento. */}
                                {unidades.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.codigo} - {c.nome}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* 3. Item Orçamento */}
                            <td className="px-2 py-1 border-b border-erp-rule">
                              <select
                                value={r.orcamentoItemId ?? ''}
                                disabled={!r.unidadeId || itens.length === 0}
                                onChange={(e) => handleRateioChange(idx, 'orcamentoItemId', e.target.value)}
                                title={
                                  r.unidadeId && itens.length === 0
                                    ? 'Esta obra não tem itens de orçamento para esta unidade construtiva.'
                                    : undefined
                                }
                                className={`${erpField} w-full disabled:opacity-50`}
                              >
                                <option value="">
                                  {!r.orcamentoId
                                    ? 'Escolha a obra antes'
                                    : !r.unidadeId
                                      ? 'Escolha a unidade antes'
                                      : itens.length === 0
                                        ? 'Sem itens para esta unidade'
                                        : 'Selecione o Item...'}
                                </option>
                                {itens.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {rotuloItemOrcamento(i)}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* 4. % */}
                            <td className="px-2 py-1 border-b border-erp-rule text-right">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.percentualStr}
                                onChange={(e) => handleRateioPercentual(idx, e.target.value)}
                                className={`${erpField} w-full text-right`}
                              />
                            </td>

                            {/* 5. Valor apropriado */}
                            <td className="px-2 py-1 border-b border-erp-rule text-right font-semibold tabular-nums">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={r.valorReais}
                                onChange={(e) => handleRateioValor(idx, e.target.value)}
                                onBlur={(e) => handleRateioValor(idx, normalizeMoney(e.target.value))}
                                className={`${erpField} w-full text-right font-semibold`}
                              />
                            </td>

                            {/* 6. Ações */}
                            <td className="px-2 py-1 border-b border-erp-rule text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRateio(idx)}
                                title="Remover linha"
                                className="text-erp-icon hover:text-erp-req"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {rateios.length > 0 && (
                    <tfoot>
                      <tr className="bg-black/[0.03] font-semibold">
                        {/* Obra + Unidade + Orçamento + Item */}
                        <td colSpan={4} className="px-2 py-1.5 text-right border-t border-erp-rule">
                          Total
                        </td>
                        <td
                          className={`px-2 py-1.5 text-right border-t border-erp-rule tabular-nums ${
                            isRateioValido ? 'text-emerald-700' : 'text-erp-req'
                          }`}
                        >
                          {somaPercentualRateio.toFixed(2).replace('.', ',')}%
                        </td>
                        <td className="px-2 py-1.5 text-right border-t border-erp-rule tabular-nums">
                          {formatCentavos(
                            rateios.reduce((acc, r) => acc + parseCentavos(r.valorReais), 0)
                          )}
                        </td>
                        <td className="border-t border-erp-rule" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {!isRateioValido && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-erp-req">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  A apropriação por obra deve somar 100,00%.
                </p>
              )}
            </ErpSection>
          )}

          {/* ============================================================ */}
          {/* PAINEL DE AUDITORIA E LOGS DO TÍTULO (SIMPLIFICADO)           */}
          {/* ============================================================ */}
          <div className="mt-8 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200/70 pb-3">
              <ShieldCheck className="w-5 h-5 text-brand" />
              <h3 className="font-bold text-slate-800 text-sm">
                Informações de Auditoria
              </h3>
            </div>

            {/* Informações Simples de Autoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Criado Por
                  </span>
                  <span className="font-bold text-slate-800 block text-xs">
                    {criadoPor || usuarioLogado}
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {criadoEm ? formatAuditDateHora(criadoEm) : 'No ato do lançamento'}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Última Alteração Por
                  </span>
                  <span className="font-bold text-slate-800 block text-xs">
                    {alteradoPor || (isEdicao ? usuarioLogado : 'Sem alterações')}
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {alteradoEm ? formatAuditDateHora(alteradoEm) : (isEdicao ? 'Atualizado no salvamento' : 'Nenhuma modificação')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Barra de ações (visível em todas as abas)                     */}
          {/* ============================================================ */}
          {erroGravacao && (
            <div className="mt-6 border border-erp-req/40 bg-red-50 px-3 py-2.5 text-[12px] text-erp-req flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>{erroGravacao}</span>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-erp-rule flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-[12px] min-h-[18px]">
              {consistente ? (
                <span className="text-emerald-700 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Registro consistente, pronto para salvar.
                </span>
              ) : (
                <span className="text-erp-status inline-flex items-center gap-1.5 flex-wrap">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {/* Mostra só a etapa corrente, mas sem esconder que há mais
                      pelo caminho — senão o usuário salvaria achando que acabou. */}
                  {/* A contagem é do TOTAL, não só da etapa exibida: mostrar uma
                      mensagem sem número fazia parecer que restava um bloqueio só. */}
                  {pendenciasTotais.length} pendência(s): {pendencias[0]}
                  {primeiraAbaComPendencia && primeiraAbaComPendencia !== aba && (
                    <button
                      type="button"
                      onClick={() => irParaAba(primeiraAbaComPendencia)}
                      className="text-erp-link hover:underline font-medium"
                    >
                      ir para a aba
                    </button>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <ErpButton variant="secondary" onClick={() => guard(() => router.push(listaHref))}>
                Voltar para lista
              </ErpButton>
              <ErpButton type="submit" disabled={!consistente || salvando}>
                {salvando ? 'Salvando...' : (idTituloSalvo || isEdicao ? 'Salvar Alterações' : 'Salvar')}
              </ErpButton>
            </div>
          </div>
        </form>
      )}

      {/* Janela de consulta compartilhada por todos os lookups */}
      <ErpLookupModal
        open={lookup !== null}
        title={lookup?.title || ''}
        items={lookup?.items || []}
        extraHeader={lookup?.extraHeader}
        onSelect={(item) => lookup?.onSelect(item)}
        onClose={() => {
          setLookupAberto(null);
          setRateioLookupIndex(null);
        }}
      />
    </div>
  );
}

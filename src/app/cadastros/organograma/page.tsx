'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  erpRepository,
  CentroCusto,
  GrupoGestao,
  LinhaGestao,
  Orcamento,
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import {
  Network,
  Search,
  ChevronDown,
  ChevronRight,
  Globe,
  Layers,
  Building2,
  FileText,
  AlertTriangle,
} from 'lucide-react';

/**
 * Organograma: o plano inteiro, de Grupo de Gestão até a obra.
 *
 * Quatro níveis, na ordem em que a Apropriação os usa:
 *   Grupo de Gestão → Linha de Gestão → Grupo Macro (centro de custo) → Obra
 *
 * A obra É o orçamento — é assim que a aba Apropriação passou a enxergar. E o
 * Grupo Macro global aparece à parte, porque ele não pertence a uma linha: as
 * obras dele acompanham qualquer linha alocada.
 */

interface ObraNo {
  id: string;
  nome: string;
  status: string;
  valorCentavos: number;
}

interface MacroNo {
  centroCusto: CentroCusto;
  obras: ObraNo[];
}

interface LinhaNo {
  linha: LinhaGestao;
  macros: MacroNo[];
}

interface GrupoNo {
  grupo: GrupoGestao;
  linhas: LinhaNo[];
}

const STATUS_FORA = ['encerrado', 'revisado'];

export default function OrganogramaPage() {
  const [grupos, setGrupos] = useState<GrupoGestao[]>([]);
  const [linhas, setLinhas] = useState<LinhaGestao[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [gs, ls, ccs, orcs] = await Promise.all([
        erpRepository.getGruposGestao(),
        erpRepository.getLinhasGestao(),
        erpRepository.getCentrosCusto({ apenasAtivos: false }),
        erpRepository.getOrcamentos(),
      ]);
      setGrupos(gs);
      setLinhas(ls);
      setCentros(ccs);
      setOrcamentos(orcs);
      setCarregando(false);
    })();
  }, []);

  const alternar = (id: string) =>
    setFechados((prev) => {
      const proxima = new Set(prev);
      proxima.has(id) ? proxima.delete(id) : proxima.add(id);
      return proxima;
    });

  /** As obras de um Grupo Macro — o orçamento dele e o das unidades construtivas. */
  const obrasDoMacro = useMemo(() => {
    return (cc: CentroCusto): ObraNo[] => {
      const arvore = new Set([cc.id]);
      let cresceu = true;
      while (cresceu) {
        cresceu = false;
        for (const c of centros) {
          if (c.parentId && arvore.has(c.parentId) && !arvore.has(c.id)) {
            arvore.add(c.id);
            cresceu = true;
          }
        }
      }
      /*
       * Só as obras vivas: é o que a Apropriação oferece, e é o que o KPI conta.
       * Listar encerrada/revisada aqui faria o total do macro brigar com o
       * número do topo da tela.
       */
      return orcamentos
        .filter((o) => arvore.has(o.centroCustoId) && !STATUS_FORA.includes(o.status))
        .map((o) => ({
          id: o.id,
          nome: o.nome.trim(),
          status: o.status,
          valorCentavos: o.valorTotalCentavos,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    };
  }, [centros, orcamentos]);

  /** Só os nós de topo carregam vínculo; as unidades herdam. */
  const macrosRaiz = useMemo(() => centros.filter((c) => !c.parentId), [centros]);

  const arvore = useMemo<GrupoNo[]>(() => {
    return grupos
      .map((grupo) => ({
        grupo,
        linhas: linhas
          .filter((l) => l.grupoGestaoId === grupo.id)
          .map((linha) => ({
            linha,
            macros: macrosRaiz
              .filter((cc) => (cc.linhasGestaoIds ?? []).includes(linha.id))
              .map((cc) => ({ centroCusto: cc, obras: obrasDoMacro(cc) })),
          }))
          .sort((a, b) => a.linha.codigo.localeCompare(b.linha.codigo, 'pt-BR')),
      }))
      .sort((a, b) => a.grupo.codigo.localeCompare(b.grupo.codigo, 'pt-BR'));
  }, [grupos, linhas, macrosRaiz, obrasDoMacro]);

  const globais = useMemo<MacroNo[]>(
    () =>
      macrosRaiz
        .filter((cc) => cc.escopoGlobal)
        .map((cc) => ({ centroCusto: cc, obras: obrasDoMacro(cc) })),
    [macrosRaiz, obrasDoMacro]
  );

  /** Grupos Macro que não são globais e não têm linha: não chegam à Apropriação. */
  const semAlcance = useMemo(
    // Só os ativos: cobrar conserto de centro de custo desativado manda o
    // usuário procurar numa tela onde ele nem aparece.
    () => macrosRaiz.filter((cc) => cc.ativo && !cc.escopoGlobal && (cc.linhasGestaoIds ?? []).length === 0),
    [macrosRaiz]
  );

  const termo = busca.trim().toLowerCase();
  const casa = (texto: string) => !termo || texto.toLowerCase().includes(termo);

  /** Um grupo entra na busca se ele, uma linha, um macro ou uma obra casar. */
  const gruposFiltrados = useMemo(() => {
    if (!termo) return arvore;
    return arvore
      .map((g) => ({
        ...g,
        linhas: g.linhas.filter(
          (l) =>
            casa(`${g.grupo.codigo} ${g.grupo.nome}`) ||
            casa(`${l.linha.codigo} ${l.linha.nome}`) ||
            l.macros.some(
              (m) =>
                casa(`${m.centroCusto.codigo} ${m.centroCusto.nome}`) ||
                m.obras.some((o) => casa(o.nome))
            )
        ),
      }))
      .filter((g) => g.linhas.length > 0 || casa(`${g.grupo.codigo} ${g.grupo.nome}`));
  }, [arvore, termo]);

  const totalObras = useMemo(
    () => orcamentos.filter((o) => !STATUS_FORA.includes(o.status)).length,
    [orcamentos]
  );

  if (carregando) {
    return <div className="py-16 text-center text-xs text-ink-muted animate-pulse">Montando o organograma...</div>;
  }

  return (
    <div className="space-y-6 py-6">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
        <div>
          <div className="flex items-center gap-2 text-brand mb-1">
            <Network className="w-5 h-5 stroke-[2.5]" />
            <span className="text-xs font-bold uppercase tracking-wider">Estrutura de Gestão</span>
          </div>
          <h1 className="text-xl font-bold text-ink-primary">Organograma</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Do Grupo de Gestão até a obra — o mesmo caminho que a Apropriação percorre.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-muted px-3 py-2 rounded-xl border border-black/10">
            <Search className="w-4 h-4 text-ink-muted shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar grupo, linha, centro de custo ou obra..."
              className="bg-transparent text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none w-64"
            />
          </div>
        </div>
      </div>

      {/* Contagem */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { rotulo: 'Grupos de Gestão', valor: grupos.length, Icon: Layers },
          { rotulo: 'Linhas de Gestão', valor: linhas.length, Icon: Network },
          { rotulo: 'Grupos Macro', valor: macrosRaiz.length, Icon: Building2 },
          { rotulo: 'Obras vivas', valor: totalObras, Icon: FileText },
        ].map(({ rotulo, valor, Icon }) => (
          <div key={rotulo} className="bg-surface rounded-2xl p-4 shadow-soft border border-black/[0.04]">
            <div className="flex items-center gap-1.5 text-ink-muted">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{rotulo}</span>
            </div>
            <div className="text-xl font-bold font-mono text-ink-primary mt-1">{valor}</div>
          </div>
        ))}
      </div>

      {/* Grupos Macro globais */}
      {globais.length > 0 && (
        <section className="bg-surface rounded-2xl p-5 shadow-soft border border-emerald-200">
          <div className="flex items-start gap-2 mb-3">
            <Globe className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-ink-primary">Grupos Macro globais</h2>
              <p className="text-[11px] text-ink-muted leading-relaxed max-w-2xl">
                Não pertencem a uma linha. As obras destes centros de custo aparecem na Apropriação
                junto com as da linha que for alocada, qualquer que seja ela.
              </p>
            </div>
          </div>
          <div className="space-y-2 pl-6">
            {globais.map((m) => (
              <MacroBloco key={m.centroCusto.id} macro={m} />
            ))}
          </div>
        </section>
      )}

      {/* A árvore */}
      <div className="space-y-3">
        {gruposFiltrados.length === 0 ? (
          <p className="bg-surface rounded-2xl p-8 text-center text-xs text-ink-muted shadow-soft border border-black/[0.03]">
            Nada encontrado para “{busca}”.
          </p>
        ) : (
          gruposFiltrados.map(({ grupo, linhas: linhasDoGrupo }) => {
            const aberto = !fechados.has(grupo.id);
            const qtdObras = linhasDoGrupo.reduce(
              (s, l) => s + l.macros.reduce((s2, m) => s2 + m.obras.length, 0),
              0
            );

            return (
              <section
                key={grupo.id}
                className="bg-surface rounded-2xl shadow-soft border border-black/[0.03] overflow-hidden"
              >
                <button
                  onClick={() => alternar(grupo.id)}
                  aria-expanded={aberto}
                  className="w-full flex items-center gap-2.5 p-4 text-left hover:bg-black/[0.02] transition-colors"
                >
                  {aberto ? (
                    <ChevronDown className="w-4 h-4 text-brand shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                  )}
                  <Layers className="w-4 h-4 text-brand shrink-0" />
                  <span className="font-mono text-xs font-bold text-brand">{grupo.codigo}</span>
                  <span className="text-sm font-bold text-ink-primary truncate">{grupo.nome}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-ink-muted">
                    {linhasDoGrupo.length} linha(s) · {qtdObras} obra(s)
                  </span>
                </button>

                {aberto && (
                  <div className="border-t border-black/5 p-4 pt-3 space-y-3">
                    {linhasDoGrupo.length === 0 ? (
                      <p className="text-[11px] text-ink-muted italic pl-6">
                        Nenhuma linha de gestão neste grupo.
                      </p>
                    ) : (
                      linhasDoGrupo.map(({ linha, macros }) => (
                        <div key={linha.id} className="pl-4 border-l-2 border-black/5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Network className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span className="font-mono text-[11px] font-bold text-purple-600">
                              {linha.codigo}
                            </span>
                            <span className="text-xs font-semibold text-ink-primary truncate">
                              {linha.nome}
                            </span>
                          </div>

                          {macros.length === 0 ? (
                            <p className="pl-5 text-[11px] text-ink-muted italic">
                              Nenhum Grupo Macro vinculado a esta linha.
                            </p>
                          ) : (
                            <div className="pl-5 space-y-2">
                              {macros.map((m) => (
                                <MacroBloco key={m.centroCusto.id} macro={m} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* Fora do alcance da Apropriação */}
      {semAlcance.length > 0 && (
        <section className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h2 className="text-sm font-bold text-amber-900">
                {semAlcance.length} Grupo(s) Macro fora do alcance da Apropriação
              </h2>
              <p className="text-[11px] text-amber-900/80 leading-relaxed max-w-2xl mb-2">
                Não são globais e não estão vinculados a nenhuma Linha de Gestão, então as obras
                deles não aparecem para apropriar em título nenhum. Corrija em{' '}
                <Link href="/centro-custos" className="font-semibold underline">
                  Cadastros → Centro de Custos
                </Link>
                .
              </p>
              <div className="flex flex-wrap gap-1.5">
                {semAlcance.map((cc) => (
                  <span
                    key={cc.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/60 px-2 py-1 text-[11px] font-semibold text-amber-900"
                  >
                    <span className="font-mono">{cc.codigo}</span> {cc.nome}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** Um Grupo Macro e as obras dele — igual dentro da árvore e no bloco de globais. */
function MacroBloco({ macro }: { macro: MacroNo }) {
  const { centroCusto: cc, obras } = macro;

  return (
    <div className="rounded-xl border border-black/[0.06] bg-surface-muted/50 p-3">
      <div className="flex items-center gap-2">
        <Building2 className="w-3.5 h-3.5 text-ink-muted shrink-0" />
        <span className="font-mono text-[11px] font-bold text-ink-primary">{cc.codigo}</span>
        <span className="text-xs font-semibold text-ink-primary truncate">{cc.nome}</span>
        {cc.escopoGlobal && (
          <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 border border-emerald-200">
            Global
          </span>
        )}
        {!cc.ativo && (
          <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted">
            Inativo
          </span>
        )}
        <span className="ml-auto shrink-0 text-[10px] text-ink-muted">{obras.length} obra(s)</span>
      </div>

      {obras.length > 0 && (
        <ul className="mt-2 pl-5 space-y-1">
          {obras.map((o) => (
            <li key={o.id} className="flex items-center gap-2 text-[11px]">
              <FileText className="w-3 h-3 text-brand shrink-0" />
              <span className="font-semibold text-ink-primary truncate">{o.nome}</span>
              {o.status !== 'aprovado' && (
                <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 border border-amber-200">
                  {o.status}
                </span>
              )}
              <span className="ml-auto shrink-0 font-mono text-ink-muted tabular-nums">
                {formatCurrency(o.valorCentavos)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

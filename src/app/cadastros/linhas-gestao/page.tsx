'use client';

import React, { useEffect, useState } from 'react';
import { erpRepository, CentroCusto, GrupoGestao, LinhaGestao } from '@/data';
import {
  ListFilter,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  X,
  AlertTriangle,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastProvider';
import { proximoCodigo } from '@/lib/codigos';

export default function LinhasGestaoPage() {
  const toast = useToast();
  const [linhas, setLinhas] = useState<LinhaGestao[]>([]);
  const [grupos, setGrupos] = useState<GrupoGestao[]>([]);
  /** Obras: os nós de topo da árvore de centro de custo. */
  const [obras, setObras] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [grupoFiltroId, setGrupoFiltroId] = useState<string>('');

  // Modal / Form state
  const [modalAberto, setModalAberto] = useState(false);
  const [linhaEditando, setLinhaEditando] = useState<LinhaGestao | null>(null);
  const [grupoGestaoId, setGrupoGestaoId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Exclusion confirm state
  const [linhaExcluindo, setLinhaExcluindo] = useState<LinhaGestao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    const [gList, lList, ccList] = await Promise.all([
      erpRepository.getGruposGestao({ apenasAtivos: false }),
      erpRepository.getLinhasGestao(undefined, { apenasAtivos: false }),
      erpRepository.getCentrosCusto({ apenasAtivos: true }),
    ]);
    setGrupos(gList);
    setLinhas(lList);
    // Só as raízes: unidade construtiva é filha da obra, não é obra.
    setObras(ccList.filter((c) => !c.parentId));
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const abrirModalNovo = () => {
    setLinhaEditando(null);
    const gruposAtivos = grupos.filter((g) => g.ativo);
    setGrupoGestaoId(gruposAtivos[0]?.id || grupos[0]?.id || '');
    setCodigo(proximoCodigo(linhas));
    setNome('');
    setDescricao('');
    setAtivo(true);
    setModalAberto(true);
  };

  const abrirModalEditar = (l: LinhaGestao) => {
    setLinhaEditando(l);
    setGrupoGestaoId(l.grupoGestaoId);
    setCodigo(l.codigo);
    setNome(l.nome);
    setDescricao(l.descricao || '');
    setAtivo(l.ativo);
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('Informe o nome da Linha de Gestão');
      return;
    }
    if (!grupoGestaoId) {
      toast.error('Selecione o Grupo de Gestão pai');
      return;
    }

    setSalvando(true);
    try {
      if (linhaEditando) {
        await erpRepository.updateLinhaGestao(linhaEditando.id, {
          grupoGestaoId,
          codigo,
          nome,
          descricao,
          ativo,
        });
        toast.success('Linha de Gestão atualizada com sucesso', {
          description: `Código: ${codigo} — ${nome}`,
        });
      } else {
        await erpRepository.createLinhaGestao({
          grupoGestaoId,
          codigo,
          nome,
          descricao,
          ativo,
        });
        toast.success('Linha de Gestão cadastrada com sucesso', {
          description: `Código: ${codigo} — ${nome}`,
        });
      }
      setModalAberto(false);
      await carregarDados();
    } catch (err) {
      toast.error('Erro ao salvar Linha de Gestão', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!linhaExcluindo) return;
    setExcluindo(true);
    try {
      await erpRepository.deleteLinhaGestao(linhaExcluindo.id);
      toast.success('Linha de Gestão excluída com sucesso', {
        description: `${linhaExcluindo.codigo} — ${linhaExcluindo.nome}`,
      });
      setLinhaExcluindo(null);
      await carregarDados();
    } catch (err) {
      toast.error('Erro ao excluir Linha de Gestão', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setExcluindo(false);
    }
  };

  /** Centros de custo que apontam para a linha aberta no modal — só leitura. */
  const centrosDaLinha = linhaEditando
    ? obras.filter((c) => c.linhaGestaoId === linhaEditando.id)
    : [];

  const linhasFiltradas = linhas.filter((l) => {
    const gPai = grupos.find((g) => g.id === l.grupoGestaoId);
    const nomeGrupoPai = gPai ? `${gPai.codigo} - ${gPai.nome}` : (l.grupoGestaoNome || '');

    const bateSearch =
      l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nomeGrupoPai.toLowerCase().includes(searchTerm.toLowerCase());
    const bateGrupo = grupoFiltroId ? l.grupoGestaoId === grupoFiltroId : true;
    return bateSearch && bateGrupo;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/cadastros"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ListFilter className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Linhas de Gestão</h1>
            <p className="text-xs text-slate-500">
              Linhas gerenciais vinculadas a um Grupo de Gestão
            </p>
          </div>
        </div>

        <button
          onClick={abrirModalNovo}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Linha de Gestão
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Buscar por código, nome da linha ou grupo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs text-slate-700 bg-transparent focus:outline-hidden"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/80 text-xs shadow-2xs">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={grupoFiltroId}
            onChange={(e) => setGrupoFiltroId(e.target.value)}
            className="w-full bg-transparent text-slate-700 font-semibold focus:outline-hidden"
          >
            <option value="">Todos os Grupos de Gestão</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.codigo} - {g.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Linhas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Grupo de Gestão</th>
                <th className="py-3 px-4">Obra Vinculada</th>
                <th className="py-3 px-4">Nome da Linha</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Carregando linhas de gestão...
                  </td>
                </tr>
              ) : linhasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhuma linha de gestão encontrada.
                  </td>
                </tr>
              ) : (
                linhasFiltradas.map((l) => {
                  const gPai = grupos.find((g) => g.id === l.grupoGestaoId);
                  const nomeGrupoPai = gPai ? `${gPai.codigo} - ${gPai.nome}` : (l.grupoGestaoNome || '—');
                  const ccsDaLinha = obras.filter((c) => c.linhaGestaoId === l.id);
                  const nomeObra =
                    ccsDaLinha.length === 0
                      ? ''
                      : ccsDaLinha.length === 1
                        ? `${ccsDaLinha[0].codigo} - ${ccsDaLinha[0].nome}`
                        : `${ccsDaLinha.length} centros de custo`;

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{l.codigo}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200">
                          {nomeGrupoPai}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {nomeObra ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold text-[11px] border border-amber-200">
                            {nomeObra}
                          </span>
                        ) : (
                          <span
                            className="text-slate-400"
                            title="Sem obra vinculada: esta linha não oferece obras na aba Apropriação do título."
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{l.nome}</td>
                      <td className="py-3 px-4 text-slate-500">{l.descricao || '—'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            l.ativo
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {l.ativo ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Ativo
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inativo
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => abrirModalEditar(l)}
                            title="Editar"
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setLinhaExcluindo(l)}
                            title="Excluir"
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Criar/Editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">
                {linhaEditando ? 'Editar Linha de Gestão' : 'Nova Linha de Gestão'}
              </h3>
              <button
                onClick={() => setModalAberto(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvar} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Grupo de Gestão (Pai)</label>
                <select
                  required
                  value={grupoGestaoId}
                  onChange={(e) => setGrupoGestaoId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-600 font-semibold"
                >
                  <option value="">Selecione o Grupo de Gestão...</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.codigo} - {g.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/*
                O vínculo é editado no cadastro do CENTRO DE CUSTO, não aqui.
                Este campo era um <select> que gravava em
                `linha_gestao.centro_custo_id` — coluna 1:1, que só comportava
                UMA obra por linha e fazia o segundo vínculo roubar o primeiro.
                Continua visível, em leitura, porque saber quais obras a linha
                reúne importa; só não se edita de dois lugares.
              */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Centros de Custo desta linha</label>
                <div className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-[13px]">
                  {centrosDaLinha.length === 0 ? (
                    <span className="text-slate-500">Nenhum centro de custo vinculado ainda.</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {centrosDaLinha.map((c) => (
                        <li key={c.id} className="font-semibold text-slate-700">
                          {c.codigo} - {c.nome}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  As obras destes centros de custo são o que a aba <strong>Apropriação</strong>{' '}
                  oferece quando esta linha é alocada num título. O vínculo é feito em{' '}
                  <strong>Cadastros → Centro de Custos</strong>, escolhendo a linha no cadastro do
                  centro de custo.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Código</label>
                <input
                  type="text"
                  required
                  value={codigo}
                  readOnly

                  title="Código gerado automaticamente pelo sistema"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome da Linha</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Materiais & Insumos de Obra"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  placeholder="Descrição detalhada sobre a linha de gestão..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-ativo-linha"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="chk-ativo-linha" className="font-semibold text-slate-700">
                  Linha Ativa
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  {salvando ? 'Salvando...' : 'Salvar Linha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Exclusão */}
      {linhaExcluindo && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-slate-800 text-base">Excluir Linha de Gestão?</h3>
              <p className="text-xs text-slate-500 mt-2">
                Deseja confirmar a exclusão da linha{' '}
                <strong className="text-slate-800 font-mono font-bold">[{linhaExcluindo.codigo}] {linhaExcluindo.nome}</strong>?
              </p>
              {linhaExcluindo.grupoGestaoNome && (
                <div className="mt-2.5">
                  <span className="inline-block px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200">
                    Grupo Pai: {linhaExcluindo.grupoGestaoNome}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setLinhaExcluindo(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarExclusao}
                disabled={excluindo}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                {excluindo ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

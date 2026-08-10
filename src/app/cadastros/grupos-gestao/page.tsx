'use client';

import React, { useEffect, useState } from 'react';
import { erpRepository, GrupoGestao } from '@/data';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  X,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastProvider';

export default function GruposGestaoPage() {
  const toast = useToast();
  const [grupos, setGrupos] = useState<GrupoGestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / Form state
  const [modalAberto, setModalAberto] = useState(false);
  const [grupoEditando, setGrupoEditando] = useState<GrupoGestao | null>(null);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Exclusion confirm state
  const [grupoExcluindo, setGrupoExcluindo] = useState<GrupoGestao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregarGrupos = async () => {
    setLoading(true);
    const data = await erpRepository.getGruposGestao({ apenasAtivos: false });
    setGrupos(data);
    setLoading(false);
  };

  useEffect(() => {
    carregarGrupos();
  }, []);

  const abrirModalNovo = () => {
    setGrupoEditando(null);
    const proximoSeq = grupos.reduce((m, g) => Math.max(m, parseInt((g.codigo || '').replace(/\D/g, ''), 10) || 0), 0) + 1;
    setCodigo(String(proximoSeq).padStart(3, '0'));
    setNome('');
    setDescricao('');
    setAtivo(true);
    setModalAberto(true);
  };

  const abrirModalEditar = (g: GrupoGestao) => {
    setGrupoEditando(g);
    setCodigo(g.codigo);
    setNome(g.nome);
    setDescricao(g.descricao || '');
    setAtivo(g.ativo);
    setModalAberto(true);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSalvando(true);
    if (grupoEditando) {
      await erpRepository.updateGrupoGestao(grupoEditando.id, {
        codigo,
        nome,
        descricao,
        ativo,
      });
    } else {
      await erpRepository.createGrupoGestao({
        codigo,
        nome,
        descricao,
        ativo,
      });
    }
    setSalvando(false);
    setModalAberto(false);
    await carregarGrupos();
  };

  const handleConfirmarExclusao = async () => {
    if (!grupoExcluindo) return;
    setExcluindo(true);
    try {
      await erpRepository.deleteGrupoGestao(grupoExcluindo.id);
      toast.success('Grupo de gestão excluído', { description: grupoExcluindo.nome });
      setGrupoExcluindo(null);
      await carregarGrupos();
    } catch (err) {
      toast.error('Erro ao excluir grupo de gestão', {
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      // Sem o finally, uma falha deixava o botão travado em "Excluindo..." para sempre.
      setExcluindo(false);
    }
  };

  const gruposFiltrados = grupos.filter(
    (g) =>
      g.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Grupos de Gestão</h1>
            <p className="text-xs text-slate-500">
              Agrupadores gerenciais de alocação financeira e de despesas
            </p>
          </div>
        </div>

        <button
          onClick={abrirModalNovo}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Grupo de Gestão
        </button>
      </div>

      {/* Filtros e Busca */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Buscar por código ou nome do grupo..."
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

      {/* Tabela de Grupos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nome do Grupo</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Carregando grupos de gestão...
                  </td>
                </tr>
              ) : gruposFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Nenhum grupo de gestão encontrado.
                  </td>
                </tr>
              ) : (
                gruposFiltrados.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{g.codigo}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{g.nome}</td>
                    <td className="py-3 px-4 text-slate-500">{g.descricao || '—'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          g.ativo
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {g.ativo ? (
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
                          onClick={() => abrirModalEditar(g)}
                          title="Editar"
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setGrupoExcluindo(g)}
                          title="Excluir"
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
                {grupoEditando ? 'Editar Grupo de Gestão' : 'Novo Grupo de Gestão'}
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
                <label className="block font-bold text-slate-700 mb-1">Código</label>
                <input
                  type="text"
                  required
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-purple-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome do Grupo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Gestão Operacional & Obras"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  placeholder="Descrição detalhada sobre o grupo gerencial..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-purple-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-ativo-grupo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="chk-ativo-grupo" className="font-semibold text-slate-700">
                  Grupo Ativo
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors shadow-sm"
                >
                  {salvando ? 'Salvando...' : 'Salvar Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Exclusão */}
      {grupoExcluindo && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-slate-800 text-base">Excluir Grupo de Gestão?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Deseja inativar/excluir o grupo <strong>{grupoExcluindo.nome}</strong>?
              </p>
            </div>

            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setGrupoExcluindo(null)}
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

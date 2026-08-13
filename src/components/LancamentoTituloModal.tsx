'use client';

import React, { useEffect, useState } from 'react';
import { 
  erpRepository, 
  Pessoa, 
  PlanoConta, 
  CentroCusto, 
  Subempresa, 
  GrupoLinhaCusto, 
  LinhaCusto, 
  GrupoGestao,
  LinhaGestao,
  TipoTitulo 
} from '@/data';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';
import { X, Calendar, Plus, Trash2, CheckCircle2, AlertTriangle, Scale, RefreshCw, Building2, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

interface LancamentoTituloModalProps {
  tipo: TipoTitulo; // 'P' = Pagar, 'R' = Receber
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemParcelaState {
  numero: number;
  dataVencimento: string;
  valorReais: string;
}

interface ItemRateioState {
  centroCustoId: string;
  percentualStr: string;
  valorReais: string;
}

export function LancamentoTituloModal({ tipo, isOpen, onClose, onSuccess }: LancamentoTituloModalProps) {
  const { user } = useAuth();
  const usuarioLogado = user
    ? `${user.nome} (${user.cargo || 'Administrador'})`
    : 'Renan (Administrativo)';

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [centroCustos, setCentroCustos] = useState<CentroCusto[]>([]);
  
  // Listas da Hierarquia Corporativa de Custos
  const [allGrupos, setAllGrupos] = useState<GrupoLinhaCusto[]>([]);
  const [allLinhas, setAllLinhas] = useState<LinhaCusto[]>([]);
  const [allGruposGestao, setAllGruposGestao] = useState<GrupoGestao[]>([]);
  const [allLinhasGestao, setAllLinhasGestao] = useState<LinhaGestao[]>([]);

  const [loadingBase, setLoadingBase] = useState(true);

  // BLOCO 1: DOCUMENTO & HIERARQUIA
  const [pessoaId, setPessoaId] = useState('');
  const [grupoLinhaCustoId, setGrupoLinhaCustoId] = useState('');
  const [linhaCustoId, setLinhaCustoId] = useState('');
  const [grupoGestaoId, setGrupoGestaoId] = useState('');
  const [linhaGestaoId, setLinhaGestaoId] = useState('');
  const [planoContaId, setPlanoContaId] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [serie, setSerie] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [dataCompetencia, setDataCompetencia] = useState(new Date().toISOString().split('T')[0]);
  const [valorBrutoReais, setValorBrutoReais] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacao, setObservacao] = useState('');

  // BLOCO 2: PARCELAMENTO
  const [qtdParcelas, setQtdParcelas] = useState(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [intervaloDias, setIntervaloDias] = useState(30);
  const [parcelas, setParcelas] = useState<ItemParcelaState[]>([]);

  // BLOCO 3: RATEIO POR CENTRO DE CUSTO
  const [rateios, setRateios] = useState<ItemRateioState[]>([]);
  const [rateioDiferentePorParcela, setRateioDiferentePorParcela] = useState(false);

  // ERROS DE VALIDAÇÃO
  const [parcelaSumError, setParcelaSumError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBaseData();
    }
  }, [isOpen, tipo]);

  async function loadBaseData() {
    setLoadingBase(true);
    const [pesList, pcList, ccList, grpList, linList, ggList, lgList] = await Promise.all([
      erpRepository.getPessoas({ apenasAtivos: true, apenasFornecedores: tipo === 'P', apenasClientes: tipo === 'R' }),
      erpRepository.getPlanoContasFolhas(),
      erpRepository.getCentroCustosFolhas(),
      erpRepository.getGruposLinhaCusto(undefined, { apenasAtivos: true }),
      erpRepository.getLinhasCusto(undefined, { apenasAtivos: true }),
      erpRepository.getGruposGestao({ apenasAtivos: true }),
      erpRepository.getLinhasGestao(undefined, { apenasAtivos: true })
    ]);

    setPessoas(pesList);
    setPlanoContas(pcList);
    setCentroCustos(ccList);
    setAllGrupos(grpList);
    setAllLinhas(linList);
    setAllGruposGestao(ggList);
    setAllLinhasGestao(lgList);

    if (ggList.length > 0) {
      setGrupoGestaoId(ggList[0].id);
      const linsGG = lgList.filter(l => l.grupoGestaoId === ggList[0].id);
      if (linsGG.length > 0) setLinhaGestaoId(linsGG[0].id);
    }

    if (grpList.length > 0) {
      setGrupoLinhaCustoId(grpList[0].id);
      const linsGrp = linList.filter(l => l.grupoLinhaCustoId === grpList[0].id);
      if (linsGrp.length > 0) {
        setLinhaCustoId(linsGrp[0].id);
      }
    }

    if (pesList.length > 0) {
      handlePessoaChange(pesList[0].id, pesList, pcList);
    }
    setLoadingBase(false);
  }


  const handleGrupoChange = (newGrpId: string) => {
    setGrupoLinhaCustoId(newGrpId);
    const lins = allLinhas.filter(l => l.grupoLinhaCustoId === newGrpId);
    if (lins.length > 0) {
      setLinhaCustoId(lins[0].id);
      if (lins[0].centroCustoId) {
        handleLinhaCustoAutoCC(lins[0].centroCustoId);
      }
    } else {
      setLinhaCustoId('');
    }
  };

  const handleLinhaChange = (newLinId: string) => {
    setLinhaCustoId(newLinId);
    const l = allLinhas.find(x => x.id === newLinId);
    if (l && l.centroCustoId) {
      handleLinhaCustoAutoCC(l.centroCustoId);
    }
  };

  const handleLinhaCustoAutoCC = (ccId: string) => {
    const totalBrutoCentavos = parseCentavos(valorBrutoReais);
    setRateios([
      {
        centroCustoId: ccId,
        percentualStr: '100.00',
        valorReais: valorBrutoReais || '0,00'
      }
    ]);
  };

  // Quando o fornecedor/cliente é selecionado -> Puxa Plano de Contas padrão e condição de pagamento
  const handlePessoaChange = (selectedId: string, currentPessoas = pessoas, currentPc = planoContas) => {
    setPessoaId(selectedId);
    const pes = currentPessoas.find(p => p.id === selectedId);
    if (pes) {
      if (pes.planoContaPadraoId && currentPc.some(pc => pc.id === pes.planoContaPadraoId)) {
        setPlanoContaId(pes.planoContaPadraoId);
      }
      if (pes.condicaoPagamentoPadrao && pes.condicaoPagamentoPadrao > 0) {
        setIntervaloDias(pes.condicaoPagamentoPadrao);
      }
    }
  };

  // Recálculo automático do Parcelamento ao mudar Valor Bruto, Qtd Parcelas, 1º Vencimento ou Intervalo
  useEffect(() => {
    gerarParcelasAutomaticas();
  }, [valorBrutoReais, qtdParcelas, primeiroVencimento, intervaloDias]);

  const parseCentavos = (valStr: string): number => {
    const clean = valStr.replace(/\./g, '').replace(',', '.');
    return Math.round((parseFloat(clean) || 0) * 100);
  };

  const formatReaisInput = (centavos: number): string => {
    return (centavos / 100).toFixed(2).replace('.', ',');
  };

  const gerarParcelasAutomaticas = () => {
    const totalCentavos = parseCentavos(valorBrutoReais);
    if (totalCentavos <= 0 || qtdParcelas <= 0) {
      setParcelas([]);
      setParcelaSumError(null);
      return;
    }

    const valorBaseCentavos = Math.floor(totalCentavos / qtdParcelas);
    const restoCentavos = totalCentavos - (valorBaseCentavos * qtdParcelas);

    const novasParcelas: ItemParcelaState[] = [];
    const baseDate = new Date(primeiroVencimento || new Date());

    for (let i = 1; i <= qtdParcelas; i++) {
      const vencDate = new Date(baseDate);
      vencDate.setDate(vencDate.getDate() + (i - 1) * intervaloDias);
      const vencStr = vencDate.toISOString().split('T')[0];

      // A diferença de arredondamento (centavos) vai toda na ÚLTIMA parcela (Regra da Etapa 2)
      const valorParcelaCentavos = i === qtdParcelas ? valorBaseCentavos + restoCentavos : valorBaseCentavos;

      novasParcelas.push({
        numero: i,
        dataVencimento: vencStr,
        valorReais: formatReaisInput(valorParcelaCentavos)
      });
    }

    setParcelas(novasParcelas);
    setParcelaSumError(null);
  };

  // Atualização manual de uma parcela individual
  const handleParcelaChange = (index: number, field: 'dataVencimento' | 'valorReais', value: string) => {
    const copy = [...parcelas];
    copy[index] = { ...copy[index], [field]: value };
    setParcelas(copy);

    // Validação imediata da soma
    const totalBrutoCentavos = parseCentavos(valorBrutoReais);
    const somaParcelasCentavos = copy.reduce((sum, p) => sum + parseCentavos(p.valorReais), 0);

    if (somaParcelasCentavos !== totalBrutoCentavos) {
      setParcelaSumError(
        `A soma das parcelas (${formatCurrency(somaParcelasCentavos)}) difere do Valor Bruto (${formatCurrency(totalBrutoCentavos)}).`
      );
    } else {
      setParcelaSumError(null);
    }
  };

  // BLOCO 3 — Lógica do Rateio por Centro de Custos (Soma = 100.00%)
  const handleAddRateio = () => {
    if (centroCustos.length === 0) return;
    const defaultCcId = centroCustos[0].id;
    setRateios(prev => [
      ...prev,
      { centroCustoId: defaultCcId, percentualStr: '0.00', valorReais: '0,00' }
    ]);
  };

  const handleRemoveRateio = (index: number) => {
    setRateios(prev => prev.filter((_, i) => i !== index));
  };

  const handleDividirIgualmente = () => {
    if (rateios.length === 0) return;
    const percBase = Number((100 / rateios.length).toFixed(2));
    const totalBrutoCentavos = parseCentavos(valorBrutoReais);

    const novosRateios = rateios.map((r, i) => {
      // Ajuste na última linha para fechar 100% exato
      const perc = i === rateios.length - 1 ? Number((100 - percBase * (rateios.length - 1)).toFixed(2)) : percBase;
      const valorCentavos = Math.round((totalBrutoCentavos * perc) / 100);
      return {
        ...r,
        percentualStr: perc.toFixed(2),
        valorReais: formatReaisInput(valorCentavos)
      };
    });
    setRateios(novosRateios);
  };

  const handleRateioPercentualChange = (index: number, valStr: string) => {
    const percNum = parseFloat(valStr.replace(',', '.')) || 0;
    const totalBrutoCentavos = parseCentavos(valorBrutoReais);
    const valCentavos = Math.round((totalBrutoCentavos * percNum) / 100);

    const copy = [...rateios];
    copy[index] = {
      ...copy[index],
      percentualStr: valStr,
      valorReais: formatReaisInput(valCentavos)
    };
    setRateios(copy);
  };

  const handleRateioValorChange = (index: number, valStr: string) => {
    const valCentavos = parseCentavos(valStr);
    const totalBrutoCentavos = parseCentavos(valorBrutoReais);
    const percNum = totalBrutoCentavos > 0 ? (valCentavos / totalBrutoCentavos) * 100 : 0;

    const copy = [...rateios];
    copy[index] = {
      ...copy[index],
      percentualStr: percNum.toFixed(2),
      valorReais: valStr
    };
    setRateios(copy);
  };

  // Cálculo da Soma dos Percentuais de Rateio
  const somaPercentualRateio = rateios.reduce((sum, r) => sum + (parseFloat(r.percentualStr.replace(',', '.')) || 0), 0);
  const isRateioValido = Math.abs(somaPercentualRateio - 100) <= 0.01;

  // DISPONIBILIDADE ORÇAMENTÁRIA (ETAPA 7)
  const [disponibilidades, setDisponibilidades] = useState<Record<number, any>>({});
  const [confirmarEstouroCheck, setConfirmarEstouroCheck] = useState(false);

  useEffect(() => {
    if (tipo === 'P' && planoContaId && rateios.length > 0) {
      verificarDisponibilidades();
    } else {
      setDisponibilidades({});
      setConfirmarEstouroCheck(false);
    }
  }, [planoContaId, rateios, valorBrutoReais, tipo]);

  async function verificarDisponibilidades() {
    const res: Record<number, any> = {};
    for (let i = 0; i < rateios.length; i++) {
      const r = rateios[i];
      if (r.centroCustoId) {
        const valCentavos = parseCentavos(r.valorReais);
        const info = await erpRepository.validarDisponibilidadeOrcamentaria(r.centroCustoId, planoContaId, valCentavos);
        res[i] = info;
      }
    }
    setDisponibilidades(res);
  }

  const temAlgumEstouro = Object.values(disponibilidades).some(d => d?.isEstouro);

  // SUBMIT FINAL
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalBrutoCentavos = parseCentavos(valorBrutoReais);
    if (totalBrutoCentavos <= 0) {
      alert('Informe um valor bruto maior que zero.');
      return;
    }

    // Validação da soma de parcelas (apenas se parcelas forem customizadas pelo usuário)
    const somaParcelasCentavos = parcelas.reduce((sum, p) => sum + parseCentavos(p.valorReais), 0);
    if (parcelas.length > 0 && somaParcelasCentavos !== totalBrutoCentavos) {
      setParcelaSumError('A soma das parcelas deve ser exatamente igual ao Valor Bruto do título.');
      return;
    }

    // Validação de Rateio em 100% (apenas se rateio foi customizado pelo usuário)
    if (rateios.length > 0 && !isRateioValido) {
      alert('O rateio por centro de custo deve somar exatamente 100,00%.');
      return;
    }

    if (temAlgumEstouro && !confirmarEstouroCheck) {
      alert('Este lançamento estoura o orçamento aprovado. Marque o checkbox de confirmação de estouro antes de salvar.');
      return;
    }

    const descBase = (descricao.trim() || observacao.trim());
    let observacaoFinal = descBase;
    if (temAlgumEstouro) {
      const nowStr = new Date().toLocaleString('pt-BR');
      observacaoFinal += `\n[ESTOURO DE ORÇAMENTO CONFIRMADO POR ${usuarioLogado} EM ${nowStr}]`;
    }

    // Montagem do Rateio Final (se vazio, usa o primeiro centro de custo ativo ou fallback CC-999)
    const rateiosFinal = rateios.length > 0
      ? rateios.map(r => ({
          centroCustoId: r.centroCustoId,
          percentual: parseFloat(r.percentualStr.replace(',', '.')) || 0,
          valorCentavos: parseCentavos(r.valorReais)
        }))
      : [{
          centroCustoId: centroCustos.length > 0 ? centroCustos[0].id : 'cc-999',
          percentual: 100,
          valorCentavos: totalBrutoCentavos
        }];

    const parcelasEfetivas = parcelas.length > 0
      ? parcelas
      : [{
          numero: 1,
          dataVencimento: primeiroVencimento || new Date().toISOString().split('T')[0],
          valorReais: valorBrutoReais
        }];

    await erpRepository.createTitulo({
      tipo,
      pessoaId,
      pessoaNome: pessoas.find(p => p.id === pessoaId)?.nome,
      grupoLinhaCustoId: grupoLinhaCustoId || undefined,
      linhaCustoId: linhaCustoId || undefined,
      grupoGestaoId: grupoGestaoId || undefined,
      linhaGestaoId: linhaGestaoId || undefined,
      planoContaId,
      numeroDocumento,
      serie,
      dataEmissao,
      dataCompetencia,
      valorBrutoCentavos: totalBrutoCentavos,
      qtdParcelas: parcelasEfetivas.length,
      descricao: descBase,
      observacao: observacaoFinal,
      usuario: usuarioLogado,
      parcelas: parcelasEfetivas.map(p => ({
        numero: p.numero,
        dataVencimento: p.dataVencimento,
        valorCentavos: parseCentavos(p.valorReais),
        observacao: `Parcela ${p.numero}/${parcelasEfetivas.length}`,
        rateios: rateiosFinal.map(r => ({
          ...r,
          valorCentavos: Math.round((parseCentavos(p.valorReais) * r.percentual) / 100)
        }))
      }))
    });

    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface rounded-2xl p-6 w-full max-w-4xl shadow-2xl border border-black/10 max-h-[92vh] overflow-y-auto space-y-6"
      >

        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-black/5 pb-4">
          <div>
            <h3 className="text-lg font-bold text-ink-primary">
              {tipo === 'P' ? 'Lançamento de Conta a Pagar' : 'Lançamento de Conta a Receber'}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Preencha os dados do documento, amarração com subempresa/linha de custo e parcelamento.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loadingBase ? (
          <div className="p-12 text-center text-ink-muted">Carregando formulário...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ========================================================================= */}
            {/* BLOCO 1 — DOCUMENTO & HIERARQUIA CORPORATIVA                               */}
            {/* ========================================================================= */}
            <div className="bg-surface-muted rounded-2xl p-4 border border-black/5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Bloco 1 — Dados do Documento & Amarração de Subempresa</span>
              </h4>

              {/* Linha da Hierarquia: Grupo -> Linha de Custo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface p-3 rounded-xl border border-black/5">

                <div>
                  <label className="block text-[11px] font-bold text-brand mb-1">1. Grupo de Linha de Custo *</label>
                  <select
                    value={grupoLinhaCustoId}
                    onChange={(e) => handleGrupoChange(e.target.value)}
                    required
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-2.5 py-1.5 text-xs text-ink-primary font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Selecione Grupo...</option>
                    {allGrupos
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.codigo} - {g.nome}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-brand mb-1">3. Linha de Custo *</label>
                  <select
                    value={linhaCustoId}
                    onChange={(e) => handleLinhaChange(e.target.value)}
                    required
                    disabled={!grupoLinhaCustoId}
                    className="w-full bg-surface-muted border border-black/10 rounded-xl px-2.5 py-1.5 text-xs text-ink-primary font-semibold focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-40"
                  >
                    <option value="">Selecione Linha...</option>
                    {allLinhas
                      .filter(l => l.grupoLinhaCustoId === grupoLinhaCustoId)
                      .map(l => (
                        <option key={l.id} value={l.id}>
                          {l.codigo} - {l.nome}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    {tipo === 'P' ? 'Fornecedor *' : 'Cliente *'}
                  </label>
                  <select
                    value={pessoaId}
                    onChange={(e) => handlePessoaChange(e.target.value)}
                    required
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    {pessoas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.cpfCnpj})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Plano de Contas (Apenas Lançáveis) *</label>
                  <select
                    value={planoContaId}
                    onChange={(e) => setPlanoContaId(e.target.value)}
                    required
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="">Selecione a conta contábil...</option>
                    {planoContas.map(pc => (
                      <option key={pc.id} value={pc.id}>
                        {pc.codigo} - {pc.nome} ({pc.natureza.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Nº Documento</label>
                  <input
                    type="text"
                    placeholder="NF-1234"
                    value={numeroDocumento}
                    onChange={(e) => setNumeroDocumento(e.target.value)}
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Série</label>
                  <input
                    type="text"
                    placeholder="1"
                    value={serie}
                    onChange={(e) => setSerie(e.target.value)}
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Data Emissão *</label>
                  <input
                    type="date"
                    value={dataEmissao}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDataEmissao(val);
                      setDataCompetencia(val);
                    }}
                    required
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Competência (DRE) *</label>
                  <input
                    type="date"
                    value={dataCompetencia}
                    onChange={(e) => setDataCompetencia(e.target.value)}
                    required
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Valor Bruto (R$) *</label>
                  <input
                    type="text"
                    placeholder="4500,00"
                    value={valorBrutoReais}
                    onChange={(e) => setValorBrutoReais(e.target.value)}
                    required
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2.5 text-sm text-ink-primary font-bold focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Descrição *</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: TROCA DA CORREIA DENTADA E TENSOR, TROCA DA BOMBA D'AGUA - GOL BOLA BRANCO"
                    value={descricao}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDescricao(val);
                      setObservacao(val);
                    }}
                    required
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 2 — PARCELAMENTO                                                    */}
            {/* ========================================================================= */}
            <div className="bg-surface-muted rounded-2xl p-4 border border-black/5 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand flex items-center justify-between">
                <span>Bloco 2 — Regra de Parcelamento</span>
                <span className="text-[11px] font-normal text-ink-muted normal-case">
                  Diferença de centavos alocada automaticamente na **última parcela**.
                </span>
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Qtd. Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={qtdParcelas}
                    onChange={(e) => setQtdParcelas(parseInt(e.target.value) || 1)}
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">1º Vencimento</label>
                  <input
                    type="date"
                    value={primeiroVencimento}
                    onChange={(e) => setPrimeiroVencimento(e.target.value)}
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Intervalo (Dias)</label>
                  <input
                    type="number"
                    min="1"
                    value={intervaloDias}
                    onChange={(e) => setIntervaloDias(parseInt(e.target.value) || 30)}
                    className="w-full bg-surface border border-black/10 rounded-xl px-3 py-2 text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
              </div>

              {/* Tabela de Parcelas Geradas (Editáveis) */}
              {parcelas.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase text-ink-muted px-2">Tabela de Vencimentos</div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {parcelas.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-surface p-2.5 rounded-xl border border-black/[0.04]">
                        <span className="w-16 text-xs font-mono font-bold text-ink-primary text-center">
                          {p.numero}/{qtdParcelas}
                        </span>
                        <input
                          type="date"
                          value={p.dataVencimento}
                          onChange={(e) => handleParcelaChange(idx, 'dataVencimento', e.target.value)}
                          className="flex-1 bg-surface-muted border border-black/10 rounded-lg px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-muted">R$</span>
                          <input
                            type="text"
                            value={p.valorReais}
                            onChange={(e) => handleParcelaChange(idx, 'valorReais', e.target.value)}
                            className="w-full bg-surface-muted border border-black/10 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-bold text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand text-right"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {parcelaSumError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{parcelaSumError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* BLOCO 3 — RATEIO POR CENTRO DE CUSTO (100% OBRIGATÓRIO)                     */}
            {/* ========================================================================= */}
            <div className="bg-surface-muted rounded-2xl p-4 border border-black/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand">
                    Bloco 3 — Rateio por Centro de Custo
                  </h4>
                  <p className="text-[11px] text-ink-muted">
                    O rateio deve somar **exatamente 100,00%**. Deixar vazio alocará em "Não alocado".
                  </p>
                </div>

                {/* Indicador de Status 100% */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDividirIgualmente}
                    disabled={rateios.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 bg-surface border border-black/10 rounded-lg text-xs font-semibold text-ink-primary hover:bg-black/5 disabled:opacity-40"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Dividir Igualmente</span>
                  </button>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                      rateios.length === 0 || isRateioValido
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {rateios.length === 0 || isRateioValido ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>Total: {somaPercentualRateio.toFixed(2)}%</span>
                  </span>
                </div>
              </div>

              {/* Grid de Linhas de Rateio */}
              <div className="space-y-3">
                {rateios.map((r, idx) => {
                  const disp = disponibilidades[idx];

                  return (
                    <div key={idx} className="space-y-1.5 bg-surface p-3 rounded-xl border border-black/[0.04]">
                      <div className="flex items-center gap-3">
                        {/* Seleção do Centro de Custos */}
                        <select
                          value={r.centroCustoId}
                          onChange={(e) => {
                            const copy = [...rateios];
                            copy[idx].centroCustoId = e.target.value;
                            setRateios(copy);
                          }}
                          className="flex-1 bg-surface-muted border border-black/10 rounded-lg px-2.5 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
                        >
                          {centroCustos
                            .map(cc => (
                              <option key={cc.id} value={cc.id}>
                                {cc.codigo} - {cc.nome} ({cc.tipo.toUpperCase()})
                              </option>
                            ))}
                        </select>

                        {/* Input % */}
                        <div className="w-24 relative">
                          <input
                            type="text"
                            placeholder="50,00"
                            value={r.percentualStr}
                            onChange={(e) => handleRateioPercentualChange(idx, e.target.value)}
                            className="w-full bg-surface-muted border border-black/10 rounded-lg pr-6 pl-2.5 py-1.5 text-xs font-bold text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand text-right"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-muted">%</span>
                        </div>

                        {/* Input Valor (R$) */}
                        <div className="w-32 relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-muted">R$</span>
                          <input
                            type="text"
                            value={r.valorReais}
                            onChange={(e) => handleRateioValorChange(idx, e.target.value)}
                            className="w-full bg-surface-muted border border-black/10 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-bold text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand text-right"
                          />
                        </div>

                        {/* Botão Remover Linha */}
                        <button
                          type="button"
                          onClick={() => handleRemoveRateio(idx)}
                          className="p-1.5 text-ink-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* INFORMÁTICO DO ORÇAMENTO VIGENTE */}
                      {disp?.hasOrcamentoVigente && (
                        <div className="text-[11px] font-medium bg-black/5 rounded-lg px-2.5 py-1 flex items-center justify-between text-ink-muted">
                          <span>
                            Orçamento [{disp.planoContaNivel2Codigo} {disp.planoContaNivel2Nome}]: Orçado {formatCurrency(disp.orcadoCentavos)} | Consumido {formatCurrency(disp.consumidoCentavos)} | Disponível: <strong className={disp.disponivelCentavos > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{formatCurrency(disp.disponivelCentavos)}</strong>
                          </span>
                        </div>
                      )}

                      {/* ALERTA DE ESTOURO NESTA LINHA */}
                      {disp?.isEstouro && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                          <span>Este lançamento estoura o orçamento do grupo em {formatCurrency(disp.estouroCentavos)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleAddRateio}
                  className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-dashed border-black/20 rounded-xl text-xs font-semibold text-ink-muted hover:text-brand hover:border-brand/40 transition-all w-full justify-center"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Centro de Custo</span>
                </button>
              </div>

              {/* AVISO DESTACADO E CHECKBOX DE CONFIRMAÇÃO DE ESTOURO */}
              {temAlgumEstouro && (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>⚠️ AVISO DE ESTOURO ORÇAMENTÁRIO DETECTADO</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    O valor lançado para este título ultrapassa o limite orçamentário aprovado. O salvamento não será bloqueado, mas exige a confirmação explícita abaixo (o usuário e a data/hora serão gravados na auditoria do título).
                  </p>
                  <label className="flex items-center gap-2 font-bold cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={confirmarEstouroCheck}
                      onChange={(e) => setConfirmarEstouroCheck(e.target.checked)}
                      className="rounded border-rose-400 text-rose-600 focus:ring-rose-500 w-4 h-4"
                    />
                    <span>Estou ciente e confirmo o lançamento com estouro orçamentário</span>
                  </label>
                </div>
              )}
            </div>


            {/* BOTÕES DE AÇÃO DO FORMULÁRIO */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-ink-muted hover:bg-black/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={Boolean(parcelaSumError) || (rateios.length > 0 && !isRateioValido)}
                className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-semibold shadow-md active:scale-[0.98] disabled:opacity-50"
              >
                Salvar Título & Parcelas
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

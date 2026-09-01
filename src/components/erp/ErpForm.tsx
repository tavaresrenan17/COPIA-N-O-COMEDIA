'use client';

/**
 * Primitivos do formulário de cadastro.
 *
 * Rótulo acima do campo, cantos arredondados de 10px e foco em brand — a mesma
 * linguagem das demais telas (ver `src/app/pessoas/page.tsx`). Mantêm os recursos
 * próprios do módulo: lookup com lupa e autocomplete por código, campo monetário
 * normalizado no blur e data com botão de calendário.
 *
 * Todas as telas de cadastro devem usar estes componentes.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Calendar, ChevronsUp, ChevronsDown, X, Lock } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Tokens compartilhados                                               */
/* ------------------------------------------------------------------ */

export const erpField =
  'h-[30px] rounded-field border border-erp-border bg-white px-2.5 text-[12px] leading-none text-erp-label ' +
  'focus:outline-none focus:border-erp-focus focus:ring-2 focus:ring-erp-focus/40 ' +
  'disabled:bg-erp-disabled disabled:text-erp-label/50 disabled:cursor-not-allowed transition-colors';

export const erpFieldError =
  '!border-red-500 !bg-red-50/50 focus:!border-red-600 focus:!ring-red-500 font-medium';

const iconBtn =
  'shrink-0 text-erp-icon hover:text-erp-accent disabled:text-erp-border disabled:cursor-not-allowed transition-colors';

/* ------------------------------------------------------------------ */
/* Trilha de abas do registro (módulo | aba | aba | ...)               */
/* ------------------------------------------------------------------ */

export interface ErpTabDef {
  key: string;
  label: string;
  /** Marca a aba com o ponto de pendência. */
  alerta?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

interface ErpTabsProps {
  /** Primeiro item da trilha: link de volta para a listagem do módulo. */
  raiz: { label: string; href: string };
  abas: ErpTabDef[];
  ativa: string;
  onChange: (key: string) => void;
  onDisabledClick?: (tab: ErpTabDef) => void;
}

export function ErpTabs({ raiz, abas, ativa, onChange, onDisabledClick }: ErpTabsProps) {
  return (
    <nav className="mt-2 flex flex-wrap items-center gap-y-1 text-[12px]">
      <Link href={raiz.href} className="text-erp-link hover:underline">
        {raiz.label}
      </Link>

      {abas.map((a) => (
        <React.Fragment key={a.key}>
          <span aria-hidden className="mx-3 w-px h-[13px] bg-erp-rule shrink-0" />
          <button
            type="button"
            onClick={() => {
              if (a.disabled) {
                if (onDisabledClick) onDisabledClick(a);
              } else {
                onChange(a.key);
              }
            }}
            title={a.disabled ? a.disabledReason || 'Preencha o cadastro inicial completo para liberar esta aba' : undefined}
            aria-current={ativa === a.key ? 'page' : undefined}
            className={
              a.disabled
                ? 'text-red-700/70 bg-red-50/60 px-1.5 py-0.5 border border-red-200 cursor-not-allowed flex items-center gap-1 font-medium transition-colors hover:border-red-400'
                : ativa === a.key
                ? 'font-semibold text-erp-label'
                : 'text-erp-link hover:underline hover:text-erp-accent transition-colors'
            }
          >
            {a.disabled && <Lock className="w-3 h-3 text-red-600 shrink-0 inline" />}
            {a.label}
            {a.alerta && (
              <span
                title="Pendências nesta aba"
                className="ml-1.5 inline-block w-[6px] h-[6px] rounded-full bg-erp-status align-middle"
              />
            )}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Linha: label acima + campo                                          */
/* ------------------------------------------------------------------ */

interface ErpRowProps {
  label: string;
  required?: boolean;
  hasError?: boolean;
  error?: string;
  children: React.ReactNode;
  /** Conteúdo à direita do campo, na mesma linha (ex.: total calculado). */
  trailing?: React.ReactNode;
  /**
   * Mantida por compatibilidade. Com o rótulo acima do campo não há mais
   * alinhamento vertical a corrigir, então não tem efeito.
   */
  alignTop?: boolean;
}

export function ErpRow({ label, required, hasError, error, children, trailing }: ErpRowProps) {
  return (
    <div className="mb-3">
      {/* Label vazia era usada apenas como recuo no layout de coluna fixa;
          com o rótulo acima ela é simplesmente omitida. */}
      {label && (
        <label
          className={`block mb-1.5 text-[12px] font-semibold ${
            hasError ? 'text-red-600' : 'text-erp-label/80'
          }`}
        >
          {label}
          {required && <span className="ml-0.5 text-erp-req">*</span>}
        </label>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">{children}</div>
        {trailing && <div className="flex items-center gap-1.5 shrink-0">{trailing}</div>}
      </div>

      {hasError && error && (
        <div className="mt-1 text-[11px] text-red-600 font-semibold flex items-center gap-1">
          <span>⚠️ {error}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input de texto                                                      */
/* ------------------------------------------------------------------ */

type ErpInputProps = React.InputHTMLAttributes<HTMLInputElement> & { widthClass?: string; hasError?: boolean };

export function ErpInput({ widthClass = 'w-full', className = '', hasError, ...rest }: ErpInputProps) {
  const num = rest.type === 'number' ? 'erp-num text-right' : '';
  const errClass = hasError ? erpFieldError : '';
  return <input {...rest} className={`${erpField} ${widthClass} ${num} ${errClass} ${className}`} />;
}

/* ------------------------------------------------------------------ */
/* Input monetário (alinhado à direita, normaliza no blur)             */
/* ------------------------------------------------------------------ */

interface ErpMoneyProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  widthClass?: string;
  required?: boolean;
  hasError?: boolean;
}

export function ErpMoney({ value, onChange, disabled, widthClass = 'w-[130px]', required, hasError }: ErpMoneyProps) {
  const errClass = hasError ? erpFieldError : '';
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      required={required}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(normalizeMoney(e.target.value))}
      className={`${erpField} ${widthClass} text-right ${errClass}`}
    />
  );
}

/** "1234,5" -> "1.234,50"; vazio permanece vazio. */
export function normalizeMoney(v: string): string {
  if (!v.trim()) return '';
  const centavos = parseCentavos(v);
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte "1.234,56" em 123456 centavos. */
export function parseCentavos(v: string): number {
  if (!v) return 0;
  // O sinal de menos era preservado, então "-100" virava -10000 centavos e passava
  // pela validação do formulário — só o CHECK do banco barrava, com erro cru.
  // Nenhum campo monetário de título ou baixa aceita valor negativo.
  const clean = v.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  return Math.max(0, Math.round((parseFloat(clean) || 0) * 100));
}

/** Converte 123456 centavos em "1.234,56". */
export function formatCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ------------------------------------------------------------------ */
/* Data (input nativo + botão de calendário)                           */
/* ------------------------------------------------------------------ */

interface ErpDateProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  widthClass?: string;
  hasError?: boolean;
}

export function ErpDate({ value, onChange, disabled, required, widthClass = 'w-[120px]', hasError }: ErpDateProps) {
  const ref = useRef<HTMLInputElement>(null);
  const errClass = hasError ? erpFieldError : '';

  const openPicker = () => {
    const el = ref.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    try {
      el.showPicker ? el.showPicker() : el.focus();
    } catch {
      el.focus();
    }
  };

  return (
    <>
      <input
        ref={ref}
        type="date"
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${erpField} ${widthClass} erp-date ${errClass}`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        aria-label="Abrir calendário"
        className={`${iconBtn} h-[24px] w-[24px] rounded-field border border-erp-border bg-white flex items-center justify-center disabled:bg-erp-disabled ${
          hasError ? '!border-red-500 !bg-red-50' : ''
        }`}
      >
        <Calendar className="w-3 h-3" />
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Lookup: código + (opcional) coluna extra + descrição + lupa         */
/* ------------------------------------------------------------------ */
/* Lookup: código + (opcional) coluna extra + descrição + autocomplete  */
/* ------------------------------------------------------------------ */

/**
 * Normaliza texto removendo acentos e convertendo para minúsculas.
 */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface LookupItem {
  id: string;
  codigo: string;
  nome: string;
  /** Terceira coluna opcional (CNPJ, natureza, tipo...). */
  extra?: string;
}

/**
 * Função de busca por começo de palavra e relevância inteligente.
 * Prioriza correspondências exatas de código, início de código, início de nome,
 * início de qualquer palavra no nome e CPF/CNPJ.
 */
export function filterLookupItems(items: LookupItem[], query: string): LookupItem[] {
  const q = normalizeText(query);
  if (!q) return items;

  const cleanQuery = q.replace(/[^a-z0-9]/g, '');

  const scored = items.map((item) => {
    const code = normalizeText(item.codigo);
    const name = normalizeText(item.nome);
    const extra = normalizeText(item.extra || '');
    const cleanExtra = extra.replace(/[^a-z0-9]/g, '');

    let score = 0;

    // 1. Código é idêntico à busca (ex: "PIX" === "pix") -> 200
    if (code === q) {
      score = 200;
    }
    // 2. Código começa exatamente com a busca (ex: "PI" em "PIX") -> 150
    else if (code.startsWith(q)) {
      score = 150;
    }
    // 3. Nome é idêntico à busca -> 130
    else if (name === q) {
      score = 130;
    }
    // 4. Nome da empresa/pessoa/documento começa com a busca (ex: "PAG" em "PAGAMENTO VIA PIX") -> 120
    else if (name.startsWith(q)) {
      score = 120;
    }
    // 5. Alguma palavra do nome começa com a busca (ex: "PIX" em "PAGAMENTO VIA PIX") -> 100
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) {
      score = 100;
    }
    // 6. CPF/CNPJ começa com a busca (sem caracteres especiais) -> 90
    else if (cleanQuery && cleanExtra.startsWith(cleanQuery)) {
      score = 90;
    }
    // 7. Código contém a busca -> 70
    else if (code.includes(q)) {
      score = 70;
    }
    // 8. Nome contém a busca -> 60
    else if (name.includes(q)) {
      score = 60;
    }
    // 9. Extra / CPF / CNPJ contém a busca
    else if (extra.includes(q) || (cleanQuery && cleanExtra.includes(cleanQuery))) {
      score = 40;
    }

    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);
}

interface ErpLookupProps {
  codigo: string;
  descricao: string;
  /** Caixa intermediária opcional (ex.: CPF/CNPJ do credor). */
  middle?: string;
  middleWidthClass?: string;
  codeWidthClass?: string;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  /** Opções de cadastro para habilitar autocomplete dinâmico. */
  options?: LookupItem[];
  /** Callback acionado ao selecionar uma opção no autocomplete ou modal. */
  onSelect?: (item: LookupItem) => void;
  /** Abre a janela de consulta modal. */
  onOpen: () => void;
  /** Código digitado direto no campo, confirmado no blur/Enter. */
  onCodeCommit?: (codigo: string) => void;
}

export function ErpLookup({
  codigo,
  descricao,
  middle,
  middleWidthClass = 'w-[120px]',
  codeWidthClass = 'w-[75px]',
  disabled,
  required,
  hasError,
  options,
  onSelect,
  onOpen,
  onCodeCommit,
}: ErpLookupProps) {
  const [draftCode, setDraftCode] = useState<string | null>(null);
  const [draftDesc, setDraftDesc] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  const activeCode = draftCode ?? codigo;
  const activeDesc = draftDesc ?? descricao;
  const errClass = hasError ? erpFieldError : '';

  // Termo atual para o autocomplete
  const isTypingCode = draftCode !== null;
  const currentQuery = draftDesc !== null ? draftDesc : (draftCode !== null ? draftCode : '');

  const filteredOptions = useMemo(() => {
    if (!options || options.length === 0) return [];
    if (!currentQuery.trim() && !isOpen) return options.slice(0, 15);
    return filterLookupItems(options, currentQuery);
  }, [options, currentQuery, isOpen]);

  // Sugestão mais próxima
  const closestMatch = filteredOptions[0] || null;

  // Cálculo do sufixo Ghost Text para pré-visualização inline
  const ghostCodeSuffix = useMemo(() => {
    if (!isTypingCode || !draftCode || !draftCode.trim() || !closestMatch) return '';
    const normDraft = normalizeText(draftCode);
    const normCode = normalizeText(closestMatch.codigo);
    if (normCode.startsWith(normDraft) && normCode.length > normDraft.length) {
      return closestMatch.codigo.slice(draftCode.length);
    }
    return '';
  }, [isTypingCode, draftCode, closestMatch]);

  const ghostDescSuffix = useMemo(() => {
    if (isTypingCode || draftDesc === null || !draftDesc.trim() || !closestMatch) return '';
    const normDraft = normalizeText(draftDesc);
    const normNome = normalizeText(closestMatch.nome);
    if (normNome.startsWith(normDraft) && normNome.length > normDraft.length) {
      return closestMatch.nome.slice(draftDesc.length);
    }
    return '';
  }, [isTypingCode, draftDesc, closestMatch]);

  // Fechar dropdown ao clicar fora do componente
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        commitDirect();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [draftCode, draftDesc, options]);

  const handleSelectItem = (item: LookupItem) => {
    if (onSelect) {
      onSelect(item);
    } else if (onCodeCommit) {
      onCodeCommit(item.codigo);
    }
    setDraftCode(null);
    setDraftDesc(null);
    setIsOpen(false);
  };

  const commitDirect = () => {
    if (draftCode !== null && draftCode.trim()) {
      if (options && (onSelect || onCodeCommit)) {
        const norm = normalizeText(draftCode.trim());
        const match =
          options.find((i) => normalizeText(i.codigo) === norm) ||
          options.find((i) => normalizeText(i.codigo).startsWith(norm));
        if (match) {
          handleSelectItem(match);
          return;
        }
      }
      if (onCodeCommit) onCodeCommit(draftCode.trim());
    } else if (draftDesc !== null && draftDesc.trim()) {
      if (options && (onSelect || onCodeCommit)) {
        const norm = normalizeText(draftDesc.trim());
        const match =
          options.find((i) => normalizeText(i.nome) === norm) ||
          options.find((i) => normalizeText(i.nome).startsWith(norm));
        if (match) {
          handleSelectItem(match);
          return;
        }
      }
    }
    setDraftCode(null);
    setDraftDesc(null);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 1. TAB: Autocompleta imediatamente com a sugestão mais próxima e permite avançar foco
    if (e.key === 'Tab') {
      if (isOpen && filteredOptions.length > 0) {
        const itemToSelect = filteredOptions[highlightedIndex] || filteredOptions[0];
        if (itemToSelect) {
          handleSelectItem(itemToSelect);
          // Permite que o evento Tab natural leve o foco para o próximo campo com o valor preenchido
        }
      } else if (draftCode !== null || draftDesc !== null) {
        commitDirect();
      }
      return;
    }

    // 2. ENTER: Autocompleta e impede submissão indesejada
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredOptions.length > 0) {
        const itemToSelect = filteredOptions[highlightedIndex] || filteredOptions[0];
        if (itemToSelect) {
          handleSelectItem(itemToSelect);
        }
      } else {
        commitDirect();
      }
      return;
    }

    // 3. SETA DIREITA (ArrowRight): Se estiver no fim do texto e houver sugestão, autocompleta
    if (e.key === 'ArrowRight') {
      const input = e.currentTarget;
      if (input.selectionEnd === input.value.length && isOpen && filteredOptions.length > 0) {
        const itemToSelect = filteredOptions[highlightedIndex] || filteredOptions[0];
        if (itemToSelect) {
          handleSelectItem(itemToSelect);
        }
      }
      return;
    }

    // 4. SETA BAIXO / CIMA / ESCAPE
    if (!isOpen || filteredOptions.length === 0) {
      if (e.key === 'ArrowDown' && options && options.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5 flex-1 min-w-0">
      {/* Campo do Código com suporte a Ghost Text */}
      <div className={`relative ${codeWidthClass} shrink-0 flex items-center`}>
        {isOpen && ghostCodeSuffix && (
          <div
            aria-hidden="true"
            className="absolute inset-0 px-2.5 flex items-center text-[12px] pointer-events-none select-none overflow-hidden whitespace-nowrap"
          >
            <span className="opacity-0">{activeCode}</span>
            <span className="text-brand/50 font-mono italic font-semibold">{ghostCodeSuffix}</span>
          </div>
        )}
        <input
          type="text"
          value={activeCode}
          required={required}
          disabled={disabled}
          readOnly={!onCodeCommit && !onSelect}
          onChange={(e) => {
            setDraftCode(e.target.value);
            setDraftDesc(null);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            if (options && options.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            if (!isOpen && draftCode !== null) commitDirect();
          }}
          onKeyDown={handleKeyDown}
          onDoubleClick={() => !disabled && onOpen()}
          className={`${erpField} w-full ${errClass}`}
        />
      </div>

      {/* Campo Intermediário (ex: CPF/CNPJ) */}
      {middle !== undefined && (
        <input
          type="text"
          value={middle}
          readOnly
          disabled={disabled}
          className={`${erpField} ${middleWidthClass} shrink-0 ${errClass}`}
        />
      )}

      {/* Campo da Descrição (Busca por começo de palavra com Autocomplete e Ghost Text) */}
      <div className="relative flex-1 min-w-0 flex items-center">
        {isOpen && ghostDescSuffix && (
          <div
            aria-hidden="true"
            className="absolute inset-0 px-2.5 flex items-center text-[12px] pointer-events-none select-none overflow-hidden whitespace-nowrap text-left"
          >
            <span className="opacity-0">{activeDesc}</span>
            <span className="text-brand/50 italic font-medium">{ghostDescSuffix}</span>
          </div>
        )}
        <input
          type="text"
          value={activeDesc}
          placeholder={options ? 'Digite o começo do nome ou código...' : ''}
          disabled={disabled}
          readOnly={!onSelect && !onCodeCommit}
          onChange={(e) => {
            setDraftDesc(e.target.value);
            setDraftCode(null);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            if (options && options.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            if (!isOpen && draftDesc !== null) commitDirect();
          }}
          onKeyDown={handleKeyDown}
          onDoubleClick={() => !disabled && onOpen()}
          className={`${erpField} w-full ${errClass}`}
        />
      </div>

      {/* Lupa para Consulta em Modal */}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={onOpen}
        aria-label="Consultar"
        className={`${iconBtn} h-[24px] w-[24px] rounded-field flex items-center justify-center shrink-0 ${
          hasError ? '!text-red-600' : ''
        }`}
      >
        <Search className="w-[15px] h-[15px]" strokeWidth={2.5} />
      </button>

      {/* Dropdown Autocomplete Flutuante com Sugestão Mais Próxima & Dica Tab */}
      {isOpen && options && options.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-erp-border shadow-elevated max-h-64 overflow-y-auto rounded-xl text-[12px] animate-in fade-in duration-100 divide-y divide-erp-rule/40">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-erp-label/60 italic text-center">
              Nenhum cadastro encontrado para &ldquo;{currentQuery}&rdquo;
            </div>
          ) : (
            <>
              <div className="py-1">
                {filteredOptions.map((item, idx) => {
                  const isSelected = idx === highlightedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-2.5 py-1.5 cursor-pointer flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-brand/10 text-erp-title font-medium'
                          : 'hover:bg-erp-zebra text-erp-label'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20 shrink-0">
                          {item.codigo}
                        </span>
                        <span className="truncate">{item.nome}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {item.extra && (
                          <span className="text-[11px] font-mono text-erp-label/70">
                            {item.extra}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-brand bg-brand/15 border border-brand/30 px-1.5 py-0.2 rounded shadow-xs flex items-center gap-0.5 shrink-0">
                            TAB ⇥
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-3 py-1.5 bg-slate-50 text-[11px] text-erp-label/75 flex items-center justify-between select-none">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
                  Sugestão mais próxima
                </span>
                <span className="text-[10px] text-erp-label/80 font-medium">
                  Pressione <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 shadow-xs font-mono font-bold text-[9px]">TAB</kbd> ou <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 shadow-xs font-mono font-bold text-[9px]">ENTER</kbd>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Textarea                                                            */
/* ------------------------------------------------------------------ */

type ErpTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function ErpTextarea({ rows = 3, className = '', ...rest }: ErpTextareaProps) {
  return (
    <textarea
      rows={rows}
      {...rest}
      className={`w-full rounded-field border border-erp-border bg-white px-2.5 py-2 text-[12px] leading-[1.45] text-erp-label
        focus:outline-none focus:border-erp-focus focus:ring-1 focus:ring-erp-focus/60
        disabled:bg-erp-disabled disabled:text-erp-label/50 resize-y ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Checkbox                                                            */
/* ------------------------------------------------------------------ */

interface ErpCheckProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function ErpCheck({ checked, onChange, label, disabled }: ErpCheckProps) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[12px] text-erp-label cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-erp-border text-erp-accent focus:ring-2 focus:ring-erp-focus/40"
      />
      <span>{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Seção colapsável com régua e barra de destaque                      */
/* ------------------------------------------------------------------ */

interface ErpSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Conteúdo à direita do título (contadores, totalizadores, ações). */
  aside?: React.ReactNode;
}

export function ErpSection({ title, children, defaultOpen = true, aside }: ErpSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-7">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] tracking-[0.02em] text-erp-section uppercase">{title}</h3>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? `Recolher ${title}` : `Expandir ${title}`}
          className={`${iconBtn} h-[24px] w-[24px] rounded-field border border-erp-border bg-white flex items-center justify-center`}
        >
          {open ? <ChevronsUp className="w-3 h-3" /> : <ChevronsDown className="w-3 h-3" />}
        </button>

        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </div>

      {/* Régua fina cinza com o trecho navy à esquerda, como no legado */}
      <div className="relative h-[3px] mt-[6px] mb-4">
        <div className="absolute inset-x-0 top-[1px] h-[1px] bg-erp-rule" />
        <div className="absolute left-0 top-0 h-[3px] w-[62px] bg-erp-accent" />
      </div>

      {open && <div>{children}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Janela de consulta (lupa)                                           */
/* ------------------------------------------------------------------ */

interface ErpLookupModalProps {
  open: boolean;
  title: string;
  items: LookupItem[];
  extraHeader?: string;
  onSelect: (item: LookupItem) => void;
  onClose: () => void;
}

export function ErpLookupModal({
  open,
  title,
  items,
  extraHeader,
  onSelect,
  onClose,
}: ErpLookupModalProps) {
  const [term, setTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filtered = useMemo(() => {
    return filterLookupItems(items, term);
  }, [items, term]);

  const handleSelectItem = (item: LookupItem) => {
    onSelect(item);
    setTerm('');
    setHighlightedIndex(0);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.key === 'Enter') {
      if (filtered.length > 0) {
        e.preventDefault();
        const itemToSelect = filtered[highlightedIndex] || filtered[0];
        if (itemToSelect) handleSelectItem(itemToSelect);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-[8vh] bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-erp-border shadow-elevated rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-erp-head border-b border-erp-rule px-4 py-2.5">
          <h4 className="text-[12px] font-semibold text-ink-muted uppercase tracking-wide">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar consulta"
            className="text-erp-label/60 hover:text-erp-label"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-erp-rule bg-slate-50/50">
          <input
            autoFocus
            type="text"
            placeholder="Pesquisar por código ou descrição (Pressione Tab ou Enter para selecionar)..."
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className={`${erpField} w-full h-[34px]`}
          />
        </div>

        <div className="max-h-[46vh] overflow-y-auto">
          <table className="w-full text-[12px] text-erp-label border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="bg-erp-head text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="text-left font-semibold px-3 py-1.5 border-b border-erp-rule w-[110px]">Código</th>
                <th className="text-left font-semibold px-3 py-1.5 border-b border-erp-rule">Descrição</th>
                {extraHeader && (
                  <th className="text-left font-semibold px-3 py-1.5 border-b border-erp-rule w-[170px]">
                    {extraHeader}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={extraHeader ? 3 : 2} className="px-3 py-6 text-center text-erp-label/60">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`cursor-pointer transition-colors ${
                        isHighlighted
                          ? 'bg-brand/15 text-erp-title font-medium'
                          : idx % 2
                          ? 'bg-erp-zebra hover:bg-brand/10'
                          : 'bg-white hover:bg-brand/10'
                      }`}
                    >
                      <td className="px-3 py-1.5 border-b border-erp-rule font-mono font-semibold text-brand">
                        {item.codigo}
                      </td>
                      <td className="px-3 py-1.5 border-b border-erp-rule">{item.nome}</td>
                      {extraHeader && (
                        <td className="px-3 py-1.5 border-b border-erp-rule text-erp-label/70">
                          {item.extra || '—'}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-3 py-2 bg-erp-head border-t border-erp-rule">
          <span className="text-[11px] text-ink-muted">
            {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
          </span>
          <ErpButton variant="secondary" onClick={onClose}>
            Cancelar
          </ErpButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Botões                                                              */
/* ------------------------------------------------------------------ */

/**
 * Botão da barra de rodapé das grades (RATEIO PADRÃO, ADICIONAR...).
 * Menor e em caixa alta, como no legado.
 */
export function ErpGridButton({ className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`h-[28px] px-3 border border-erp-border bg-erp-head text-erp-label text-[11px]
        uppercase tracking-wide rounded-field hover:bg-white active:translate-y-px transition-colors
        disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-erp-head ${className}`}
    />
  );
}

interface ErpButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function ErpButton({ variant = 'primary', className = '', ...rest }: ErpButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-erp-accent text-white border-erp-accent hover:bg-erp-section'
      : 'bg-white text-erp-label border-erp-border hover:bg-erp-head';

  return (
    <button
      type="button"
      {...rest}
      className={`h-[32px] px-4 border text-[12px] font-semibold rounded-field transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';
import { itensBuscaveis, ItemNavegacao } from '@/lib/navegacao';

/**
 * Busca de telas por Ctrl+K.
 *
 * Num ERP a navegação por menu é lenta para quem já sabe onde quer chegar:
 * digitar "pagar" e dar Enter poupa a árvore inteira. Varre as mesmas telas que
 * o menu mostra — o que está desligado não aparece aqui também.
 */

/**
 * "Orçamento" tem que ser achado digitando "orcamento".
 *
 * O intervalo `\u0300-\u036f` é escrito escapado de propósito: são marcas
 * combinantes invisíveis, e coladas literalmente no fonte qualquer conversão de
 * encoding as corrompe sem deixar rastro.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function PaletaComandos() {
  const router = useRouter();
  const pathname = usePathname();
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const [indice, setIndice] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  /** Quem tinha o foco antes de abrir — para devolver ao fechar. */
  const focoAnterior = useRef<HTMLElement | null>(null);

  const todos = useMemo(() => itensBuscaveis(), []);

  const resultados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return todos;
    return todos.filter(
      (i) => normalizar(i.label).includes(termo) || normalizar(i.secao).includes(termo)
    );
  }, [busca, todos]);

  // Ctrl+K / Cmd+K abre de qualquer tela.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAberta((a) => {
          // Limpa JUNTO com a abertura, não num efeito depois: o componente não
          // desmonta ao fechar (devolve null), então a busca anterior continua
          // em estado. Limpando só no efeito, o campo abria preenchido e o que
          // fosse digitado no meio-tempo se misturava com a busca velha.
          if (!a) {
            setBusca('');
            setIndice(0);
          }
          return !a;
        });
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  // Fecha ao navegar, inclusive quando a navegação parte de outro lugar.
  useEffect(() => {
    setAberta(false);
  }, [pathname]);

  useEffect(() => {
    if (!aberta) {
      // Fechar sem devolver o foco deixa o teclado preso no começo da página.
      focoAnterior.current?.focus?.();
      focoAnterior.current = null;
      return;
    }
    focoAnterior.current = document.activeElement as HTMLElement | null;
  }, [aberta]);

  // Digitar refaz a lista: a seleção precisa voltar para o topo, senão aponta
  // para um item que já saiu do filtro.
  useEffect(() => {
    setIndice(0);
  }, [busca]);

  // Mantém o item selecionado à vista quando se anda com as setas.
  useEffect(() => {
    if (!aberta) return;
    const alvo = listaRef.current?.querySelector<HTMLElement>(`[data-indice="${indice}"]`);
    alvo?.scrollIntoView({ block: 'nearest' });
  }, [indice, aberta]);

  if (!aberta) return null;

  const irPara = (item?: ItemNavegacao) => {
    if (!item) return;
    setAberta(false);
    router.push(item.href);
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setAberta(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => (resultados.length ? (i + 1) % resultados.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) => (resultados.length ? (i - 1 + resultados.length) % resultados.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      irPara(resultados[indice]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setAberta(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar tela"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={aoTeclar}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-black/10 bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-black/5 px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-muted" />
          {/*
            `autoFocus` foca no mount. Antes era um `setTimeout(0)`, e quem
            digitava logo depois do Ctrl+K perdia os primeiros caracteres — a
            lista abria sem filtro e o Enter levava para a tela errada.
          */}
          <input
            ref={inputRef}
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ir para..."
            className="w-full bg-transparent py-3.5 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-black/10 bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            Esc
          </kbd>
        </div>

        <div ref={listaRef} className="max-h-80 overflow-y-auto p-2">
          {resultados.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-ink-muted">
              Nenhuma tela encontrada para “{busca}”.
            </p>
          ) : (
            resultados.map((item, i) => (
              <button
                key={item.href}
                data-indice={i}
                onClick={() => irPara(item)}
                onMouseMove={() => setIndice(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  i === indice ? 'bg-brand/10' : 'hover:bg-black/[0.03]'
                }`}
              >
                <item.Icon
                  className={`h-4 w-4 shrink-0 ${i === indice ? 'text-brand' : 'text-ink-muted'}`}
                />
                <span className="flex-1 truncate text-[13px] font-semibold text-ink-primary">
                  {item.label}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-muted">
                  {item.secao}
                </span>
                {i === indice && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

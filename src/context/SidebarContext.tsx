'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;

  /** Seções do menu que o usuário fechou à mão. */
  secoesFechadas: string[];
  alternarSecao: (id: string) => void;

  /** Telas fixadas no topo do menu, por navegador. */
  favoritos: string[];
  alternarFavorito: (href: string) => void;
  ehFavorito: (href: string) => boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'melhor-gestao.sidebar.collapsed';
const CHAVE_SECOES = 'melhor-gestao.sidebar.secoes-fechadas';
const CHAVE_FAVORITOS = 'melhor-gestao.sidebar.favoritos';

/** Lê uma lista do localStorage sem derrubar a tela se o valor estiver corrompido. */
function lerLista(chave: string): string[] | null {
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return null;
    const valor = JSON.parse(bruto);
    return Array.isArray(valor) ? valor.filter((v) => typeof v === 'string') : null;
  } catch {
    return null;
  }
}

function gravarLista(chave: string, valor: string[]) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Ignora erro se localStorage estiver bloqueado
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  /*
   * Guarda o que está FECHADO, não o que está aberto: assim uma seção nova
   * (departamento que for ligado depois) nasce visível em vez de escondida por
   * um estado gravado antes de ela existir.
   */
  const [secoesFechadas, setSecoesFechadas] = useState<string[]>([]);
  const [favoritos, setFavoritos] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      }
    } catch {
      // Ignora erro se localStorage estiver bloqueado
    }

    const secoes = lerLista(CHAVE_SECOES);
    if (secoes) setSecoesFechadas(secoes);

    const favs = lerLista(CHAVE_FAVORITOS);
    if (favs) setFavoritos(favs);
  }, []);

  const alternarSecao = (id: string) => {
    setSecoesFechadas((prev) => {
      const proxima = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      gravarLista(CHAVE_SECOES, proxima);
      return proxima;
    });
  };

  const alternarFavorito = (href: string) => {
    setFavoritos((prev) => {
      const proxima = prev.includes(href) ? prev.filter((f) => f !== href) : [...prev, href];
      gravarLista(CHAVE_FAVORITOS, proxima);
      return proxima;
    });
  };

  const ehFavorito = (href: string) => favoritos.includes(href);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, String(next));
      } catch {
        // Ignora erro
      }
      return next;
    });
  };

  const setCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(collapsed));
    } catch {
      // Ignora erro
    }
  };

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        setCollapsed,
        secoesFechadas,
        alternarSecao,
        favoritos,
        alternarFavorito,
        ehFavorito,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar deve ser usado dentro de um SidebarProvider');
  }
  return context;
}

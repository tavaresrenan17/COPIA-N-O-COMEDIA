'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ArrowLeft, ChevronDown, Star, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';
import { paginaAnterior, secoesNavegacao, secaoDaRota, itensVisiveis } from '@/lib/navegacao';

interface MenuItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const ITEM_HOME: MenuItem = { href: '/', label: 'Home', Icon: Home };

/** Rótulo de seção — um único estilo para todos os grupos da sidebar. */
function RotuloSecao({ children, isCollapsed }: { children?: React.ReactNode; isCollapsed?: boolean }) {
  if (isCollapsed) {
    return <div className="my-2 border-t border-white/10" />;
  }
  return (
    <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
      {children}
    </p>
  );
}

/**
 * Cabeçalho de seção que abre e fecha.
 *
 * Só existe com a sidebar expandida: recolhida (w-20) não há largura para
 * título nem para contador, e a seção vira uma faixa de ícones separada por
 * divisor — que é o que o `RotuloSecao` já faz nesse modo.
 */
function SecaoRecolhivel({
  titulo,
  aberta,
  quantidade,
  onAlternar,
  children,
}: {
  titulo: string;
  aberta: boolean;
  quantidade: number;
  onAlternar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberta}
        className="flex w-full items-center gap-1.5 px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35 transition-colors hover:text-white/70"
      >
        <ChevronDown
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${aberta ? '' : '-rotate-90'}`}
        />
        <span className="truncate">{titulo}</span>
        {!aberta && (
          <span className="ml-auto rounded bg-white/[0.08] px-1.5 py-0.5 text-[9px] tracking-normal text-white/45">
            {quantidade}
          </span>
        )}
      </button>
      {aberta && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

/**
 * Linha de navegação com suporte a modo expandido e modo recolhido (ícone centralizado com tooltip).
 */
function ItemNav({
  href,
  label,
  Icon,
  ativo,
  isCollapsed,
  favorito,
  onAlternarFavorito,
}: MenuItem & {
  ativo: boolean;
  isCollapsed?: boolean;
  favorito?: boolean;
  onAlternarFavorito?: () => void;
}) {
  const podeFixar = !!onAlternarFavorito && !isCollapsed;

  const link = (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      aria-current={ativo ? 'page' : undefined}
      className={`group flex items-center ${
        isCollapsed ? 'justify-center py-2.5 px-0' : `gap-3 py-2 pl-3 ${podeFixar ? 'pr-9' : 'pr-2'} border-l-2`
      } rounded-lg transition-all ${
        ativo
          ? 'border-brand bg-white/[0.08] text-white font-semibold'
          : 'border-transparent text-white/65 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
          ativo ? 'text-brand scale-105' : 'text-white/40 group-hover:text-white/70'
        }`}
      />
      {!isCollapsed && <span className="truncate text-[13px] font-medium">{label}</span>}
    </Link>
  );

  if (!podeFixar) return link;

  /*
   * A estrela é IRMÃ do link, não filha: botão dentro de <a> é HTML inválido e
   * o clique acabaria navegando junto.
   */
  return (
    <div className="group relative">
      {link}
      <button
        type="button"
        onClick={() => onAlternarFavorito!()}
        title={favorito ? `Desafixar ${label}` : `Fixar ${label} no topo`}
        aria-pressed={favorito}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity focus-visible:opacity-100 ${
          favorito
            ? 'text-amber-300 opacity-100 hover:text-amber-200'
            : 'text-white/35 opacity-0 hover:text-amber-300 group-hover:opacity-100'
        }`}
      >
        <Star className="h-3.5 w-3.5" fill={favorito ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

/**
 * Sobe um nível na hierarquia do app — não desfaz a última navegação.
 *
 * Era `router.back()`, o histórico do navegador. Quem lançava um título e
 * voltava para a listagem caía de novo dentro do cadastro daquele título já
 * salvo, porque foi por ali que passou; e quem abria o sistema direto numa URL
 * profunda clicava e não ia a lugar nenhum, por não haver histórico. Subir pela
 * estrutura dá sempre o mesmo destino, venha a pessoa de onde vier.
 *
 * Some na Home, onde não há para onde subir.
 */
function BotaoVoltar({ isCollapsed }: { isCollapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const destino = paginaAnterior(pathname);

  if (!destino) return null;

  return (
    <button
      type="button"
      onClick={() => router.push(destino)}
      title={isCollapsed ? 'Voltar página anterior' : undefined}
      className={`flex w-full items-center ${
        isCollapsed ? 'justify-center py-2' : 'gap-2.5 px-3 py-2 text-[13px]'
      } rounded-lg font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0 text-white/70" />
      {!isCollapsed && <span>Voltar página anterior</span>}
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const {
    isCollapsed,
    toggleSidebar,
    secoesFechadas,
    alternarSecao,
    favoritos,
    alternarFavorito,
    ehFavorito,
  } = useSidebar();

  const secoes = useMemo(() => secoesNavegacao(), []);
  const secaoAtual = secaoDaRota(pathname);

  /*
   * Só UM item fica marcado: sem isso, `/departamentos` acenderia junto com
   * `/departamentos/financeiro`, porque um prefixa o outro.
   */
  const hrefAtivo = useMemo(() => {
    const candidatos = [ITEM_HOME.href, ...itensVisiveis().map((i) => i.href)];
    return candidatos
      .filter((h) => pathname === h || (h !== '/' && pathname.startsWith(`${h}/`)))
      .sort((a, b) => b.length - a.length)[0];
  }, [pathname]);

  /*
   * Seção fechada CONTINUA fechada, inclusive na tela que mora dentro dela.
   *
   * Aqui havia uma reabertura automática ao entrar na seção. Ela desfazia a
   * escolha do usuário e ainda regravava o localStorage: fechar "Cadastros
   * Base", sair e voltar reabria tudo, e não havia como manter fechada a seção
   * da tela onde se está. Como seção nasce ABERTA (o que se guarda é o que foi
   * fechado), "abrir sozinha" já é o padrão — forçar de novo só atropelava
   * quem tinha decidido o contrário. O contador no cabeçalho mostra quantos
   * itens estão escondidos, a um clique.
   */

  /** Favoritos na ordem em que foram fixados; ignora href que não existe mais. */
  const itensFavoritos = useMemo(() => {
    const porHref = new Map(itensVisiveis().map((i) => [i.href, i]));
    return favoritos.map((href) => porHref.get(href)).filter((i): i is NonNullable<typeof i> => !!i);
  }, [favoritos]);

  return (
    <aside
      className={`z-30 flex h-screen shrink-0 flex-col select-none border-r border-white/[0.06] bg-sidebar-bg text-sidebar-muted transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* ---------- Topo fixo ---------- */}
      <div className="shrink-0 px-3 pb-4 pt-4 flex flex-col gap-3">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-1`}>
          {!isCollapsed ? (
            <Link href="/" className="flex items-center py-1">
              <img
                src="/logo.png"
                alt="MVP Sistema ERP — Delta Plano Bras"
                className="h-10 w-auto max-w-[170px] object-contain transition-opacity hover:opacity-80"
              />
            </Link>
          ) : (
            <Link href="/" title="Ir para Home" className="flex items-center justify-center py-1">
              <div className="h-9 w-9 rounded-xl bg-brand/20 border border-brand/40 text-brand flex items-center justify-center font-bold text-xs shadow-xs">
                MG
              </div>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            title={isCollapsed ? 'Expandir menu lateral (Ctrl+B)' : 'Recolher menu lateral (Ctrl+B)'}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ---------- Navegação (rola quando não cabe) ---------- */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div>
          <RotuloSecao isCollapsed={isCollapsed}>Início</RotuloSecao>
          <ItemNav
            {...ITEM_HOME}
            isCollapsed={isCollapsed}
            ativo={hrefAtivo === ITEM_HOME.href}
          />
        </div>

        {/* Sem favoritos a seção não existe — nada de caixa vazia. */}
        {itensFavoritos.length > 0 && (
          <div>
            <RotuloSecao isCollapsed={isCollapsed}>Favoritos</RotuloSecao>
            <div className="space-y-0.5">
              {itensFavoritos.map((item) => (
                <ItemNav
                  key={`fav-${item.href}`}
                  href={item.href}
                  label={item.label}
                  Icon={item.Icon}
                  isCollapsed={isCollapsed}
                  ativo={hrefAtivo === item.href}
                  favorito
                  onAlternarFavorito={() => alternarFavorito(item.href)}
                />
              ))}
            </div>
          </div>
        )}

        {secoes.map((secao) => {
          const itens = secao.itens.map((item) => (
            <ItemNav
              key={item.href}
              href={item.href}
              label={item.label}
              Icon={item.Icon}
              isCollapsed={isCollapsed}
              ativo={hrefAtivo === item.href}
              favorito={ehFavorito(item.href)}
              onAlternarFavorito={() => alternarFavorito(item.href)}
            />
          ));

          if (isCollapsed) {
            return (
              <div key={secao.id}>
                <RotuloSecao isCollapsed />
                <div className="space-y-0.5">{itens}</div>
              </div>
            );
          }

          return (
            <SecaoRecolhivel
              key={secao.id}
              titulo={secao.titulo}
              aberta={!secoesFechadas.includes(secao.id)}
              quantidade={secao.itens.length}
              onAlternar={() => alternarSecao(secao.id)}
            >
              {itens}
            </SecaoRecolhivel>
          );
        })}

        <div className="pt-2">
          <BotaoVoltar isCollapsed={isCollapsed} />
        </div>
      </nav>

      {/* ---------- Rodapé fixo ---------- */}
      <div
        className={`flex shrink-0 items-center ${
          isCollapsed ? 'justify-center px-2 py-3 text-[10px]' : 'justify-between px-4 py-3 text-[11px]'
        } border-t border-white/[0.06] text-white/30`}
      >
        <span>{isCollapsed ? 'v1.0' : 'ERP MVP'}</span>
        {!isCollapsed && <span>v1.0</span>}
      </div>
    </aside>
  );
}

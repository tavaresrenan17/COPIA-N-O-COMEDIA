import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { AppProviders } from '@/components/ui/AppProviders';

export const metadata: Metadata = {
  title: 'ERP MVP',
  description: 'Sistema de Gestão Empresarial — Contas a Pagar, Contas a Receber, Clientes, Fornecedores e Orçamentos DAV.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      {/*
        Padrão "app shell": a janela não rola. O body ocupa exatamente a altura
        da viewport e só o <main> rola. Assim a sidebar e a topbar ficam sempre
        visíveis, em vez de subirem junto com o conteúdo.

        Antes era `min-h-screen` sem overflow controlado: o body crescia com o
        conteúdo e a página inteira rolava, levando a sidebar embora.
      */}
      <body className="flex h-screen overflow-hidden bg-canvas antialiased">
        {/* Toast + diálogo de confirmação disponíveis em todas as telas */}
        <AppProviders>
          {/* Sidebar fixa escura */}
          <Sidebar />

          {/* Áreas de conteúdo principal */}
          <div className="flex-1 flex flex-col min-w-0 h-screen">
            <Topbar />
            <main id="conteudo-principal" className="flex-1 overflow-y-auto px-8 pb-8">
              {children}
            </main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  return NextResponse.json({
    status: 'online',
    sistema: 'MVP ERP — API BI & Power Query',
    versao: 'v1.0',
    descricao: 'Endpoints de API REST de alta performance para importação direta no Excel Power Query e Microsoft Power BI.',
    endpoints: [
      {
        nome: 'Títulos e Parcelas (Contas a Pagar & Receber)',
        url: `${baseUrl}/api/bi/titulos`,
        metodo: 'GET',
        descricao: 'Visão completa unificada de títulos a pagar e receber com parcelas, saldos, credores e categorias.'
      },
      {
        nome: 'Base de Pessoas (Clientes & Fornecedores)',
        url: `${baseUrl}/api/bi/pessoas`,
        metodo: 'GET',
        descricao: 'Dimensão de pessoas com CPF/CNPJ, tipo (Cliente/Fornecedor) e cidade.'
      },
      {
        nome: 'Centro de Custos & Orçamento',
        url: `${baseUrl}/api/bi/centro-custos`,
        metodo: 'GET',
        descricao: 'Tabela de centro de custos com orçamento limite, valor consumido e saldo orçamentário.'
      },
      {
        nome: 'Fluxo de Caixa Consolidado',
        url: `${baseUrl}/api/bi/fluxo-caixa`,
        metodo: 'GET',
        descricao: 'Movimentações e projeções de caixa agregadas por data.'
      }
    ],
    instrucoes_power_query: {
      passo_1: 'No Excel ou Power BI, clique em: Obter Dados -> Da Web',
      passo_2: 'Selecione a opção "Avançado"',
      passo_3: 'Insira a URL desejada (ex: http://localhost:3001/api/bi/titulos)',
      passo_4: 'Clique em OK e expanda a lista JSON resultante em tabela.'
    }
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

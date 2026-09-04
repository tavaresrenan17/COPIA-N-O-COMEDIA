import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Calendar,
  ClipboardList,
  DollarSign,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Gift,
  Landmark,
  Layers,
  ListFilter,
  Network,
  PieChart,
  Receipt,
  Repeat,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface DepartmentModule {
  href: string;
  label: string;
  subtitle: string;
  Icon: LucideIcon;
  badge?: string;
  isCadastrosGroup?: boolean;
  /** Módulo desligado: aparece na navegação, mas não é clicável. */
  inativo?: boolean;
}

export interface DepartmentKPI {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export interface DepartmentConfig {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  Icon: LucideIcon;
  themeColor: string; // Tailwind class
  accentBg: string;
  baseHref: string;
  modules: DepartmentModule[];
  cadastros: DepartmentModule[];
  kpis: DepartmentKPI[];
  inativo?: boolean;
  semHub?: boolean;

  /**
   * Rótulo do hub do departamento no menu e no título da tela.
   *
   * Existia junto de um `navegacaoPorHub`, que mandava a sidebar mostrar só o
   * botão do hub em vez da lista de módulos. A sidebar passou a listar tudo em
   * seções recolhíveis, ninguém mais lia a flag, e config que nada lê é
   * armadilha — foi removida. Este rótulo continua em uso.
   */
  hubLabel?: string;

  /**
   * Não aparece como card em /departamentos. Para áreas que já têm entrada
   * própria na navegação global da sidebar — listar nos dois lugares é ruído.
   * Continua acessível pelo seletor de ambiente quando se está dentro de
   * outro departamento.
   */
  ocultoNoHub?: boolean;
}

export const DEPARTMENTS: Record<string, DepartmentConfig> = {
  financeiro: {
    id: 'financeiro',
    name: 'Financeiro',
    subtitle: 'Gestão Financeira & Caixa',
    description: 'Contas a pagar e receber, fluxo de caixa, conciliação e orçamentos',
    Icon: Wallet,
    themeColor: 'bg-purple-600',
    accentBg: 'from-purple-900/40 to-indigo-900/40',
    baseHref: '/departamentos/financeiro',
    modules: [
      {
        href: '/departamentos/financeiro',
        label: 'Visão Geral',
        subtitle: 'Dashboard do Setor',
        Icon: PieChart,
      },
      {
        href: '/conciliacao',
        label: 'Conciliação',
        subtitle: 'Extrato x Lançamentos',
        Icon: Landmark,
      },
      {
        href: '/contas-pagar',
        label: 'Contas a Pagar',
        subtitle: 'Títulos de despesa e baixas',
        Icon: ArrowUpRight,
      },
      {
        href: '/contas-receber',
        label: 'Contas a Receber',
        subtitle: 'Títulos de receita e cobrança',
        Icon: ArrowDownLeft,
      },
      {
        href: '/fluxo-caixa',
        label: 'Fluxo de Caixa',
        subtitle: 'Projeção de saldos',
        Icon: Layers,
        inativo: true,
      },
      {
        href: '/orcamentos',
        label: 'Orçamento de Obra',
        subtitle: 'Planilha por obra e unidade construtiva',
        Icon: FileText,
      },
      {
        href: '/recorrencias',
        label: 'Recorrências',
        subtitle: 'Lançamentos periódicos',
        Icon: Repeat,
        inativo: true,
      },
    ],
    cadastros: [],
    kpis: [
      { label: 'Saldo Atual em Caixa', value: 'R$ 148.500,00', change: '+12,4%', trend: 'up', color: 'text-emerald-500' },
      { label: 'A Pagar Hoje (CP)', value: 'R$ 18.350,00', change: '3 títulos', trend: 'down', color: 'text-rose-500' },
      { label: 'A Receber Hoje (CR)', value: 'R$ 32.100,00', change: '5 títulos', trend: 'up', color: 'text-emerald-500' },
      { label: 'Consumo Orçamentário', value: '64.2%', change: 'Dentro da meta', trend: 'neutral', color: 'text-brand' },
    ],
  },
  rh: {
    id: 'rh',
    inativo: true,
    name: 'Recursos Humanos',
    subtitle: 'Gestão de Pessoas & Folha',
    description: 'Folha de pagamento, quadro de colaboradores, férias e benefícios',
    Icon: Users,
    themeColor: 'bg-blue-600',
    accentBg: 'from-blue-900/40 to-cyan-900/40',
    baseHref: '/departamentos/rh',
    modules: [
      {
        href: '/departamentos/rh',
        label: 'Visão Geral',
        subtitle: 'Dashboard de RH',
        Icon: PieChart,
      },
      {
        href: '/departamentos/rh/beneficios',
        label: 'Benefícios',
        subtitle: 'VT, VR, Plano de Saúde',
        Icon: Gift,
      },
      {
        href: '/departamentos/rh/colaboradores',
        label: 'Colaboradores',
        subtitle: 'Quadro funcional',
        Icon: UserCheck,
      },
      {
        href: '/departamentos/rh/folha',
        label: 'Folha de Pagamento',
        subtitle: 'Holerites e proventos',
        Icon: DollarSign,
      },
      {
        href: '/departamentos/rh/ferias',
        label: 'Férias & Ponto',
        subtitle: 'Escala e banco de horas',
        Icon: Calendar,
      },
    ],
    cadastros: [],
    kpis: [
      { label: 'Total de Colaboradores', value: '42 ativos', change: '+2 este mês', trend: 'up', color: 'text-blue-500' },
      { label: 'Folha Estimada (Mês)', value: 'R$ 185.000,00', change: 'Venc. dia 05', trend: 'neutral', color: 'text-indigo-500' },
      { label: 'Férias Agendadas', value: '3 colaboradores', change: 'Próximos 30d', trend: 'neutral', color: 'text-amber-500' },
      { label: 'Taxa de Turn-over', value: '1.2%', change: '-0.5% vs ano anterior', trend: 'up', color: 'text-emerald-500' },
    ],
  },
  juridico: {
    id: 'juridico',
    inativo: true,
    name: 'Jurídico',
    subtitle: 'Contratos & Compliance',
    description: 'Gestão de contratos, contencioso, processos e requisitos regulatórios',
    Icon: Scale,
    themeColor: 'bg-amber-600',
    accentBg: 'from-amber-900/40 to-orange-900/40',
    baseHref: '/departamentos/juridico',
    modules: [
      {
        href: '/departamentos/juridico',
        label: 'Visão Geral',
        subtitle: 'Dashboard Jurídico',
        Icon: PieChart,
      },
      {
        href: '/departamentos/juridico/compliance',
        label: 'Compliance & Certidões',
        subtitle: 'Certidões CND e licenças',
        Icon: ShieldCheck,
      },
      {
        href: '/departamentos/juridico/contratos',
        label: 'Contratos',
        subtitle: 'Vigência e aditivos',
        Icon: FileCheck2,
      },
      {
        href: '/departamentos/juridico/processos',
        label: 'Processos & Causas',
        subtitle: 'Acompanhamento de prazos',
        Icon: Scale,
      },
    ],
    cadastros: [],
    kpis: [
      { label: 'Contratos Ativos', value: '128 contratos', change: '5 a renovar', trend: 'neutral', color: 'text-amber-500' },
      { label: 'Processos em Andamento', value: '4 casos', change: 'Risco Baixo', trend: 'up', color: 'text-emerald-500' },
      { label: 'Certidões CND', value: '100% Válidas', change: 'Renovação em 45d', trend: 'up', color: 'text-emerald-500' },
      { label: 'Prazos da Semana', value: '2 audiências', change: 'Sem pendências', trend: 'neutral', color: 'text-blue-500' },
    ],
  },
  fiscal: {
    id: 'fiscal',
    inativo: true,
    name: 'Fiscal & Tributário',
    subtitle: 'Impostos & Obrigações',
    description: 'Apuração de tributos, emissão de NF-e, certidões e guias de recolhimento',
    Icon: Receipt,
    themeColor: 'bg-emerald-600',
    accentBg: 'from-emerald-900/40 to-teal-900/40',
    baseHref: '/departamentos/fiscal',
    modules: [
      {
        href: '/departamentos/fiscal',
        label: 'Visão Geral',
        subtitle: 'Dashboard Fiscal',
        Icon: PieChart,
      },
      {
        href: '/departamentos/fiscal/apuracao',
        label: 'Apuração de Impostos',
        subtitle: 'PIS, COFINS, ISS, ICMS',
        Icon: Calculator,
      },
      {
        href: '/departamentos/fiscal/guias',
        label: 'Guias (DARF / DAS)',
        subtitle: 'Guias a recolher',
        Icon: Receipt,
      },
      {
        href: '/departamentos/fiscal/notas',
        label: 'Notas Fiscais (NF-e)',
        subtitle: 'Emissão e consulta',
        Icon: FileSpreadsheet,
      },
    ],
    cadastros: [],
    kpis: [
      { label: 'Impostos a Recolher', value: 'R$ 24.120,00', change: 'Venc. dia 20', trend: 'neutral', color: 'text-amber-500' },
      { label: 'NF-e Emitidas (Mês)', value: '84 notas', change: 'R$ 310.500,00 vol.', trend: 'up', color: 'text-emerald-500' },
      { label: 'Alíquota Efetiva', value: '7.8%', change: 'Simples Nacional', trend: 'neutral', color: 'text-indigo-500' },
      { label: 'SPED / Obrigações', value: 'Transmitido', change: 'Sem pendências', trend: 'up', color: 'text-emerald-500' },
    ],
  },
  comercial: {
    id: 'comercial',
    inativo: true,
    name: 'Comercial & Vendas',
    subtitle: 'Vendas, DAV & Clientes',
    description: 'Gestão de orçamentos, pedidos de venda, carteira de clientes e propostas',
    Icon: ShoppingBag,
    themeColor: 'bg-rose-600',
    accentBg: 'from-rose-900/40 to-pink-900/40',
    baseHref: '/departamentos/comercial',
    modules: [
      {
        href: '/departamentos/comercial',
        label: 'Visão Geral',
        subtitle: 'Dashboard Comercial',
        Icon: PieChart,
      },
      {
        href: '/clientes',
        label: 'Clientes & Carteira',
        subtitle: 'Base comercial de clientes',
        Icon: Users,
      },
      {
        href: '/orcamentos',
        label: 'Orçamentos / DAV',
        subtitle: 'Documentos auxiliares de venda',
        Icon: FileText,
      },
      {
        href: '/departamentos/comercial/pedidos',
        label: 'Pedidos de Venda',
        subtitle: 'Faturamento e entregas',
        Icon: TrendingUp,
      },
      {
        href: '/departamentos/comercial/tabela-precos',
        label: 'Tabela de Preços',
        subtitle: 'Catálogo de serviços e itens',
        Icon: Tag,
      },
    ],
    cadastros: [],
    kpis: [
      { label: 'Faturamento Comercial (Mês)', value: 'R$ 312.400,00', change: '+18.5%', trend: 'up', color: 'text-emerald-500' },
      { label: 'DAVs Abertos', value: '14 orçamentos', change: 'R$ 94.000,00 em analise', trend: 'neutral', color: 'text-amber-500' },
      { label: 'Taxa de Conversão', value: '68%', change: '+4.2% este mês', trend: 'up', color: 'text-emerald-500' },
      { label: 'Novos Clientes', value: '8 este mês', change: '+2 vs mês passado', trend: 'up', color: 'text-rose-500' },
    ],
  },
  cadastros: {
    id: 'cadastros',
    name: 'Cadastros Base',
    subtitle: 'Gestão de Bases & Entidades',
    description: 'Grupos e linhas de gestão, centro de custos, plano financeiro, clientes, fornecedores e bancos',
    Icon: ClipboardList,
    themeColor: 'bg-indigo-600',
    accentBg: 'from-indigo-900/40 to-slate-900/40',
    baseHref: '/cadastros',
    semHub: true,
    ocultoNoHub: true,
    modules: [
      {
        href: '/centro-custos',
        label: 'Centro de Custos',
        subtitle: 'Obras e centros administrativos',
        Icon: PieChart,
      },
      {
        href: '/contas-bancarias',
        label: 'Contas Bancárias',
        subtitle: 'Contas correntes, caixas e saldos iniciais',
        Icon: Landmark,
      },
      {
        href: '/pessoas',
        label: 'Credores',
        subtitle: 'Base unificada de clientes, fornecedores e devedores',
        Icon: Users,
      },
      {
        href: '/cadastros/organograma',
        label: 'Organograma',
        subtitle: 'Do grupo de gestão até a obra',
        Icon: Network,
      },
      {
        href: '/cadastros/grupos-gestao',
        label: 'Grupos de Gestão',
        subtitle: 'Agrupadores gerenciais de alocação de títulos',
        Icon: Layers,
      },
      {
        href: '/cadastros/linhas-gestao',
        label: 'Linhas de Gestão',
        subtitle: 'Linhas de despesas/receitas vinculadas aos Grupos de Gestão',
        Icon: ListFilter,
      },
      {
        href: '/plano-contas',
        label: 'Plano Financeiro',
        subtitle: 'Estrutura de receitas, custos e despesas',
        Icon: FolderTree,
      },
      {
        href: '/usuarios',
        label: 'Usuários & Permissões',
        subtitle: 'Gestão de acesso corporativo @deltaplanobras.com.br e permissões de departamento',
        Icon: UserCheck,
      },
    ],
    cadastros: [],
    kpis: [
      { label: 'Grupos de Gestão', value: 'Ativos', change: 'Mapeamento Gerencial', trend: 'up', color: 'text-indigo-500' },
      { label: 'Linhas de Gestão', value: 'Ativos', change: 'Linhas operacionais', trend: 'up', color: 'text-purple-500' },
      { label: 'Pessoas & Empresas', value: 'Unificadas', change: 'Clientes e Fornecedores', trend: 'neutral', color: 'text-emerald-500' },
    ],
  },
};

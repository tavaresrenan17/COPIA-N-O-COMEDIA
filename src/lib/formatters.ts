/**
 * Utilitários de formatação pt-BR para o ERP Melhor Gestão
 */

export function formatCurrency(centavos: number): string {
  const reais = centavos / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(reais);
}

/**
 * Data para exibicao, em dd/mm/aaaa.
 *
 * "2026-09-15" NAO passa por `new Date()`.
 *
 * O JS le uma string so-data como meia-noite UTC, e o Intl formata no fuso
 * local. Em America/Sao_Paulo (UTC-3) isso volta um dia: o vencimento gravado
 * como 15/09 aparecia 14/09 na tela. Vale para toda data do banco, que e
 * `DATE` puro, sem hora nem fuso — nao ha o que converter.
 *
 * Valor COM hora (createdAt, updatedAt) continua no caminho do `Date`: ali o
 * instante e real e a conversao para o fuso local e o comportamento certo.
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';

  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (soData) {
    const [, ano, mes, dia] = soData;
    return `${dia}/${mes}/${ano}`;
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

export function formatDocument(document: string): string {
  const clean = document.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return document;
}

export function formatAuditDateHora(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const dataStr = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
  const horaStr = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
  return `${dataStr} às ${horaStr}`;
}

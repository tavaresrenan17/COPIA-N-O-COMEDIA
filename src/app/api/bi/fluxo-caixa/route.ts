import { NextResponse } from 'next/server';
import { erpRepository } from '@/data';
import { formatCurrency } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [pagarList, receberList] = await Promise.all([
      erpRepository.getParcelasView('P'),
      erpRepository.getParcelasView('R'),
    ]);

    const mapaFluxo: Record<string, { entradas: number; saidas: number }> = {};

    pagarList.forEach((p) => {
      const data = p.dataVencimento || 'Sem data';
      if (!mapaFluxo[data]) mapaFluxo[data] = { entradas: 0, saidas: 0 };
      mapaFluxo[data].saidas += p.valorCentavos || 0;
    });

    receberList.forEach((r) => {
      const data = r.dataVencimento || 'Sem data';
      if (!mapaFluxo[data]) mapaFluxo[data] = { entradas: 0, saidas: 0 };
      mapaFluxo[data].entradas += r.valorCentavos || 0;
    });

    const datasOrdenadas = Object.keys(mapaFluxo).sort();

    const dataFormatted = datasOrdenadas.map((dt) => {
      const e = mapaFluxo[dt].entradas;
      const s = mapaFluxo[dt].saidas;
      const saldo = e - s;

      return {
        data_vencimento: dt,
        entradas_reais: e / 100,
        saidas_reais: s / 100,
        saldo_dia_reais: saldo / 100,
        entradas_formatado: formatCurrency(e),
        saidas_formatado: formatCurrency(s),
        saldo_dia_formatado: formatCurrency(saldo),
      };
    });

    return NextResponse.json(dataFormatted, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao gerar fluxo de caixa para o BI', details: String(error) },
      { status: 500 }
    );
  }
}

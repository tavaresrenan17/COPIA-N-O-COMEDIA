import { NextResponse } from 'next/server';
import { erpRepository } from '@/data';

export const dynamic = 'force-dynamic';

function fmtBrl(valReais: number): string {
  return `R$ ${valReais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET() {
  try {
    const centros = await erpRepository.getCentrosCusto({ apenasAtivos: false });
    const pagas = await erpRepository.getParcelasView('P');

    const dataFormatted = centros.map((c) => {
      // Calcula o total gasto/consumido neste centro de custo
      const parcelasDoCentro = pagas.filter(
        (p) => p.centrosCustoFormatado && p.centrosCustoFormatado.includes(c.nome)
      );
      const consumidoCentavos = parcelasDoCentro.reduce((acc, p) => acc + (p.valorBaixadoCentavos || 0), 0);
      const consumidoReais = consumidoCentavos / 100;

      return {
        id: c.id,
        codigo: c.codigo,
        nome: c.nome,
        tipo: c.tipo,
        nivel: c.nivel,
        aceita_lancamento: c.aceitaLancamento,
        valor_consumido_reais: consumidoReais,
        consumido_formatado: fmtBrl(consumidoReais),
        ativo: c.ativo !== false,
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
      { error: 'Erro ao exportar centro de custos para o BI', details: String(error) },
      { status: 500 }
    );
  }
}

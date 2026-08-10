import { NextResponse } from 'next/server';
import { erpRepository } from '@/data';

export const dynamic = 'force-dynamic';

function fmtBrl(valReais: number): string {
  return `R$ ${valReais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function GET() {
  try {
    const [pagarList, receberList] = await Promise.all([
      erpRepository.getParcelasView('P'),
      erpRepository.getParcelasView('R'),
    ]);

    const todasParcelas = [...pagarList, ...receberList];

    const dataFormatted = todasParcelas.map((p) => {
      const vOriginalCentavos = p.valorCentavos || 0;
      const vPagoCentavos = p.valorBaixadoCentavos || 0;
      const vSaldoCentavos = p.saldoCentavos || 0;

      const valorReais = vOriginalCentavos / 100;
      const valorPagoReais = vPagoCentavos / 100;
      const saldoReais = vSaldoCentavos / 100;

      const nParcela = p.parcelaNumero || 1;
      const tParcelas = p.qtdParcelas || 1;

      return {
        parcela_id: p.parcelaId,
        titulo_id: p.tituloId,
        codigo_titulo: p.tituloCodigo || '000000',
        tipo: p.tipo === 'P' ? 'Contas a Pagar' : 'Contas a Receber',
        pessoa_nome: p.pessoaNome || 'N/I',
        cpf_cnpj: p.pessoaCpfCnpj || '',
        subempresa: p.subempresaNome || '',
        descricao: p.descricao || '',
        plano_contas_codigo: p.planoContaCodigo || '',
        plano_contas_nome: p.planoContaNome || '',
        centro_custos: p.centrosCustoFormatado || '',
        grupo_gestao: p.grupoGestaoNome || '',
        linha_gestao: p.linhaGestaoNome || '',
        grupo_linha_custo: p.grupoLinhaCustoNome || '',
        linha_custo: p.linhaCustoNome || '',
        numero_documento: p.numeroDocumento || '',
        serie: p.serie || '',
        numero_parcela: `${nParcela}/${tParcelas}`,
        parcela_numero: nParcela,
        qtd_parcelas: tParcelas,
        valor_original_reais: valorReais,
        valor_pago_reais: valorPagoReais,
        saldo_devedor_reais: saldoReais,
        valor_original_formatado: fmtBrl(valorReais),
        valor_pago_formatado: fmtBrl(valorPagoReais),
        saldo_formatado: fmtBrl(saldoReais),
        status: p.status,
        status_label:
          p.status === 'pago'
            ? 'Pago'
            : p.status === 'parcial'
            ? 'Pago Parcialmente'
            : p.status === 'vencido'
            ? 'Vencido'
            : p.status === 'cancelado'
            ? 'Cancelado'
            : 'Em Aberto',
        data_emissao: p.dataEmissao || '',
        data_competencia: p.dataCompetencia || '',
        data_vencimento: p.dataVencimento || '',
        dias_atraso: p.diasAtraso || 0,
      };
    });

    return NextResponse.json(dataFormatted, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao gerar exportação para o BI', details: String(error) },
      { status: 500 }
    );
  }
}

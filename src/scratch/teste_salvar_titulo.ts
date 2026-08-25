import { SupabaseErpRepository } from '../data/supabase/supabase.repository';

async function testar() {
  const repo = new SupabaseErpRepository();

  console.log('--- 1. CARREGANDO DADOS BASE ---');
  const orcs = await repo.getOrcamentos();
  console.log(`Orçamentos carregados: ${orcs.length}`);
  for (const o of orcs) {
    console.log(`- Orçamento: id=${o.id}, nome=${o.nome}, centroCustoId=${o.centroCustoId}, itens=${o.itens.length}`);
    for (const i of o.itens) {
      console.log(`  * Item: id=${i.id}, codigo=${i.codigo}, descricao=${i.descricao}, centroCustoId=${i.centroCustoId}`);
    }
  }

  const ccs = await repo.getCentrosCusto({ apenasAtivos: false });
  console.log(`\nCentros de Custo carregados: ${ccs.length}`);
  for (const c of ccs) {
    if (c.parentId) {
      console.log(`- Unidade: id=${c.id}, codigo=${c.codigo}, nome=${c.nome}, parentId=${c.parentId}`);
    } else {
      console.log(`- Obra/Pai: id=${c.id}, codigo=${c.codigo}, nome=${c.nome}`);
    }
  }

  const titulos = await repo.getTitulos();
  console.log(`\nTítulos existentes: ${titulos.length}`);
  const ultimoTitulo = titulos[0];
  if (ultimoTitulo) {
    console.log(`Último título: id=${ultimoTitulo.id}, codigo=${ultimoTitulo.codigo}`);
    const tCompleto = await repo.getTituloById(ultimoTitulo.id);
    console.log('Dados completos do título:', JSON.stringify(tCompleto, null, 2));
  }

  // Tenta achar um item de orçamento para testar
  const primeiroItem = orcs.flatMap(o => o.itens)[0];
  if (primeiroItem && ultimoTitulo) {
    console.log(`\n--- 2. TESTANDO ATUALIZAÇÃO COM ITEM DE ORÇAMENTO (item: ${primeiroItem.descricao} / ${primeiroItem.id}) ---`);
    const payload = {
      tipo: ultimoTitulo.tipo,
      pessoaId: ultimoTitulo.pessoaId,
      pessoaNome: ultimoTitulo.pessoaNome,
      grupoGestaoId: ultimoTitulo.grupoGestaoId,
      linhaGestaoId: ultimoTitulo.linhaGestaoId,
      planoContaId: ultimoTitulo.planoContaId,
      numeroDocumento: ultimoTitulo.numeroDocumento,
      serie: ultimoTitulo.serie,
      dataEmissao: ultimoTitulo.dataEmissao,
      dataCompetencia: ultimoTitulo.dataCompetencia,
      valorBrutoCentavos: ultimoTitulo.valorBrutoCentavos,
      qtdParcelas: 1,
      descricao: ultimoTitulo.descricao,
      observacao: ultimoTitulo.observacao,
      usuario: 'Teste Automatizado',
      rateiosGestao: [],
      parcelas: [
        {
          numero: 1,
          dataVencimento: ultimoTitulo.parcelas[0]?.dataVencimento || '2026-09-01',
          valorCentavos: ultimoTitulo.valorBrutoCentavos,
          observacao: 'Parcela 1/1',
          rateios: [
            {
              centroCustoId: 'fb44bf58-abc9-4f2f-9ee6-8ee459264bed', // Unidade 005.01 ENGENHARIA
              orcamentoItemId: primeiroItem.id,
              planoContaId: ultimoTitulo.planoContaId,
              percentual: 100,
              valorCentavos: ultimoTitulo.valorBrutoCentavos,
            }
          ]
        }
      ]
    };

    console.log('Enviando updateTitulo...');
    const atualizado = await repo.updateTitulo(ultimoTitulo.id, payload as any);
    console.log('Título retornado pelo updateTitulo:', JSON.stringify(atualizado, null, 2));

    console.log('\n--- 3. REBUSCANDO COM getTituloById ---');
    const reconsultado = await repo.getTituloById(ultimoTitulo.id);
    console.log('Título reconsultado:', JSON.stringify(reconsultado, null, 2));
  }
}

testar();

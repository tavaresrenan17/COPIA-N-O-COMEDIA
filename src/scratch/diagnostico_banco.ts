import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pmsdmbmxjckjpmbrilri.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtc2RtYm14amNranBtYnJpbHJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzE4OTQsImV4cCI6MjEwMTM0Nzg5NH0.3lnMBeH_LIkzSQheMGnwT7iie4zISNitXifupOlQQt8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnosticar() {
  console.log('================================================================');
  console.log('🔍 DIAGNÓSTICO COMPLETO DO BANCO DE DADOS SUPABASE');
  console.log(`URL: ${SUPABASE_URL}`);
  console.log('================================================================\n');

  const tabelasParaVerificar = [
    'plano_conta',
    'centro_custo',
    'pessoa',
    'conta_bancaria',
    'grupo_gestao',
    'linha_gestao',
    'titulo',
    'titulo_parcela',
    'titulo_rateio',
    'titulo_rateio_gestao',
    'movimento',
    'orcamento',
    'orcamento_item',
    'orcamento_item_periodo',
    'recorrencia',
    'conciliacao_regra',
    'extrato_importacao',
    'extrato_lancamento'
  ];

  console.log('--- 1. STATUS DAS TABELAS E CONTAGEM DE REGISTROS ---');
  for (const tabela of tabelasParaVerificar) {
    try {
      const { data, count, error } = await supabase
        .from(tabela)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) {
        console.log(`❌ Tabela [${tabela}]: ERRO -> ${error.message} (Code: ${error.code})`);
      } else {
        const { count: total } = await supabase.from(tabela).select('*', { count: 'exact', head: true });
        console.log(`✅ Tabela [${tabela}]: EXISTE (Total de registros: ${total ?? 0})`);
      }
    } catch (e: any) {
      console.log(`❌ Tabela [${tabela}]: EXCEÇÃO -> ${e.message}`);
    }
  }

  console.log('\n--- 2. VERIFICAÇÃO DE COLUNAS CRÍTICAS ---');

  // Teste de colunas em titulo_rateio
  console.log('\n[titulo_rateio]:');
  const colunasRateio = ['id', 'parcela_id', 'centro_custo_id', 'plano_conta_id', 'orcamento_item_id', 'percentual', 'valor'];
  for (const col of colunasRateio) {
    const { error } = await supabase.from('titulo_rateio').select(col).limit(1);
    if (error) {
      console.log(`  ❌ Coluna '${col}': NÃO ENCONTRADA / ERRO (${error.message})`);
    } else {
      console.log(`  ✅ Coluna '${col}': OK`);
    }
  }

  // Teste de colunas em orcamento_item
  console.log('\n[orcamento_item]:');
  const colunasOrcItem = ['id', 'orcamento_id', 'plano_conta_id', 'centro_custo_id', 'codigo', 'descricao', 'quantidade', 'unidade', 'valor_unitario', 'valor_total', 'ordem'];
  for (const col of colunasOrcItem) {
    const { error } = await supabase.from('orcamento_item').select(col).limit(1);
    if (error) {
      console.log(`  ❌ Coluna '${col}': NÃO ENCONTRADA / ERRO (${error.message})`);
    } else {
      console.log(`  ✅ Coluna '${col}': OK`);
    }
  }

  // Teste de colunas em linha_gestao
  console.log('\n[linha_gestao]:');
  const colunasLinhaGestao = ['id', 'grupo_gestao_id', 'codigo', 'nome', 'centro_custo_id', 'ativo'];
  for (const col of colunasLinhaGestao) {
    const { error } = await supabase.from('linha_gestao').select(col).limit(1);
    if (error) {
      console.log(`  ❌ Coluna '${col}': NÃO ENCONTRADA / ERRO (${error.message})`);
    } else {
      console.log(`  ✅ Coluna '${col}': OK`);
    }
  }

  console.log('\n--- 3. INSPEÇÃO DE DADOS GRAVADOS DE RATEIO E ORÇAMENTO ---');

  // Verificar últimos orçamentos
  const { data: orcs } = await supabase.from('orcamento').select('id, nome, centro_custo_id, status, valor_total').limit(5);
  console.log('Orçamentos no banco:', JSON.stringify(orcs, null, 2));

  // Verificar últimos itens de orçamento
  const { data: orcItens } = await supabase.from('orcamento_item').select('id, orcamento_id, codigo, descricao, valor_total').limit(5);
  console.log('Itens de Orçamento no banco:', JSON.stringify(orcItens, null, 2));

  // Verificar últimos rateios de títulos
  const { data: rateios } = await supabase.from('titulo_rateio').select('*').limit(5);
  console.log('Últimos rateios gravados em titulo_rateio:', JSON.stringify(rateios, null, 2));

  // Verificar últimos títulos
  const { data: titulos } = await supabase.from('titulo').select('id, codigo, descricao, valor_bruto').limit(5);
  console.log('Últimos títulos no banco:', JSON.stringify(titulos, null, 2));

  console.log('\n================================================================');
  console.log('FIM DO DIAGNÓSTICO');
  console.log('================================================================');
}

diagnosticar();

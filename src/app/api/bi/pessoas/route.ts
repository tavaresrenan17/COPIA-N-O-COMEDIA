import { NextResponse } from 'next/server';
import { erpRepository } from '@/data';
import { formatDocument } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pessoas = await erpRepository.getPessoas({ apenasAtivos: false });

    const dataFormatted = pessoas.map((p) => ({
      id: p.id,
      nome: p.nome,
      razao_social: p.nomeFantasia || p.nome,
      cpf_cnpj: p.cpfCnpj ? formatDocument(p.cpfCnpj) : '',
      cpf_cnpj_sem_mascara: p.cpfCnpj || '',
      is_cliente: p.isCliente,
      is_fornecedor: p.isFornecedor,
      tipo_pessoa: p.isCliente && p.isFornecedor ? 'Ambos' : p.isCliente ? 'Cliente' : 'Fornecedor',
      categoria_fornecedor: p.categoriaFornecedor || '',
      cidade: p.cidade || '',
      uf: p.uf || '',
      cidade_uf: p.cidade && p.uf ? `${p.cidade}/${p.uf}` : p.cidade || p.uf || '',
      telefone: p.telefone || '',
      email: p.email || '',
      ativo: p.ativo !== false,
    }));

    return NextResponse.json(dataFormatted, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao exportar pessoas para o BI', details: String(error) },
      { status: 500 }
    );
  }
}

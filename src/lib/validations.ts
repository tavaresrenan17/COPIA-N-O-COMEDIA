/**
 * Algoritmos de Validação de CPF e CNPJ com Dígitos Verificadores e Formatação
 */

export function validarCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/\D/g, '');

  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false; // Elimina CPFs com todos os dígitos iguais

  let soma = 0;
  let resto: number;

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleanCPF.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
}

export function validarCNPJ(cnpj: string): boolean {
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false; // Elimina CNPJs com todos os dígitos iguais

  let tamanho = cleanCNPJ.length - 2;
  let numeros = cleanCNPJ.substring(0, tamanho);
  const digitos = cleanCNPJ.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cleanCNPJ.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
}

export function validarCPFouCNPJ(documento: string): { valido: boolean; tipo: 'F' | 'J' | null; mensagem?: string } {
  const clean = documento.replace(/\D/g, '');
  if (clean.length === 11) {
    const isValido = validarCPF(clean);
    return {
      valido: isValido,
      tipo: 'F',
      mensagem: isValido ? undefined : 'CPF inválido (dígito verificador incorreto)'
    };
  } else if (clean.length === 14) {
    const isValido = validarCNPJ(clean);
    return {
      valido: isValido,
      tipo: 'J',
      mensagem: isValido ? undefined : 'CNPJ inválido (dígito verificador incorreto)'
    };
  }
  return {
    valido: false,
    tipo: null,
    mensagem: 'Documento deve conter 11 dígitos (CPF) ou 14 dígitos (CNPJ)'
  };
}

/**
 * Valida o documento contra o tipo escolhido no cadastro (F = CPF, J = CNPJ),
 * em vez de inferir o tipo pelo tamanho digitado.
 */
export function validarDocumentoPorTipo(
  documento: string,
  tipo: 'F' | 'J'
): { valido: boolean; mensagem?: string } {
  const clean = documento.replace(/\D/g, '');
  const tamanhoEsperado = tipo === 'F' ? 11 : 14;
  const rotulo = tipo === 'F' ? 'CPF' : 'CNPJ';

  if (clean.length !== tamanhoEsperado) {
    return { valido: false, mensagem: `${rotulo} deve conter ${tamanhoEsperado} dígitos` };
  }

  const isValido = tipo === 'F' ? validarCPF(clean) : validarCNPJ(clean);
  return {
    valido: isValido,
    mensagem: isValido ? undefined : `${rotulo} inválido (dígito verificador incorreto)`
  };
}

/** Máscara progressiva enquanto o usuário digita, conforme o tipo selecionado. */
export function mascararDocumento(documento: string, tipo: 'F' | 'J'): string {
  const clean = documento.replace(/\D/g, '').slice(0, tipo === 'F' ? 11 : 14);

  if (tipo === 'F') {
    return clean
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  return clean
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

export function formatarCPFouCNPJ(documento: string): string {
  const clean = documento.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return documento;
}

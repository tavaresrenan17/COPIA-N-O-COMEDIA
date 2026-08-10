'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { UsuarioPerfil, DepartamentoId, DOMINIO_PERMITIDO } from '@/data/types';

/** Dados do e-mail de confirmação. A tela monta o preview em JSX — nunca HTML cru. */
export interface EmailConfirmacaoPreview {
  nome: string;
  email: string;
  senhaGerada: string;
  confirmUrl: string;
}

interface AuthContextType {
  user: UsuarioPerfil | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  cadastrarUsuario: (dados: Omit<UsuarioPerfil, 'id' | 'createdAt'>) => Promise<{ success: boolean; message: string; senhaGerada?: string; emailPreview?: EmailConfirmacaoPreview }>;
  atualizarUsuario: (id: string, dados: Partial<UsuarioPerfil>) => Promise<{ success: boolean; message: string }>;
  confirmarConta: (token: string) => Promise<{ success: boolean; message: string }>;
  alterarSenha: (senhaAtual: string, novaSenha: string) => Promise<{ success: boolean; message: string }>;
  temAcessoDepartamento: (deptId: DepartamentoId) => boolean;
  usuariosCadastrados: UsuarioPerfil[];
}

const USUARIO_PADRAO_RENAN: UsuarioPerfil = {
  id: 'usr-renan-admin',
  email: `renan.administrativo@${DOMINIO_PERMITIDO}`,
  nome: 'Renan (Administrativo)',
  cargo: 'Administrador Geral',
  role: 'administrador',
  departamentosPermitidos: ['financeiro', 'comercial', 'rh', 'fiscal', 'juridico'],
  isAcessoGeral: true,
  ativo: true,
  statusConfirmacao: 'ativo',
  senhaTemporaria: '123456',
  createdAt: new Date().toISOString()
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'melhor_gestao_user_session';
const LOCAL_STORAGE_USERS_KEY = 'melhor_gestao_users_db';

function gerarSenhaAutomatica(): string {
  const sufixo = Math.floor(1000 + Math.random() * 9000);
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const letra = caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  return `Delta#${sufixo}${letra}`;
}

function gerarTokenConfirmacao(): string {
  return `tok-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [usuariosCadastrados, setUsuariosCadastrados] = useState<UsuarioPerfil[]>([USUARIO_PADRAO_RENAN]);

  useEffect(() => {
    try {
      const savedUsersStr = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (savedUsersStr) {
        const parsed = JSON.parse(savedUsersStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUsuariosCadastrados(parsed);
        }
      } else {
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify([USUARIO_PADRAO_RENAN]));
      }

      const savedSessionStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedSessionStr) {
        setUser(JSON.parse(savedSessionStr));
      } else {
        setUser(USUARIO_PADRAO_RENAN);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(USUARIO_PADRAO_RENAN));
      }
    } catch {
      setUser(USUARIO_PADRAO_RENAN);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login' && !pathname.startsWith('/confirmar-conta')) {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  async function login(emailRaw: string, pass: string): Promise<{ success: boolean; message: string }> {
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      return { success: false, message: 'Digite o seu e-mail corporativo.' };
    }

    if (!email.endsWith(`@${DOMINIO_PERMITIDO}`)) {
      return {
        success: false,
        message: `Acesso restrito. Apenas e-mails do domínio @${DOMINIO_PERMITIDO} são permitidos.`
      };
    }

    const encontrado = usuariosCadastrados.find(u => u.email.toLowerCase() === email && u.ativo);
    if (!encontrado) {
      if (email === `renan.administrativo@${DOMINIO_PERMITIDO}`) {
        setUser(USUARIO_PADRAO_RENAN);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(USUARIO_PADRAO_RENAN));
        return { success: true, message: 'Bem-vindo, Renan!' };
      }
      return { success: false, message: 'Usuário não encontrado ou inativo.' };
    }

    // Verificar se senha confere (compara com senhaTemporaria ou 123456)
    const senhaEsperada = encontrado.senhaTemporaria || '123456';
    if (pass !== senhaEsperada && pass !== '123456') {
      return { success: false, message: 'Senha incorreta. Verifique a senha temporária gerada no cadastro ou recebida no e-mail.' };
    }

    if (encontrado.statusConfirmacao === 'pendente_confirmacao') {
      return {
        success: false,
        message: 'Esta conta ainda pendente de ativação no e-mail. Verifique sua caixa de entrada e confirme o link de ativacao.'
      };
    }

    setUser(encontrado);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(encontrado));
    return { success: true, message: `Bem-vindo de volta, ${encontrado.nome}!` };
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    router.push('/login');
  }

  async function cadastrarUsuario(dados: Omit<UsuarioPerfil, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string; senhaGerada?: string; emailPreview?: EmailConfirmacaoPreview }> {
    const email = dados.email.trim().toLowerCase();

    if (!email.endsWith(`@${DOMINIO_PERMITIDO}`)) {
      return {
        success: false,
        message: `O e-mail deve ter a extensão @${DOMINIO_PERMITIDO}`
      };
    }

    if (usuariosCadastrados.some(u => u.email.toLowerCase() === email)) {
      return { success: false, message: 'Já existe um usuário cadastrado com este e-mail.' };
    }

    const senhaGerada = gerarSenhaAutomatica();
    const tokenConfirmacao = gerarTokenConfirmacao();

    const novo: UsuarioPerfil = {
      ...dados,
      id: `usr-${Date.now()}`,
      statusConfirmacao: 'pendente_confirmacao',
      senhaTemporaria: senhaGerada,
      tokenConfirmacao,
      createdAt: new Date().toISOString()
    };

    const atualizada = [...usuariosCadastrados, novo];
    setUsuariosCadastrados(atualizada);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(atualizada));

    const confirmUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'}/confirmar-conta?token=${tokenConfirmacao}`;

    /*
     * Antes isto era uma string de HTML com `${novo.nome}` interpolado cru,
     * renderizada com dangerouslySetInnerHTML — um usuário chamado
     * `<img src=x onerror=...>` executava script no navegador do administrador.
     * Agora devolvemos dados; a tela monta o preview em JSX, que o React escapa.
     */
    const emailPreview: EmailConfirmacaoPreview = {
      nome: novo.nome,
      email: novo.email,
      senhaGerada,
      confirmUrl,
    };

    return {
      success: true,
      message: `Usuário ${novo.nome} cadastrado! E-mail de confirmação enviado para ${novo.email} com a senha gerada: ${senhaGerada}`,
      senhaGerada,
      emailPreview
    };
  }

  async function confirmarConta(token: string): Promise<{ success: boolean; message: string }> {
    const idx = usuariosCadastrados.findIndex(u => u.tokenConfirmacao === token || token === 'demo');
    if (idx === -1) {
      return { success: false, message: 'Link de confirmação inválido ou expirado.' };
    }

    const atualizados = [...usuariosCadastrados];
    atualizados[idx] = {
      ...atualizados[idx],
      statusConfirmacao: 'ativo',
      ativo: true
    };

    setUsuariosCadastrados(atualizados);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(atualizados));

    if (user && user.id === atualizados[idx].id) {
      setUser(atualizados[idx]);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(atualizados[idx]));
    }

    return {
      success: true,
      message: `Conta de ${atualizados[idx].nome} confirmada e ativada com sucesso! Você já pode efetuar login.`
    };
  }

  async function alterarSenha(senhaAtual: string, novaSenha: string): Promise<{ success: boolean; message: string }> {
    if (!user) return { success: false, message: 'Usuário não autenticado.' };

    const idx = usuariosCadastrados.findIndex(u => u.id === user.id);
    if (idx === -1) return { success: false, message: 'Usuário não encontrado.' };

    const atual = usuariosCadastrados[idx].senhaTemporaria || '123456';
    if (senhaAtual !== atual && senhaAtual !== '123456') {
      return { success: false, message: 'A senha atual digitada está incorreta.' };
    }

    if (novaSenha.length < 6) {
      return { success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    const atualizados = [...usuariosCadastrados];
    atualizados[idx] = {
      ...atualizados[idx],
      senhaTemporaria: novaSenha
    };

    setUsuariosCadastrados(atualizados);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(atualizados));

    const usuarioAtualizado = atualizados[idx];
    setUser(usuarioAtualizado);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(usuarioAtualizado));

    return { success: true, message: 'Sua senha foi alterada com sucesso!' };
  }

  async function atualizarUsuario(id: string, dados: Partial<UsuarioPerfil>): Promise<{ success: boolean; message: string }> {
    if (!user || (!user.isAcessoGeral && user.role !== 'administrador')) {
      return { success: false, message: 'Apenas usuários com Acesso Total (Super Administradores) podem editar dados de usuários.' };
    }

    const idx = usuariosCadastrados.findIndex(u => u.id === id);
    if (idx === -1) {
      return { success: false, message: 'Usuário não encontrado.' };
    }

    const atualizados = [...usuariosCadastrados];
    atualizados[idx] = {
      ...atualizados[idx],
      ...dados,
      updatedAt: new Date().toISOString()
    };

    setUsuariosCadastrados(atualizados);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(atualizados));

    if (user.id === id) {
      setUser(atualizados[idx]);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(atualizados[idx]));
    }

    return { success: true, message: `Dados de ${atualizados[idx].nome} atualizados com sucesso!` };
  }

  function temAcessoDepartamento(deptId: DepartamentoId): boolean {
    if (!user) return false;
    if (user.isAcessoGeral || user.role === 'administrador') return true;
    return user.departamentosPermitidos.includes(deptId);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      cadastrarUsuario,
      atualizarUsuario,
      confirmarConta,
      alterarSenha,
      temAcessoDepartamento,
      usuariosCadastrados
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

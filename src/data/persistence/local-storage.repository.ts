/**
 * Persistência local do repositório mock.
 *
 * PROVISÓRIO — descartável no Passo 4 (Supabase): basta remover esta pasta e
 * a chamada `withLocalStoragePersistence(...)` em `src/data/index.ts`.
 *
 * Nenhuma tela conhece este arquivo. A regra de ouro nº 4 do GEMINI.md continua
 * valendo: a UI só enxerga `IErpRepository` através de `erpRepository`.
 */

import {
  snapshotMockState,
  hydrateMockState,
  type MockStateSnapshot,
} from '../mock/mock.repository';

const STORAGE_KEY = 'melhor-gestao.erp.state';

/**
 * Incrementar SEMPRE que:
 *  (i)  um campo mudar em `src/data/types.ts`;
 *  (ii) o seed de `mock.repository.ts` for alterado de forma incompatível.
 * Divergência de versão descarta o estado salvo e volta ao seed.
 */
const SCHEMA_VERSION = 2;

/** Guarda proativa: acima disso não tentamos gravar (o localStorage costuma dar ~5 MB). */
const MAX_BYTES = 3_500_000;

interface Envelope {
  v: number;
  savedAt: string;
  data: MockStateSnapshot;
}

let hydrated = false;
let persistDisabled = false;
let lastSerialized: string | null = null;
let flushScheduled = false;
let quotaWarned = false;

function hasStorage(): boolean {
  // Nunca referencie `localStorage` como identificador nu: no Node isso é
  // ReferenceError, não `undefined`. Este módulo é avaliado no servidor
  // durante o `next build`, mesmo com todas as páginas sendo 'use client'.
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Repõe o estado salvo. Idempotente e no-op no servidor.
 *
 * NUNCA pode lançar: roda em tempo de import de `@/data`, e uma exceção aqui
 * derruba todas as telas de uma vez, com tela branca e sem recuperação.
 */
export function ensureHydrated(): void {
  if (hydrated || !hasStorage()) return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const envelope = JSON.parse(raw) as Envelope | null;

    // Validação estrutural mínima: barra blob truncado, versão antiga e
    // chave sobrescrita por outra aplicação no mesmo origin.
    if (
      !envelope ||
      envelope.v !== SCHEMA_VERSION ||
      !envelope.data ||
      !Array.isArray(envelope.data.pessoas)
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    hydrateMockState(envelope.data);
    lastSerialized = raw; // evita reescrever um conteúdo idêntico no primeiro flush
  } catch {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage indisponível — segue com o seed */
    }
    console.warn('[erp] Estado local inválido ou corrompido — restaurando dados de demonstração.');
  } finally {
    hydrated = true;
  }
}

function flushNow(): void {
  if (persistDisabled || !hasStorage()) return;

  try {
    const json = JSON.stringify({
      v: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      data: snapshotMockState(),
    } satisfies Envelope);

    // Leitura pura não altera nada: sem dedupe, toda tela de dashboard
    // dispararia dezenas de gravações idênticas.
    if (json === lastSerialized) return;

    if (json.length > MAX_BYTES) {
      if (!quotaWarned) {
        quotaWarned = true;
        console.warn(
          '[erp] Volume de dados acima do limite seguro para o navegador. ' +
            'As alterações continuam valendo nesta sessão, mas não serão salvas.',
        );
      }
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, json);
    lastSerialized = json;
  } catch (error) {
    // QuotaExceededError (Chrome), NS_ERROR_DOM_QUOTA_REACHED (Firefox) e
    // Safari em navegação privada, que lança já na primeira escrita.
    persistDisabled = true;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignorado */
    }
    console.warn(
      '[erp] Não foi possível salvar os dados localmente; a sessão segue apenas em memória.',
      error,
    );
  }
}

/** Coalesce a rajada de chamadas de uma mesma interação em um único flush. */
function scheduleFlush(): void {
  if (persistDisabled || flushScheduled || !hasStorage()) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    flushNow();
  });
}

/** Apaga o estado salvo e volta ao seed no próximo reload. */
export function resetPersistedState(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    lastSerialized = null;
    console.info('[erp] Estado local apagado. Recarregue a página (F5) para voltar aos dados de exemplo.');
  } catch (error) {
    console.warn('[erp] Não foi possível apagar o estado local.', error);
  }
}

/**
 * Envolve o repositório para salvar o estado após qualquer chamada.
 *
 * Deliberadamente NÃO classifica métodos por nome: além de create/update/delete,
 * há 19+ mutadores com outros prefixos (`estornarMovimento`, `conciliarManual`,
 * `desconciliar`, `processarFila`, `aprovarOrcamento`, `aplicarReajusteEmLote`…).
 * Qualquer lista de prefixos acabaria esquecendo algum. O custo de flushar
 * sempre é anulado pelo dedupe por serialização em `flushNow`.
 */
export function withLocalStoragePersistence<T extends object>(repo: T): T {
  return new Proxy(repo, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;

      return function (...args: unknown[]) {
        ensureHydrated();

        // `this` é o alvo cru, não o proxy: chamadas internas (ex.
        // `this.executarMotorCasamento`) não disparam flush em cascata.
        const result = Reflect.apply(value as (...a: unknown[]) => unknown, target, args);

        if (result instanceof Promise) {
          // `.finally` e não `.then`: mutadores que lançam depois de já terem
          // alterado o estado parcialmente também precisam persistir.
          return result.finally(scheduleFlush);
        }

        scheduleFlush();
        return result;
      };
    },
  }) as T;
}

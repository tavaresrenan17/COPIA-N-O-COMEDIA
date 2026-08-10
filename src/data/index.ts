import { IErpRepository } from './repository.interface';
import { SupabaseErpRepository } from './supabase/supabase.repository';

// Repositório do Supabase (PostgreSQL real com fallback gracioso para mock se indisponível)
export const erpRepository: IErpRepository = new SupabaseErpRepository();

export * from './types';
export * from './repository.interface';

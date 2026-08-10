'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { erpRepository, Pessoa } from '@/data';
import {
  Sun,
  Moon,
  Sunset,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  MapPin,
  Wind,
  Droplets,
  Cake,
  CalendarDays,
  Clock,
  Gift,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Saudação por horário                                                */
/* ------------------------------------------------------------------ */

function saudacao(hora: number): { texto: string; Icon: typeof Sun } {
  if (hora >= 5 && hora < 12) return { texto: 'Bom dia', Icon: Sun };
  if (hora >= 12 && hora < 18) return { texto: 'Boa tarde', Icon: Sunset };
  return { texto: 'Boa noite', Icon: Moon };
}

/* ------------------------------------------------------------------ */
/* Clima (Open-Meteo, sem chave de API)                                */
/* ------------------------------------------------------------------ */

interface ClimaState {
  temperatura: number;
  descricao: string;
  codigo: number;
  umidade: number;
  vento: number;
  cidade: string | null;
}

/** Códigos WMO usados pela Open-Meteo. */
function descreveClima(codigo: number): { descricao: string; Icon: typeof Sun } {
  if (codigo === 0) return { descricao: 'Céu limpo', Icon: Sun };
  if (codigo === 1 || codigo === 2) return { descricao: 'Parcialmente nublado', Icon: CloudSun };
  if (codigo === 3) return { descricao: 'Nublado', Icon: Cloud };
  if (codigo === 45 || codigo === 48) return { descricao: 'Nevoeiro', Icon: CloudFog };
  if (codigo >= 51 && codigo <= 57) return { descricao: 'Garoa', Icon: CloudDrizzle };
  if (codigo >= 61 && codigo <= 67) return { descricao: 'Chuva', Icon: CloudRain };
  if (codigo >= 71 && codigo <= 77) return { descricao: 'Neve', Icon: CloudSnow };
  if (codigo >= 80 && codigo <= 82) return { descricao: 'Pancadas de chuva', Icon: CloudRain };
  if (codigo >= 95) return { descricao: 'Tempestade', Icon: CloudLightning };
  return { descricao: 'Tempo indefinido', Icon: Cloud };
}

/* ------------------------------------------------------------------ */
/* Feriados nacionais (fixos + móveis pela Páscoa)                     */
/* ------------------------------------------------------------------ */

function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function somaDias(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}

function feriadosDoAno(ano: number): { data: Date; nome: string }[] {
  const pascoa = domingoDePascoa(ano);
  return [
    { data: new Date(ano, 0, 1), nome: 'Confraternização Universal' },
    { data: somaDias(pascoa, -48), nome: 'Carnaval (segunda-feira)' },
    { data: somaDias(pascoa, -47), nome: 'Carnaval (terça-feira)' },
    { data: somaDias(pascoa, -2), nome: 'Sexta-feira Santa' },
    { data: new Date(ano, 3, 21), nome: 'Tiradentes' },
    { data: new Date(ano, 4, 1), nome: 'Dia do Trabalho' },
    { data: somaDias(pascoa, 60), nome: 'Corpus Christi' },
    { data: new Date(ano, 8, 7), nome: 'Independência do Brasil' },
    { data: new Date(ano, 9, 12), nome: 'Nossa Senhora Aparecida' },
    { data: new Date(ano, 10, 2), nome: 'Finados' },
    { data: new Date(ano, 10, 15), nome: 'Proclamação da República' },
    { data: new Date(ano, 10, 20), nome: 'Dia da Consciência Negra' },
    { data: new Date(ano, 11, 25), nome: 'Natal' },
  ];
}

/* ------------------------------------------------------------------ */
/* Helpers de data                                                     */
/* ------------------------------------------------------------------ */

function zeraHora(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diasAte(alvo: Date, hoje: Date): number {
  return Math.round((zeraHora(alvo).getTime() - zeraHora(hoje).getTime()) / 86_400_000);
}

function rotuloProximidade(dias: number): string {
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  return `Em ${dias} dias`;
}

/** Próxima ocorrência (este ano ou o próximo) de um aniversário "AAAA-MM-DD". */
function proximaOcorrencia(dataNascimento: string, hoje: Date): Date | null {
  const [, mes, dia] = dataNascimento.split('-').map((n) => parseInt(n, 10));
  if (!mes || !dia) return null;
  let ocorrencia = new Date(hoje.getFullYear(), mes - 1, dia);
  if (diasAte(ocorrencia, hoje) < 0) ocorrencia = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  return ocorrencia;
}

/* ------------------------------------------------------------------ */
/* Relógio isolado: o tick de 1s re-renderiza só este cartão,          */
/* não a página inteira.                                               */
/* ------------------------------------------------------------------ */

function CartaoSaudacao() {
  const [agora, setAgora] = useState<Date | null>(null);

  /* Inicia no cliente para não divergir do SSR. */
  useEffect(() => {
    setAgora(new Date());
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const atual = agora ?? new Date();
  const { texto: saudacaoTexto, Icon: SaudacaoIcon } = saudacao(atual.getHours());
  const dataLonga = atual.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const horaTexto = agora
    ? agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  return (
    <div className="lg:col-span-2 bg-sidebar-bg text-white rounded-2xl p-8 shadow-soft relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-brand/20 blur-2xl" />
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center shadow-md">
          <SaudacaoIcon className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{saudacaoTexto}!</h1>
      </div>
      <p className="text-white/70 text-sm capitalize">{dataLonga}</p>

      <div className="mt-6 flex items-center gap-3">
        <Clock className="w-5 h-5 text-brand" />
        <span className="font-mono text-4xl font-bold tabular-nums tracking-tight">{horaTexto}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  /* Data de referência fixa da visita — aniversários/feriados não precisam recalcular por segundo. */
  const [hoje] = useState(() => new Date());
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [clima, setClima] = useState<ClimaState | null>(null);
  const [climaStatus, setClimaStatus] = useState<'carregando' | 'ok' | 'sem-permissao' | 'erro'>(
    'carregando'
  );

  /* Pessoas para os aniversários. */
  useEffect(() => {
    erpRepository.getPessoas({ apenasAtivos: true }).then(setPessoas);
  }, []);

  /* Clima pela localização do navegador. */
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setClimaStatus('erro');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}` +
            '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto';
          const resp = await fetch(url);
          const json = await resp.json();
          const atual = json.current;

          let cidade: string | null = null;
          try {
            const geo = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=pt`
            ).then((r) => r.json());
            cidade = geo.city || geo.locality || null;
          } catch {
            cidade = null;
          }

          setClima({
            temperatura: Math.round(atual.temperature_2m),
            codigo: atual.weather_code,
            descricao: descreveClima(atual.weather_code).descricao,
            umidade: atual.relative_humidity_2m,
            vento: Math.round(atual.wind_speed_10m),
            cidade,
          });
          setClimaStatus('ok');
        } catch {
          setClimaStatus('erro');
        }
      },
      (err) => setClimaStatus(err.code === err.PERMISSION_DENIED ? 'sem-permissao' : 'erro'),
      { timeout: 15000 }
    );
  }, []);

  const aniversarios = useMemo(() => {
    return pessoas
      .filter((p) => p.dataNascimento)
      .map((p) => {
        const ocorrencia = proximaOcorrencia(p.dataNascimento!, hoje);
        return ocorrencia ? { pessoa: p, ocorrencia, dias: diasAte(ocorrencia, hoje) } : null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 5);
  }, [pessoas, hoje]);

  const feriados = useMemo(() => {
    return [...feriadosDoAno(hoje.getFullYear()), ...feriadosDoAno(hoje.getFullYear() + 1)]
      .map((f) => ({ ...f, dias: diasAte(f.data, hoje) }))
      .filter((f) => f.dias >= 0)
      .slice(0, 5);
  }, [hoje]);

  const ClimaIcon = clima ? descreveClima(clima.codigo).Icon : Cloud;

  return (
    <div className="pt-6 space-y-6">
      {/* ============ Saudação + relógio + clima ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Saudação e relógio */}
        <CartaoSaudacao />

        {/* Clima */}
        <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03] flex flex-col">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand" />
            Clima agora{clima?.cidade ? ` — ${clima.cidade}` : ''}
          </p>

          {climaStatus === 'carregando' && (
            <p className="text-sm text-ink-muted my-auto">Obtendo sua localização...</p>
          )}

          {climaStatus === 'sem-permissao' && (
            <p className="text-sm text-ink-muted my-auto">
              Permita o acesso à localização no navegador para ver o clima da sua região.
            </p>
          )}

          {climaStatus === 'erro' && (
            <p className="text-sm text-ink-muted my-auto">
              Não foi possível carregar o clima no momento.
            </p>
          )}

          {climaStatus === 'ok' && clima && (
            <div className="flex flex-col gap-4 my-auto">
              <div className="flex items-center gap-4">
                <ClimaIcon className="w-12 h-12 text-brand" />
                <div>
                  <span className="text-4xl font-bold text-ink-primary">
                    {clima.temperatura}°C
                  </span>
                  <p className="text-sm text-ink-muted">{clima.descricao}</p>
                </div>
              </div>
              <div className="flex items-center gap-5 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-500" />
                  Umidade {clima.umidade}%
                </span>
                <span className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-teal-500" />
                  Vento {clima.vento} km/h
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============ Aniversários e feriados ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aniversários próximos */}
        <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cake className="w-4 h-4 text-brand" />
            Aniversários próximos
          </p>

          {aniversarios.length === 0 ? (
            <p className="text-sm text-ink-muted py-6 text-center">
              Nenhum aniversário cadastrado. Informe a data de nascimento no cadastro de credores.
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {aniversarios.map(({ pessoa, ocorrencia, dias }) => (
                <li key={pessoa.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <Gift className="w-4 h-4 text-brand" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-primary truncate">
                        {pessoa.nome}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {ocorrencia.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                      dias === 0 ? 'bg-brand text-white' : 'bg-brand/10 text-brand'
                    }`}
                  >
                    {dias === 0 ? '🎉 Hoje!' : rotuloProximidade(dias)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Próximos feriados */}
        <div className="bg-surface rounded-2xl p-6 shadow-soft border border-black/[0.03]">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-4 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-brand" />
            Próximos feriados
          </p>

          <ul className="divide-y divide-black/5">
            {feriados.map((f) => (
              <li key={`${f.nome}-${f.data.getFullYear()}`} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-surface-muted border border-black/5 flex flex-col items-center justify-center shrink-0 leading-none">
                    <span className="text-sm font-bold text-ink-primary">
                      {String(f.data.getDate()).padStart(2, '0')}
                    </span>
                    <span className="text-[9px] uppercase text-ink-muted">
                      {f.data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-ink-primary truncate">{f.nome}</p>
                </div>
                <span className="text-xs font-medium text-ink-muted shrink-0">
                  {rotuloProximidade(f.dias)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

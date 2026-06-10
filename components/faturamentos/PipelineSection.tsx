'use client';

import { useState } from 'react';
import { Check, Clock, AlertTriangle, ChevronRight, ChevronLeft, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type EtapaStatus = 'concluida' | 'em_andamento' | 'inconformidade' | 'pendente';

interface Etapa {
  id: string;
  numero: number;
  nome: string;
  status: EtapaStatus;
  retornos: number;
  inconformidade_motivo?: string | null;
}

interface Props {
  faturamentoId: string;
  etapas: Etapa[];
  isRevisor: boolean;
}

const STATUS_STYLE: Record<EtapaStatus, { ring: string; bg: string; text: string }> = {
  concluida:       { ring: '#2E60FF', bg: '#2E60FF', text: 'white' },
  em_andamento:    { ring: '#00246D', bg: '#00246D', text: 'white' },
  inconformidade:  { ring: '#EF4444', bg: '#EF4444', text: 'white' },
  pendente:        { ring: '#E2E8F0', bg: 'white',   text: '#94A3B8' },
};

export function PipelineSection({ faturamentoId, etapas: etapasInit, isRevisor }: Props) {
  const router = useRouter();
  const [etapas, setEtapas]             = useState<Etapa[]>(etapasInit);
  const [loading, setLoading]           = useState(false);
  const [modalInconf, setModalInconf]   = useState(false);
  const [motivo, setMotivo]             = useState('');
  const [erro, setErro]                 = useState<string | null>(null);

  const atual    = etapas.find(e => e.status === 'em_andamento');
  const proxima  = atual ? etapas.find(e => e.numero === atual.numero + 1) : null;
  const anterior = atual ? etapas.find(e => e.numero === atual.numero - 1) : null;
  const concluido = etapas.every(e => e.status === 'concluida');
  const temInconf = etapas.some(e => e.status === 'inconformidade');
  const inconformidade = etapas.find(e => e.inconformidade_motivo);

  async function chamarAPI(acao: string, extra?: Record<string, string>) {
    setLoading(true);
    setErro(null);
    const res = await fetch(`/api/faturamentos/${faturamentoId}/etapa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, ...extra }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setErro(data.error ?? 'Erro'); return false; }
    router.refresh();
    return true;
  }

  async function avancar() {
    const ok = await chamarAPI('avancar');
    if (ok) {
      // Optimistic UI
      setEtapas(prev => {
        const next = [...prev];
        const ia = next.findIndex(e => e.status === 'em_andamento');
        if (ia !== -1) {
          next[ia] = { ...next[ia], status: 'concluida' };
          if (ia + 1 < next.length) next[ia + 1] = { ...next[ia + 1], status: 'em_andamento' };
        }
        return next;
      });
    }
  }

  async function voltar() {
    const ok = await chamarAPI('voltar');
    if (ok) {
      setEtapas(prev => {
        const next = [...prev];
        const ia = next.findIndex(e => e.status === 'em_andamento');
        if (ia > 0) {
          next[ia] = { ...next[ia], status: 'pendente' };
          next[ia - 1] = { ...next[ia - 1], status: 'em_andamento', retornos: (next[ia - 1].retornos ?? 0) + 1 };
        }
        return next;
      });
    }
  }

  async function registrarInconformidade() {
    if (!motivo.trim()) return;
    const ok = await chamarAPI('inconformidade', { motivo });
    if (ok) {
      setEtapas(prev => {
        const next = [...prev];
        const ia = next.findIndex(e => e.status === 'em_andamento');
        if (ia !== -1) next[ia] = { ...next[ia], status: 'inconformidade', inconformidade_motivo: motivo };
        return next;
      });
      setModalInconf(false);
      setMotivo('');
    }
  }

  return (
    <div className="rounded-xl border bg-white p-6 mb-6" style={{ borderColor: '#E2E8F0' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Pipeline de Etapas</h2>
          {atual && !concluido && (
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              Etapa atual: <span className="font-medium" style={{ color: '#00246D' }}>{atual.nome}</span>
            </p>
          )}
          {concluido && (
            <p className="text-xs mt-0.5 font-medium" style={{ color: '#10B981' }}>✓ Processo concluído</p>
          )}
        </div>

        {/* Ações — apenas revisores */}
        {isRevisor && !concluido && atual && (
          <div className="flex items-center gap-2">
            {/* Voltar */}
            {anterior && (
              <button
                onClick={voltar}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronLeft className="w-3 h-3" />}
                Voltar
              </button>
            )}

            {/* Inconformidade */}
            <button
              onClick={() => setModalInconf(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors"
              style={{ borderColor: '#FCA5A5', color: '#EF4444' }}
            >
              <AlertTriangle className="w-3 h-3" />
              Inconformidade
            </button>

            {/* Avançar */}
            <button
              onClick={avancar}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#00246D', color: 'white' }}
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
              {proxima ? `Avançar para ${proxima.nome}` : 'Concluir'}
            </button>
          </div>
        )}
      </div>

      {/* Círculos de etapa */}
      <div className="flex items-start overflow-x-auto pb-2">
        {etapas.map((etapa, i) => (
          <EtapaCircle key={etapa.id} etapa={etapa} isLast={i === etapas.length - 1} />
        ))}
      </div>

      {/* Erro */}
      {erro && (
        <p className="mt-3 text-xs" style={{ color: '#EF4444' }}>{erro}</p>
      )}

      {/* Inconformidade registrada */}
      {inconformidade && (
        <div className="mt-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: '#FEF2F2' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#EF4444' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#991B1B' }}>Inconformidade registrada:</p>
            <p className="text-xs mt-0.5" style={{ color: '#991B1B' }}>{inconformidade.inconformidade_motivo}</p>
          </div>
        </div>
      )}

      {/* Modal inconformidade */}
      {modalInconf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setModalInconf(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Registrar Inconformidade</h3>
              <button onClick={() => setModalInconf(false)}>
                <X className="w-4 h-4" style={{ color: '#94A3B8' }} />
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: '#64748B' }}>
              Descreva o problema encontrado na etapa <strong>{atual?.nome}</strong>.
            </p>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex: Nota fiscal com CNPJ incorreto..."
              className="w-full text-sm rounded-lg border p-3 resize-none outline-none focus:ring-2"
              style={{ borderColor: '#E2E8F0', color: '#0F172A' }}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setModalInconf(false)}
                className="flex-1 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}
              >
                Cancelar
              </button>
              <button
                onClick={registrarInconformidade}
                disabled={!motivo.trim() || loading}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#EF4444', color: 'white', opacity: !motivo.trim() ? 0.5 : 1 }}
              >
                {loading ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EtapaCircle ────────────────────────────────────────────────────────────────

function EtapaCircle({ etapa, isLast }: { etapa: Etapa; isLast: boolean }) {
  const style = STATUS_STYLE[etapa.status];
  const icon =
    etapa.status === 'concluida'      ? <Check         className="w-3.5 h-3.5 text-white" /> :
    etapa.status === 'em_andamento'   ? <Clock         className="w-3.5 h-3.5 text-white" /> :
    etapa.status === 'inconformidade' ? <AlertTriangle className="w-3.5 h-3.5 text-white" /> :
    null;

  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold"
          style={{ borderColor: style.ring, backgroundColor: style.bg, color: style.text }}
        >
          {etapa.status === 'pendente' ? etapa.numero : icon}
        </div>
        <span
          className="text-xs text-center mt-1.5 max-w-[70px] leading-tight"
          style={{
            color:
              etapa.status === 'em_andamento'   ? '#00246D' :
              etapa.status === 'concluida'       ? '#2E60FF' :
              etapa.status === 'inconformidade'  ? '#EF4444' :
              '#94A3B8',
            fontWeight: etapa.status === 'em_andamento' ? 600 : 400,
          }}
        >
          {etapa.nome}
        </span>
        {(etapa.retornos ?? 0) > 0 && (
          <span className="text-xs mt-0.5 font-medium" style={{ color: '#EF4444' }}>
            ↩ {etapa.retornos}
          </span>
        )}
      </div>
      {!isLast && (
        <div
          className="h-0.5 w-10 mx-1 flex-shrink-0 mb-7"
          style={{ backgroundColor: etapa.status === 'concluida' ? '#2E60FF' : '#E2E8F0' }}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Smartphone, RefreshCw, X, CheckCircle, Wifi, WifiOff, Loader2 } from 'lucide-react';

type Status = 'carregando' | 'nao_configurado' | 'conectando' | 'open' | 'close';

export function WhatsAppConfig() {
  const [status, setStatus]   = useState<Status>('carregando');
  const [number, setNumber]   = useState<string | null>(null);
  const [qrCode, setQrCode]   = useState<string | null>(null);
  const [modal, setModal]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Busca status atual ───────────────────────────────────────────────────────
  async function buscarStatus() {
    const res  = await fetch('/api/whatsapp/instancia');
    const data = await res.json();
    setStatus(data.status ?? 'close');
    setNumber(data.number ?? null);
  }

  useEffect(() => {
    buscarStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Iniciar conexão ──────────────────────────────────────────────────────────
  async function conectar() {
    setLoading(true);
    setErro(null);
    setModal(true);
    setQrCode(null);
    setStatus('conectando');

    try {
      const res  = await fetch('/api/whatsapp/instancia', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao gerar QR code.');
        setStatus('close');
        return;
      }
      if (data.qrCode) setQrCode(data.qrCode);
      iniciarPolling();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar QR code. Tente novamente.');
      setStatus('close');
    } finally {
      setLoading(false);
    }
  }

  // ── Polling de estado ────────────────────────────────────────────────────────
  function iniciarPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res  = await fetch('/api/whatsapp/instancia');
      const data = await res.json();
      if (data.status === 'open') {
        setStatus('open');
        setNumber(data.number ?? null);
        setModal(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
  }

  // ── Atualizar QR code ────────────────────────────────────────────────────────
  async function atualizarQr() {
    setLoading(true);
    setQrCode(null);
    try {
      const res  = await fetch('/api/whatsapp/instancia', { method: 'POST' });
      const data = await res.json();
      if (data.qrCode) setQrCode(data.qrCode);
    } finally {
      setLoading(false);
    }
  }

  // ── Desconectar ──────────────────────────────────────────────────────────────
  async function desconectar() {
    if (!confirm('Deseja desconectar o WhatsApp?')) return;
    setLoading(true);
    await fetch('/api/whatsapp/instancia', { method: 'DELETE' });
    setStatus('nao_configurado');
    setNumber(null);
    setLoading(false);
  }

  // ── Fechar modal ─────────────────────────────────────────────────────────────
  function fecharModal() {
    if (pollRef.current) clearInterval(pollRef.current);
    setModal(false);
    setStatus('close');
    buscarStatus();
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#F0FDF4' }}
          >
            <Smartphone className="w-4 h-4" style={{ color: '#16A34A' }} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#334155' }}>
              Evolution API (WhatsApp)
            </p>
            <StatusLabel status={status} number={number} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'open' && (
            <button
              onClick={desconectar}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: '#E2E8F0', color: '#64748B' }}
            >
              Desconectar
            </button>
          )}

          {(status === 'nao_configurado' || status === 'close') && (
            <button
              onClick={conectar}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
              style={{ backgroundColor: '#16A34A', color: '#fff' }}
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              Conectar WhatsApp
            </button>
          )}

          {status === 'conectando' && (
            <button
              onClick={() => setModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium"
              style={{ borderColor: '#F59E0B', color: '#D97706' }}
            >
              Ver QR Code
            </button>
          )}

          {/* dot de status */}
          <StatusDot status={status} />
        </div>
      </div>

      {/* Modal QR Code */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={fecharModal}
        >
          <div
            className="rounded-2xl bg-white p-8 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-semibold" style={{ color: '#0F172A' }}>
                  Conectar WhatsApp
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  Escaneie o QR code com seu celular
                </p>
              </div>
              <button onClick={fecharModal} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" style={{ color: '#94A3B8' }} />
              </button>
            </div>

            {/* QR Code */}
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#F8FAFC', minHeight: '256px' }}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#94A3B8' }} />
                  <p className="text-xs" style={{ color: '#94A3B8' }}>Gerando QR code...</p>
                </div>
              ) : qrCode ? (
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 object-contain"
                />
              ) : erro ? (
                <p className="text-sm text-center px-4" style={{ color: '#EF4444' }}>{erro}</p>
              ) : (
                <p className="text-sm" style={{ color: '#94A3B8' }}>Aguardando QR code...</p>
              )}
            </div>

            {/* Instruções */}
            <ol className="mt-5 space-y-1.5">
              {[
                'Abra o WhatsApp no seu celular',
                'Toque em Menu ⋮ → Dispositivos conectados',
                'Toque em "Conectar dispositivo"',
                'Aponte a câmera para o QR code',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs" style={{ color: '#64748B' }}>{step}</span>
                </li>
              ))}
            </ol>

            {/* Atualizar QR */}
            {qrCode && !loading && (
              <button
                onClick={atualizarQr}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-colors"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}
              >
                <RefreshCw className="w-3 h-3" />
                Atualizar QR Code
              </button>
            )}

            {/* Aguardando */}
            <div
              className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg"
              style={{ backgroundColor: '#FFFBEB' }}
            >
              <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#D97706' }} />
              <span className="text-xs" style={{ color: '#D97706' }}>
                Aguardando conexão...
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function StatusLabel({ status, number }: { status: Status; number: string | null }) {
  if (status === 'carregando') return (
    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Verificando...</p>
  );
  if (status === 'open') return (
    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#16A34A' }}>
      <Wifi className="w-3 h-3" />
      {number ? `Conectado · ${formatarNumero(number)}` : 'Conectado'}
    </p>
  );
  if (status === 'conectando') return (
    <p className="text-xs mt-0.5" style={{ color: '#D97706' }}>Aguardando QR code...</p>
  );
  return (
    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#94A3B8' }}>
      <WifiOff className="w-3 h-3" />
      Não configurado
    </p>
  );
}

function StatusDot({ status }: { status: Status }) {
  const cores: Record<Status, string> = {
    carregando:      '#94A3B8',
    nao_configurado: '#F59E0B',
    conectando:      '#F59E0B',
    open:            '#10B981',
    close:           '#F59E0B',
  };
  return (
    <div
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: cores[status] }}
    />
  );
}

function formatarNumero(n: string) {
  // Remove @s.whatsapp.net se presente
  return n.replace('@s.whatsapp.net', '').replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
}

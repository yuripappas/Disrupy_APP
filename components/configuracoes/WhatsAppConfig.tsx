'use client';

import { useEffect, useRef, useState } from 'react';
import { Smartphone, RefreshCw, X, CheckCircle, Wifi, WifiOff, Loader2, FlaskConical, AlertTriangle, Send } from 'lucide-react';

type Status = 'carregando' | 'nao_configurado' | 'conectando' | 'open' | 'close';

type DiagResult = {
  estado: string;
  numeroConectado: string | null;
  verificacaoNumero: { number: string; jid: string | null; exists: boolean } | null;
  raw: unknown;
} | null;

type TestResult = {
  destino: string;
  sendOk: boolean;
  sendError: string | null;
  raw: unknown;
} | null;

export function WhatsAppConfig() {
  const [status, setStatus]   = useState<Status>('carregando');
  const [number, setNumber]   = useState<string | null>(null);
  const [qrCode, setQrCode]   = useState<string | null>(null);
  const [modal, setModal]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Diagnóstico ──────────────────────────────────────────────────────────────
  const [showDiag, setShowDiag]   = useState(false);
  const [diagNumero, setDiagNumero] = useState('');
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult]   = useState<DiagResult>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult]   = useState<TestResult>(null);

  // ── Busca estado + QR ────────────────────────────────────────────────────────
  async function buscarEstado() {
    const res  = await fetch('/api/whatsapp/instancia');
    const data = await res.json();
    const st: Status = data.status ?? 'close';
    setStatus(st);
    setNumber(data.number ?? null);
    if (data.qrCode) setQrCode(data.qrCode);
    return st;
  }

  useEffect(() => {
    buscarEstado();
    return () => pararPolling();
  }, []);

  function pararPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function iniciarPolling() {
    pararPolling();
    pollRef.current = setInterval(async () => {
      const st = await buscarEstado();
      if (st === 'open') {
        pararPolling();
        setTimeout(() => setModal(false), 1500);
      }
    }, 2000);
  }

  async function conectar() {
    setLoading(true);
    setErro(null);
    setQrCode(null);
    setModal(true);
    setStatus('conectando');

    const res  = await fetch('/api/whatsapp/instancia', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      setErro(data.error ?? 'Erro ao criar instância.');
      setStatus('close');
      setLoading(false);
      return;
    }

    setLoading(false);
    iniciarPolling();
  }

  async function atualizarQr() {
    setQrCode(null);
    setLoading(true);
    await buscarEstado();
    setLoading(false);
  }

  async function desconectar() {
    if (!confirm('Deseja desconectar o WhatsApp?')) return;
    setLoading(true);
    pararPolling();
    await fetch('/api/whatsapp/instancia', { method: 'DELETE' });
    setStatus('nao_configurado');
    setNumber(null);
    setQrCode(null);
    setLoading(false);
  }

  function fecharModal() {
    pararPolling();
    setModal(false);
    buscarEstado();
  }

  // ── Diagnóstico ──────────────────────────────────────────────────────────────
  async function executarDiagnostico() {
    setDiagLoading(true);
    setDiagResult(null);
    setTestResult(null);
    const params = diagNumero ? `?numero=${encodeURIComponent(diagNumero.replace(/\D/g, ''))}` : '';
    const res = await fetch(`/api/whatsapp/diagnostico${params}`);
    const data = await res.json();
    setDiagResult(data);
    setDiagLoading(false);
  }

  async function enviarTeste() {
    if (!diagNumero) return;
    setTestLoading(true);
    setTestResult(null);
    const res = await fetch('/api/whatsapp/diagnostico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero: diagNumero }),
    });
    const data = await res.json();
    setTestResult(data);
    setTestLoading(false);
  }

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
            <>
              <button
                onClick={() => setShowDiag(v => !v)}
                className="text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors"
                style={{
                  borderColor: showDiag ? '#BFDBFE' : '#E2E8F0',
                  backgroundColor: showDiag ? '#EFF6FF' : 'transparent',
                  color: showDiag ? '#1D4ED8' : '#64748B',
                }}
              >
                <FlaskConical className="w-3 h-3" />
                Diagnóstico
              </button>
              <button
                onClick={desconectar}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}
              >
                Desconectar
              </button>
            </>
          )}

          {(status === 'nao_configurado' || status === 'close') && (
            <button
              onClick={conectar}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
              style={{ backgroundColor: '#16A34A', color: '#fff' }}
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              Conectar WhatsApp
            </button>
          )}

          {status === 'conectando' && (
            <button
              onClick={() => { setModal(true); iniciarPolling(); }}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium"
              style={{ borderColor: '#F59E0B', color: '#D97706' }}
            >
              Ver QR Code
            </button>
          )}

          <StatusDot status={status} />
        </div>
      </div>

      {/* Painel de diagnóstico */}
      {showDiag && (
        <div
          className="mx-5 mb-4 rounded-xl p-4 space-y-3"
          style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
        >
          <p className="text-xs font-semibold" style={{ color: '#334155' }}>
            Diagnóstico da conexão
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Número com DDD (ex: 82999999999)"
              value={diagNumero}
              onChange={e => setDiagNumero(e.target.value)}
              className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: '#CBD5E1', color: '#334155' }}
            />
            <button
              onClick={executarDiagnostico}
              disabled={diagLoading}
              className="text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"
              style={{ backgroundColor: '#1D4ED8', color: '#fff', opacity: diagLoading ? 0.6 : 1 }}
            >
              {diagLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verificar'}
            </button>
            <button
              onClick={enviarTeste}
              disabled={testLoading || !diagNumero}
              className="text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5"
              style={{ backgroundColor: '#16A34A', color: '#fff', opacity: (testLoading || !diagNumero) ? 0.5 : 1 }}
            >
              {testLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Testar envio</>}
            </button>
          </div>

          {/* Resultado do diagnóstico */}
          {diagResult && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 flex-wrap">
                <DiagItem label="Estado" value={diagResult.estado} ok={diagResult.estado === 'open'} />
                <DiagItem
                  label="Número conectado"
                  value={diagResult.numeroConectado
                    ? diagResult.numeroConectado.replace('@s.whatsapp.net', '')
                    : '—'}
                  ok={!!diagResult.numeroConectado}
                />
                {diagResult.verificacaoNumero && (
                  <DiagItem
                    label={`Número ${diagResult.verificacaoNumero.number} no WhatsApp`}
                    value={diagResult.verificacaoNumero.exists ? 'Cadastrado ✓' : 'NÃO encontrado'}
                    ok={diagResult.verificacaoNumero.exists}
                  />
                )}
              </div>

              {diagResult.verificacaoNumero && !diagResult.verificacaoNumero.exists && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Este número <strong>não está cadastrado no WhatsApp</strong>. Mensagens enviadas a ele nunca chegarão, mesmo que a API confirme o envio.
                  </span>
                </div>
              )}

              <details className="text-xs">
                <summary className="cursor-pointer" style={{ color: '#94A3B8' }}>Ver resposta bruta da API</summary>
                <pre
                  className="mt-2 p-3 rounded-lg overflow-auto text-xs"
                  style={{ backgroundColor: '#1E293B', color: '#94A3B8', maxHeight: '200px' }}
                >
                  {JSON.stringify(diagResult.raw, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Resultado do teste de envio */}
          {testResult && (
            <div
              className="px-3 py-2 rounded-lg text-xs space-y-1"
              style={{
                backgroundColor: testResult.sendOk ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${testResult.sendOk ? '#BBF7D0' : '#FECACA'}`,
              }}
            >
              <p className="font-medium" style={{ color: testResult.sendOk ? '#16A34A' : '#DC2626' }}>
                {testResult.sendOk
                  ? `✓ Mensagem enviada para ${testResult.destino}`
                  : `✗ Falha ao enviar para ${testResult.destino}`}
              </p>
              {testResult.sendError && (
                <p style={{ color: '#DC2626' }}>{testResult.sendError}</p>
              )}
              <details>
                <summary className="cursor-pointer" style={{ color: '#94A3B8' }}>Resposta bruta</summary>
                <pre
                  className="mt-1 p-2 rounded overflow-auto"
                  style={{ backgroundColor: '#1E293B', color: '#94A3B8', maxHeight: '160px' }}
                >
                  {JSON.stringify(testResult.raw, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

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
                  <p className="text-xs" style={{ color: '#94A3B8' }}>Criando instância...</p>
                </div>
              ) : qrCode ? (
                <img src={qrCode} alt="QR Code WhatsApp" className="w-56 h-56 object-contain" />
              ) : erro ? (
                <p className="text-sm text-center px-4" style={{ color: '#EF4444' }}>{erro}</p>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#94A3B8' }} />
                  <p className="text-xs" style={{ color: '#94A3B8' }}>Aguardando QR code...</p>
                </div>
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

            {qrCode && status !== 'open' && (
              <button
                onClick={atualizarQr}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-xs"
                style={{ borderColor: '#E2E8F0', color: '#64748B' }}
              >
                <RefreshCw className="w-3 h-3" />
                Atualizar QR Code
              </button>
            )}

            {status === 'open' ? (
              <div
                className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg"
                style={{ backgroundColor: '#F0FDF4' }}
              >
                <CheckCircle className="w-3 h-3" style={{ color: '#16A34A' }} />
                <span className="text-xs font-medium" style={{ color: '#16A34A' }}>
                  WhatsApp conectado com sucesso!
                </span>
              </div>
            ) : (
              <div
                className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg"
                style={{ backgroundColor: '#FFFBEB' }}
              >
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#D97706' }} />
                <span className="text-xs" style={{ color: '#D97706' }}>
                  Aguardando conexão...
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DiagItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
      <span className="text-xs font-medium" style={{ color: ok ? '#16A34A' : '#DC2626' }}>{value}</span>
    </div>
  );
}

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
  return <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cores[status] }} />;
}

function formatarNumero(n: string) {
  return n.replace('@s.whatsapp.net', '').replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
}

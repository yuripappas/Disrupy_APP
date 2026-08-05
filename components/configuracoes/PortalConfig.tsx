'use client';

import { useState } from 'react';
import { PlayCircle, Check, Loader2, ExternalLink } from 'lucide-react';

function extrairYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    return null;
  } catch {
    return null;
  }
}

export function PortalConfig({ videoUrlInicial }: { videoUrlInicial: string }) {
  const [url, setUrl]       = useState(videoUrlInicial);
  const [salvo, setSalvo]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]     = useState<string | null>(null);

  const videoId = extrairYoutubeId(url);

  async function salvar() {
    setLoading(true);
    setErro(null);
    const res = await fetch('/api/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave: 'portal_video_url', valor: url }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setErro(data.error ?? 'Erro ao salvar'); return; }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  }

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: '#FEF3C7' }}
        >
          <PlayCircle className="w-4 h-4" style={{ color: '#D97706' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: '#334155' }}>
            Vídeo de instruções no portal
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            Cole o link do YouTube. Aparece no portal do fornecedor como "Está com dúvida? Assista o vídeo".
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={e => { setUrl(e.target.value); setSalvo(false); setErro(null); }}
          className="flex-1 text-xs px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: '#CBD5E1', color: '#334155' }}
        />
        <button
          onClick={salvar}
          disabled={loading}
          className="text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 flex-shrink-0"
          style={{
            backgroundColor: salvo ? '#059669' : '#2E60FF',
            color: '#fff',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : salvo ? <Check className="w-3 h-3" /> : null}
          {loading ? '' : salvo ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {erro && <p className="text-xs" style={{ color: '#DC2626' }}>{erro}</p>}

      {/* Preview do vídeo */}
      {videoId && (
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: '#E2E8F0' }}>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="Preview do vídeo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: '#F8FAFC' }}>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Preview — é assim que o fornecedor vai ver</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs"
              style={{ color: '#2E60FF' }}
            >
              <ExternalLink className="w-3 h-3" />
              Abrir no YouTube
            </a>
          </div>
        </div>
      )}

      {url && !videoId && (
        <p className="text-xs" style={{ color: '#F59E0B' }}>
          URL não reconhecida como YouTube. Use o formato youtube.com/watch?v=... ou youtu.be/...
        </p>
      )}
    </div>
  );
}

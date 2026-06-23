"use client";

import { useState } from "react";
import {
  RefreshCw, AlertTriangle, CheckCircle, Clock,
  Upload, Loader2, ExternalLink, X, FileText,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

type Certidao = {
  id: string;
  tipo: string;
  label: string;
  validade: string;
  arquivo_url: string | null;
  nome_arquivo: string | null;
  tamanho_bytes: number | null;
};

type Status = "valida" | "vencendo" | "vencida";

function calcStatus(validade: string): Status {
  const dias = Math.ceil((new Date(validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return "vencida";
  if (dias <= 15) return "vencendo";
  return "valida";
}

function diasRestantes(validade: string): number {
  return Math.ceil((new Date(validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const VALIDADE_PADRAO: Record<string, number> = {
  federal: 180, fgts: 30, trabalhista: 180,
  estadual: 90, municipal: 90, falencia: 90,
};

function defaultValidade(tipo: string): string {
  const dias = VALIDADE_PADRAO[tipo] ?? 90;
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

const STATUS_CFG = {
  valida:   { label: "Válida",            icon: <CheckCircle    className="w-5 h-5" style={{ color: "#059669" }} />, color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", textColor: "#064E3B" },
  vencendo: { label: "Vencendo em breve", icon: <Clock          className="w-5 h-5" style={{ color: "#D97706" }} />, color: "#D97706", bg: "#FFFBEB", border: "#FCD34D", textColor: "#78350F" },
  vencida:  { label: "Vencida",           icon: <AlertTriangle  className="w-5 h-5" style={{ color: "#DC2626" }} />, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", textColor: "#7F1D1D" },
};

// ── RenovarForm ───────────────────────────────────────────────────────────────

function RenovarForm({
  certidao,
  onSalva,
  onCancelar,
}: {
  certidao: Certidao;
  onSalva: (updated: Certidao) => void;
  onCancelar: () => void;
}) {
  const [validade, setValidade]   = useState(defaultValidade(certidao.tipo));
  const [arquivo,  setArquivo]    = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro]           = useState<string | null>(null);

  async function handleSalvar() {
    if (!arquivo) { setErro("Selecione o arquivo da certidão."); return; }
    setUploading(true);
    setErro(null);

    try {
      const form = new FormData();
      form.append("file",     arquivo);
      form.append("id",       certidao.id);
      form.append("validade", validade);

      const res = await fetch("/api/certidoes-globais", { method: "POST", body: form });

      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Erro no upload"); }
      const { certidao: updated } = await res.json() as { certidao: Certidao };
      onSalva(updated);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border p-4 space-y-3" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
      {/* Validade */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#334155" }}>
          Nova validade
        </label>
        <input
          type="date"
          value={validade}
          onChange={(e) => setValidade(e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-lg border outline-none focus:ring-2"
          style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
        />
      </div>

      {/* Arquivo */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "#334155" }}>
          Arquivo (PDF, JPG ou PNG)
        </label>
        <input
          id={`renovar-input-${certidao.id}`}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setErro(null); }}
        />
        <label
          htmlFor={`renovar-input-${certidao.id}`}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors"
          style={{
            borderColor:     arquivo ? "#BBF7D0" : "#CBD5E1",
            backgroundColor: arquivo ? "#F0FDF4" : "white",
          }}
        >
          <FileText className="w-4 h-4 flex-shrink-0" style={{ color: arquivo ? "#059669" : "#94A3B8" }} />
          <span className="text-xs truncate flex-1" style={{ color: arquivo ? "#15803D" : "#94A3B8" }}>
            {arquivo ? arquivo.name : "Clique para selecionar"}
          </span>
          {arquivo && (
            <button type="button" onClick={(e) => { e.preventDefault(); setArquivo(null); }}
              className="p-0.5 rounded hover:bg-red-50 flex-shrink-0">
              <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
            </button>
          )}
        </label>
      </div>

      {erro && <p className="text-xs" style={{ color: "#DC2626" }}>{erro}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSalvar}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
          style={{ backgroundColor: "#2E60FF", opacity: uploading ? 0.7 : 1 }}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Enviando…" : "Salvar"}
        </button>
        <button
          onClick={onCancelar}
          disabled={uploading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── CerticoesClient ───────────────────────────────────────────────────────────

export function CerticoesClient({ certidoesIniciais }: { certidoesIniciais: Certidao[] }) {
  const [certidoes, setCertidoes] = useState<Certidao[]>(certidoesIniciais);
  const [renovando, setRenovando] = useState<string | null>(null);

  const comStatus = certidoes.map((c) => ({ ...c, status: calcStatus(c.validade) }));
  const validas   = comStatus.filter((c) => c.status === "valida").length;
  const vencendo  = comStatus.filter((c) => c.status === "vencendo").length;
  const vencidas  = comStatus.filter((c) => c.status === "vencida").length;

  function handleSalva(updated: Certidao) {
    setCertidoes((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setRenovando(null);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Certidões Negativas</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {validas} válidas · {vencendo} vencendo · {vencidas} vencida(s)
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}>
          <CheckCircle className="w-3.5 h-3.5" />
          Arquivos anexados aqui ficam disponíveis em todos os faturamentos
        </div>
      </div>

      {(vencidas > 0 || vencendo > 0) && (
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>Atenção: certidões com situação irregular</p>
            <p className="text-sm mt-0.5" style={{ color: "#B91C1C" }}>
              {vencidas > 0 && `${vencidas} certidão(ões) vencida(s). `}
              {vencendo > 0 && `${vencendo} certidão(ões) vencendo em breve. `}
              Certidões irregulares bloqueiam o envio do processo ao cliente.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {comStatus.map((cert) => {
          const cfg         = STATUS_CFG[cert.status];
          const dias        = diasRestantes(cert.validade);
          const estaRenov   = renovando === cert.id;

          return (
            <div key={cert.id} className="rounded-xl border bg-white p-6" style={{ borderColor: cfg.border }}>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                    {cfg.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: "#0F172A" }}>{cert.label}</h3>
                    <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "#94A3B8" }}>Validade</p>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{formatDate(cert.validade)}</p>
                </div>
              </div>

              {/* Arquivo anexado */}
              {cert.arquivo_url ? (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#059669" }} />
                  <span className="text-xs truncate flex-1" style={{ color: "#15803D" }}>
                    {cert.nome_arquivo ?? "Arquivo anexado"}
                  </span>
                  <a href={cert.arquivo_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs font-medium flex-shrink-0 hover:underline"
                    style={{ color: "#2E60FF" }}>
                    <ExternalLink className="w-3 h-3" /> Abrir
                  </a>
                </div>
              ) : (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FCD34D" }}>
                  <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D97706" }} />
                  <span className="text-xs" style={{ color: "#92400E" }}>Nenhum arquivo anexado — clique em Renovar para adicionar</span>
                </div>
              )}

              {/* Status bar */}
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: cfg.bg }}>
                <span className="text-xs font-medium" style={{ color: cfg.textColor }}>
                  {cert.status === "vencida"
                    ? `Vencida há ${Math.abs(dias)} dia(s)`
                    : cert.status === "vencendo"
                    ? `Vence em ${dias} dia(s)`
                    : `Válida por mais ${dias} dia(s)`}
                </span>
                {estaRenov ? (
                  <button onClick={() => setRenovando(null)}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md"
                    style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}>
                    <X className="w-3 h-3" /> Cancelar
                  </button>
                ) : (
                  <button onClick={() => setRenovando(cert.id)}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md text-white"
                    style={{ backgroundColor: cfg.color }}>
                    <RefreshCw className="w-3 h-3" />
                    {cert.arquivo_url ? "Renovar" : "Anexar"}
                  </button>
                )}
              </div>

              {/* Inline form */}
              {estaRenov && (
                <RenovarForm
                  certidao={cert}
                  onSalva={handleSalva}
                  onCancelar={() => setRenovando(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Prazos padrão */}
      <div className="mt-6 rounded-xl border p-5" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#334155" }}>Prazos de Validade Padrão</h3>
        <div className="grid grid-cols-3 gap-4 text-xs" style={{ color: "#64748B" }}>
          <div><strong style={{ color: "#334155" }}>Federal (Receita + PGFN)</strong><br />180 dias</div>
          <div><strong style={{ color: "#334155" }}>FGTS (Caixa)</strong><br />30 dias</div>
          <div><strong style={{ color: "#334155" }}>Trabalhista (TST)</strong><br />180 dias</div>
          <div><strong style={{ color: "#334155" }}>Estadual (SEFAZ-AL)</strong><br />Variável</div>
          <div><strong style={{ color: "#334155" }}>Municipal (SEMFAZ Maceió)</strong><br />Variável</div>
          <div><strong style={{ color: "#334155" }}>Falência/Concordata (TJAL)</strong><br />Variável</div>
        </div>
      </div>
    </div>
  );
}

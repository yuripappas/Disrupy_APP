"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  FileText, Upload, CheckCircle, Clock, XCircle,
  ExternalLink, Loader2, AlertTriangle, RefreshCw,
} from "lucide-react";

const clienteTipoLabel: Record<string, string> = {
  governo_al: "Governo de Alagoas",
  sebrae: "SEBRAE",
  prefeitura: "Prefeitura",
  brk: "BRK",
  outro: "Outro",
};

const docStatusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pendente:  { label: "Pendente",  color: "#94A3B8", bg: "#F1F5F9",
    icon: <Clock className="w-3.5 h-3.5" /> },
  enviado:   { label: "Enviado",   color: "#D97706", bg: "#FFFBEB",
    icon: <Clock className="w-3.5 h-3.5" /> },
  aprovado:  { label: "Aprovado",  color: "#059669", bg: "#ECFDF5",
    icon: <CheckCircle className="w-3.5 h-3.5" /> },
  rejeitado: { label: "Rejeitado", color: "#DC2626", bg: "#FEF2F2",
    icon: <XCircle className="w-3.5 h-3.5" /> },
};

type Documento = {
  id: string;
  tipo: string;
  label: string;
  status: string;
  arquivo_url: string | null;
};

type FF = {
  id: string;
  status: string;
  prazo_dias: number;
  valor_total: number;
  fornecedor: { razao_social: string; cnpj: string | null; tipo: string; contato_nome: string | null };
  faturamento: { nome_campanha: string; cliente_nome: string; cliente_tipo: string };
  documentos: Documento[];
};

function DocRow({
  doc,
  ffId,
  onUploaded,
}: {
  doc: Documento;
  ffId: string;
  onUploaded: (docId: string, url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cfg = docStatusConfig[doc.status] ?? docStatusConfig.pendente;

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError("Arquivo muito grande. Máximo: 15 MB.");
      return;
    }

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${ffId}/${doc.tipo}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("documentos")
      .upload(path, file, { upsert: true });

    if (upErr) {
      setError("Erro ao enviar arquivo. Tente novamente.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("documentos")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    const { error: dbErr } = await supabase
      .from("documentos")
      .update({ status: "enviado", arquivo_url: publicUrl })
      .eq("id", doc.id);

    if (dbErr) {
      setError("Arquivo enviado mas erro ao salvar. Tente novamente.");
      setUploading(false);
      return;
    }

    onUploaded(doc.id, publicUrl);
    setUploading(false);
  }

  return (
    <div className="p-4 rounded-xl border bg-white" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: cfg.bg }}
          >
            <FileText className="w-4 h-4" style={{ color: cfg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: "#0F172A" }}>{doc.label}</p>
            {doc.arquivo_url && (
              <a
                href={doc.arquivo_url}
                target="_blank"
                className="flex items-center gap-1 text-xs mt-0.5 hover:underline"
                style={{ color: "#2E60FF" }}
              >
                <ExternalLink className="w-3 h-3" /> Ver arquivo enviado
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
          >
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>

      {doc.status !== "aprovado" && (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 w-full justify-center py-2.5 rounded-lg border-2 border-dashed text-sm font-medium transition-colors"
            style={{
              borderColor: uploading ? "#CBD5E1" : "#2E60FF",
              color: uploading ? "#94A3B8" : "#2E60FF",
              backgroundColor: uploading ? "#F8FAFC" : "#EEF2FF",
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : doc.arquivo_url ? (
              <><RefreshCw className="w-4 h-4" /> Substituir arquivo</>
            ) : (
              <><Upload className="w-4 h-4" /> Selecionar arquivo (PDF, JPG, PNG)</>
            )}
          </button>
          {error && (
            <p className="mt-2 text-xs flex items-center gap-1" style={{ color: "#DC2626" }}>
              <AlertTriangle className="w-3 h-3" /> {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PortalClient({ ff, token }: { ff: FF; token: string }) {
  const [docs, setDocs] = useState<Documento[]>(ff.documentos);

  function handleUploaded(docId: string, url: string) {
    setDocs((prev) =>
      prev.map((d) => d.id === docId ? { ...d, status: "enviado", arquivo_url: url } : d)
    );
  }

  const enviados = docs.filter((d) => d.status === "enviado" || d.status === "aprovado").length;
  const aprovados = docs.filter((d) => d.status === "aprovado").length;
  const total = docs.length;
  const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;

  const allDone = enviados === total;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#00246D" }}>
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
            style={{ backgroundColor: "#2E60FF", color: "white" }}
          >
            D
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: "#93C5FD" }}>Disrupy Comunicação</p>
            <p className="text-sm font-bold text-white">Portal de Documentos</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Campaign card */}
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>
            {clienteTipoLabel[ff.faturamento.cliente_tipo] ?? ff.faturamento.cliente_tipo}
          </p>
          <h1 className="text-base font-bold" style={{ color: "#0F172A" }}>{ff.faturamento.nome_campanha}</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>{ff.faturamento.cliente_nome}</p>
        </div>

        {/* Supplier card */}
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: ff.fornecedor.tipo === "midia" ? "#00246D" : "#7C3AED" }}
            >
              {ff.fornecedor.tipo === "midia" ? "MÍD" : "PRD"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>{ff.fornecedor.razao_social}</p>
              {ff.fornecedor.cnpj && (
                <p className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>{ff.fornecedor.cnpj}</p>
              )}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: allDone ? "#BBF7D0" : "#E2E8F0", backgroundColor: allDone ? "#F0FDF4" : "white" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold" style={{ color: allDone ? "#059669" : "#0F172A" }}>
              {allDone ? "✓ Todos os documentos enviados!" : "Documentos necessários"}
            </p>
            <span className="text-xs font-medium" style={{ color: "#64748B" }}>
              {enviados}/{total} enviados
              {aprovados > 0 && ` · ${aprovados} aprovados`}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#059669" : "#2E60FF" }}
            />
          </div>
          {!allDone && (
            <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>
              Envie os documentos abaixo. Após análise, nossa equipe entrará em contato.
            </p>
          )}
        </div>

        {/* Documents */}
        <div className="space-y-3">
          {docs
            .sort((a, b) => {
              const order = { rejeitado: 0, pendente: 1, enviado: 2, aprovado: 3 };
              return (order[a.status as keyof typeof order] ?? 1) - (order[b.status as keyof typeof order] ?? 1);
            })
            .map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                ffId={ff.id}
                onUploaded={handleUploaded}
              />
            ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs pb-6" style={{ color: "#CBD5E1" }}>
          Dúvidas? Entre em contato com a Disrupy Comunicação.
          <br />
          <span className="font-mono" style={{ fontSize: "10px" }}>ref: {token.slice(0, 8)}...</span>
        </p>
      </div>
    </div>
  );
}

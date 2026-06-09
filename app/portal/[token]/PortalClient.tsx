"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileText, Upload, CheckCircle, Clock, XCircle,
  ExternalLink, Loader2, AlertTriangle, MessageSquare, X,
  Film, Image, Archive,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const clienteTipoLabel: Record<string, string> = {
  governo_al: "Governo de Alagoas",
  sebrae:     "SEBRAE",
  prefeitura: "Prefeitura",
  brk:        "BRK",
  outro:      "Outro",
};

const docStatusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pendente:  { label: "Pendente",  color: "#94A3B8", bg: "#F1F5F9", icon: <Clock   className="w-3.5 h-3.5" /> },
  enviado:   { label: "Enviado",   color: "#D97706", bg: "#FFFBEB", icon: <Clock   className="w-3.5 h-3.5" /> },
  aprovado:  { label: "Aprovado",  color: "#059669", bg: "#ECFDF5", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  reprovado: { label: "Reprovado", color: "#DC2626", bg: "#FEF2F2", icon: <XCircle className="w-3.5 h-3.5" /> },
};

function formatBytes(b: number): string {
  if (b < 1024)          return `${b} B`;
  if (b < 1024 * 1024)   return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext))
    return <Film    className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7C3AED" }} />;
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return <Image   className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#059669" }} />;
  if (["zip", "rar", "7z"].includes(ext))
    return <Archive className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D97706" }} />;
  return   <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#64748B" }} />;
}

/**
 * Converte um File em string base64 (sem o prefixo "data:...;base64,").
 * Executado inteiramente no browser — sem limite de tamanho do servidor.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // remove "data:<mime>;base64,"
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Prefixos por tipo de documento ───────────────────────────────────────────

const PREFIXOS: Record<string, string> = {
  nf:               "NF",
  pi:               "PI",
  evidencia:        "EV",
  comprovacao:      "CV",
  orcamento_1:      "OC",
  orcamento_2:      "OC",
  orcamento_3:      "OC",
  tabela_orcamento: "OC",
  espelho:          "ES",
  proposta:         "OS",
};

/**
 * Aplica prefixo ao nome do arquivo baseado no tipo do documento.
 * - 1 arquivo total  → "NF_251(1).pdf"
 * - 2+ arquivos      → "NF1_arquivo.pdf", "NF2_arquivo.pdf"...
 *
 * @param nomeOriginal  nome original do arquivo
 * @param tipo          tipo do documento (ex: "nf", "evidencia")
 * @param indice        posição 1-based deste arquivo no total
 * @param total         total de arquivos (existentes + novos)
 */
function aplicarPrefixo(nomeOriginal: string, tipo: string, indice: number, total: number): string {
  const prefixo = PREFIXOS[tipo] ?? tipo.replace(/_/g, "").toUpperCase().slice(0, 4);
  const numero  = total > 1 ? String(indice) : "";
  return `${prefixo}${numero}_${nomeOriginal}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Arquivo = {
  id: string;
  arquivo_url: string;
  nome_arquivo: string;
  tamanho_bytes: number | null;
  created_at: string;
};

type StagedFile = {
  localId: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
};

type Documento = {
  id: string;
  tipo: string;
  label: string;
  status: string;
  arquivo_url: string | null;
  reprovacao_motivo: string | null;
  documento_arquivos: Arquivo[];
};

type FaturamentoInfo = {
  nome_campanha: string;
  cliente_nome: string;
  cliente_tipo: string;
  iclips_job_id: string | null;
  created_at: string;
};

type FF = {
  id: string;
  status: string;
  prazo_dias: number;
  valor_total: number;
  fornecedor: { razao_social: string; cnpj: string | null; tipo: string; contato_nome: string | null };
  faturamento: FaturamentoInfo;
  documentos: Documento[];
};

// ── DocRow ────────────────────────────────────────────────────────────────────

function DocRow({
  doc,
  ffId,
  faturamento,
  fornecedorTipo,
  fornecedorNome,
  token,
  onUploaded,
}: {
  doc: Documento;
  ffId: string;
  faturamento: FaturamentoInfo;
  fornecedorTipo: string;
  fornecedorNome: string;
  token: string;
  onUploaded: (docId: string, arquivos: Arquivo[]) => void;
}) {
  const inputRef      = useRef<HTMLInputElement>(null);
  const [staged,      setStaged]      = useState<StagedFile[]>([]);
  const [dragging,    setDragging]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const cfg           = docStatusConfig[doc.status] ?? docStatusConfig.pendente;
  const existingFiles = doc.documento_arquivos ?? [];
  const canUpload     = doc.status !== "aprovado";
  const pendingStaged = staged.filter((f) => f.status === "pending");

  function addFiles(fileList: FileList | File[]) {
    setGlobalError(null);
    setStaged((prev) => [
      ...prev,
      ...Array.from(fileList).map((f) => ({
        localId: Math.random().toString(36).slice(2),
        file:    f,
        status:  "pending" as const,
      })),
    ]);
  }

  function removeStaged(localId: string) {
    setStaged((prev) => prev.filter((f) => f.localId !== localId));
  }

  const handleUploadAll = useCallback(async () => {
    const toUpload = staged.filter((f) => f.status === "pending");
    if (toUpload.length === 0) return;

    setUploading(true);
    setGlobalError(null);

    const scriptUrl = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
    if (!scriptUrl) {
      setGlobalError("Serviço de upload não configurado. Contacte a Disrupy.");
      setUploading(false);
      return;
    }

    // Subpasta no Drive depende do tipo do fornecedor
    const subpasta =
      fornecedorTipo === "midia"    ? "PI"        :
      fornecedorTipo === "producao" ? "OS"        :
                                      "CUSTO INTERNO";

    const ano = new Date(faturamento.created_at).getFullYear();

    const uploaded: Arquivo[] = [];
    const totalArquivos = existingFiles.length + toUpload.length;

    for (const [i, sf] of toUpload.entries()) {
      // Marca como "enviando"
      setStaged((prev) =>
        prev.map((f) => f.localId === sf.localId ? { ...f, status: "uploading" } : f)
      );

      try {
        // ── 1. Converte arquivo para base64 (no browser, sem limite) ──────────
        const fileContent = await fileToBase64(sf.file);

        // ── 2. Aplica prefixo ao nome (ex: NF_251.pdf, EV1_video.mp4) ─────────
        const indice      = existingFiles.length + i + 1;
        const nomeArquivo = aplicarPrefixo(sf.file.name, doc.tipo, indice, totalArquivos);

        // ── 3. Envia direto para Google Drive via Apps Script ─────────────────
        //      Content-Type: text/plain evita preflight CORS.
        const driveRes = await fetch(scriptUrl, {
          method:  "POST",
          headers: { "Content-Type": "text/plain" },
          body:    JSON.stringify({
            fileName:    nomeArquivo,
            fileContent,
            mimeType:    sf.file.type || "application/octet-stream",
            ano,
            clienteGrupo:   faturamento.cliente_tipo === "governo_al" ? "GOVERNO DE ALAGOAS" : "",
            clienteNome:    faturamento.cliente_nome  ?? "SEM_CLIENTE",
            jobId:          faturamento.iclips_job_id ?? `FF-${ffId.slice(0, 6)}`,
            campanha:       faturamento.nome_campanha  ?? "SEM_NOME",
            subpasta,
            fornecedorNome: fornecedorNome,
          }),
        });

        if (!driveRes.ok) {
          throw new Error(`Falha no servidor de upload (HTTP ${driveRes.status})`);
        }

        const driveData = await driveRes.json() as {
          ok: boolean;
          viewUrl?: string;
          fileId?:  string;
          pasta?:   string;
          error?:   string;
        };

        if (!driveData.ok || !driveData.viewUrl) {
          throw new Error(driveData.error ?? "Apps Script não retornou URL do arquivo");
        }

        // ── 3. Persiste referência no banco (server-side, via portal token) ───
        const saveRes = await fetch("/api/drive/salvar-arquivo", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            documentoId: doc.id,
            viewUrl:     driveData.viewUrl,
            fileName:    nomeArquivo,
            fileSize:    sf.file.size,
            token,        // token do portal para autenticação server-side
          }),
        });

        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? "Erro ao registrar arquivo no banco");
        }

        const { arquivo } = await saveRes.json() as { arquivo: Arquivo };
        uploaded.push(arquivo);

        setStaged((prev) =>
          prev.map((f) => f.localId === sf.localId ? { ...f, status: "done" } : f)
        );

      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha no envio";
        setStaged((prev) =>
          prev.map((f) =>
            f.localId === sf.localId
              ? { ...f, status: "error", errorMsg: msg }
              : f
          )
        );
      }
    }

    if (uploaded.length > 0) {
      onUploaded(doc.id, uploaded);
    }

    // Remove os enviados com sucesso da staging area após 800ms
    setTimeout(() => {
      setStaged((prev) => prev.filter((f) => f.status === "error"));
    }, 800);

    setUploading(false);
  }, [staged, ffId, doc.id, faturamento, fornecedorTipo, fornecedorNome, token, onUploaded]);

  return (
    <div
      className="p-4 rounded-xl border bg-white"
      style={{ borderColor: doc.status === "reprovado" ? "#FCA5A5" : "#E2E8F0" }}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: cfg.bg }}
          >
            <FileText className="w-4 h-4" style={{ color: cfg.color }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{doc.label}</p>
            {existingFiles.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                {existingFiles.length} arquivo{existingFiles.length > 1 ? "s" : ""} enviado{existingFiles.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <span
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.icon} {cfg.label}
        </span>
      </div>

      {/* Motivo de reprovação */}
      {doc.status === "reprovado" && doc.reprovacao_motivo && (
        <div
          className="mt-3 px-3 py-2.5 rounded-lg flex items-start gap-2"
          style={{ backgroundColor: "#FEF2F2" }}
        >
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: "#991B1B" }}>Motivo da reprovação:</p>
            <p className="text-xs" style={{ color: "#991B1B" }}>{doc.reprovacao_motivo}</p>
          </div>
        </div>
      )}

      {/* Arquivos já enviados */}
      {existingFiles.length > 0 && (
        <div className="mt-3 rounded-lg overflow-hidden border" style={{ borderColor: "#E2E8F0" }}>
          {existingFiles.map((arq, i) => (
            <div
              key={arq.id}
              className="flex items-center gap-2.5 px-3 py-2.5"
              style={{
                borderTop:       i > 0 ? "1px solid #F1F5F9" : undefined,
                backgroundColor: "#F8FAFC",
              }}
            >
              {fileIcon(arq.nome_arquivo)}
              <span className="text-xs truncate flex-1" style={{ color: "#334155" }}>
                {arq.nome_arquivo}
              </span>
              {arq.tamanho_bytes != null && (
                <span className="text-xs flex-shrink-0" style={{ color: "#94A3B8" }}>
                  {formatBytes(arq.tamanho_bytes)}
                </span>
              )}
              <a
                href={arq.arquivo_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-medium flex-shrink-0 hover:underline"
                style={{ color: "#2E60FF" }}
              >
                <ExternalLink className="w-3 h-3" /> Abrir
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Área de upload */}
      {canUpload && (
        <div className="mt-3 space-y-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
            onClick={() => !uploading && inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-lg border-2 border-dashed transition-colors"
            style={{
              borderColor:     dragging ? "#2E60FF" : "#CBD5E1",
              backgroundColor: dragging ? "#EEF2FF" : "#F8FAFC",
              cursor:          uploading ? "not-allowed" : "pointer",
            }}
          >
            <Upload className="w-5 h-5" style={{ color: dragging ? "#2E60FF" : "#94A3B8" }} />
            <p className="text-xs font-medium" style={{ color: dragging ? "#2E60FF" : "#64748B" }}>
              {existingFiles.length > 0
                ? "Adicionar mais arquivos"
                : "Arraste os arquivos ou clique para selecionar"}
            </p>
            <p className="text-xs" style={{ color: "#CBD5E1" }}>
              Qualquer formato — PDF, vídeo, imagem, ZIP e outros
            </p>
          </div>

          {/* Fila de staging */}
          {staged.length > 0 && (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
              {staged.map((sf, i) => (
                <div
                  key={sf.localId}
                  className="flex items-center gap-2.5 px-3 py-2.5"
                  style={{
                    borderTop:       i > 0 ? "1px solid #F1F5F9" : undefined,
                    backgroundColor:
                      sf.status === "error"     ? "#FEF2F2" :
                      sf.status === "done"      ? "#F0FDF4" :
                      sf.status === "uploading" ? "#EEF2FF" :
                      "#FAFAFA",
                  }}
                >
                  {sf.status === "uploading" ? (
                    <Loader2      className="w-3.5 h-3.5 flex-shrink-0 animate-spin" style={{ color: "#2E60FF" }} />
                  ) : sf.status === "done" ? (
                    <CheckCircle  className="w-3.5 h-3.5 flex-shrink-0"              style={{ color: "#059669" }} />
                  ) : sf.status === "error" ? (
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0"             style={{ color: "#DC2626" }} />
                  ) : (
                    fileIcon(sf.file.name)
                  )}
                  <span
                    className="text-xs truncate flex-1"
                    style={{ color: sf.status === "error" ? "#991B1B" : "#334155" }}
                  >
                    {sf.file.name}
                    {sf.errorMsg && (
                      <span style={{ color: "#DC2626" }}> · {sf.errorMsg}</span>
                    )}
                  </span>
                  <span className="text-xs flex-shrink-0" style={{ color: "#94A3B8" }}>
                    {formatBytes(sf.file.size)}
                  </span>
                  {sf.status === "pending" && !uploading && (
                    <button
                      type="button"
                      onClick={() => removeStaged(sf.localId)}
                      className="p-0.5 rounded hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Botão enviar */}
          {pendingStaged.length > 0 && !uploading && (
            <button
              onClick={handleUploadAll}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#2E60FF" }}
            >
              <Upload className="w-4 h-4" />
              Enviar {pendingStaged.length} arquivo{pendingStaged.length > 1 ? "s" : ""}
            </button>
          )}

          {uploading && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs" style={{ color: "#64748B" }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#2E60FF" }} />
              Enviando para o Google Drive, aguarde…
            </div>
          )}

          {globalError && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#DC2626" }}>
              <AlertTriangle className="w-3 h-3" /> {globalError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── PortalClient ──────────────────────────────────────────────────────────────

export function PortalClient({ ff, token }: { ff: FF; token: string }) {
  const [docs, setDocs] = useState<Documento[]>(
    ff.documentos.map((d) => ({
      ...d,
      documento_arquivos: d.documento_arquivos ?? [],
    }))
  );

  const handleUploaded = useCallback((docId: string, arquivos: Arquivo[]) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id !== docId
          ? d
          : {
              ...d,
              status:             "enviado",
              arquivo_url:        arquivos[0]?.arquivo_url ?? d.arquivo_url,
              documento_arquivos: [...(d.documento_arquivos ?? []), ...arquivos],
            }
      )
    );
  }, []);

  const enviados  = docs.filter((d) => d.status === "enviado"  || d.status === "aprovado").length;
  const aprovados = docs.filter((d) => d.status === "aprovado").length;
  const total     = docs.length;
  const pct       = total > 0 ? Math.round((enviados / total) * 100) : 0;
  const allDone   = enviados === total && total > 0;

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

        {/* Campanha */}
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>
            {clienteTipoLabel[ff.faturamento.cliente_tipo] ?? ff.faturamento.cliente_tipo}
          </p>
          <h1 className="text-base font-bold"  style={{ color: "#0F172A" }}>{ff.faturamento.nome_campanha}</h1>
          <p className="text-sm mt-0.5"         style={{ color: "#64748B" }}>{ff.faturamento.cliente_nome}</p>
        </div>

        {/* Fornecedor */}
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: ff.fornecedor.tipo === "midia" ? "#00246D" : "#7C3AED" }}
            >
              {ff.fornecedor.tipo === "midia" ? "MÍD" : "PRD"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "#0F172A" }}>
                {ff.fornecedor.razao_social}
              </p>
              {ff.fornecedor.cnpj && (
                <p className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>
                  {ff.fornecedor.cnpj}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progresso */}
        <div
          className="rounded-xl border bg-white p-4"
          style={{ borderColor: allDone ? "#BBF7D0" : "#E2E8F0", backgroundColor: allDone ? "#F0FDF4" : "white" }}
        >
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
              Envie os documentos abaixo. Você pode enviar vários arquivos por item —
              PDF, vídeos, imagens e qualquer outro formato são aceitos.
            </p>
          )}
        </div>

        {/* Documentos */}
        <div className="space-y-3">
          {docs
            .sort((a, b) => {
              const order = { reprovado: 0, pendente: 1, enviado: 2, aprovado: 3 };
              return (order[a.status as keyof typeof order] ?? 1) - (order[b.status as keyof typeof order] ?? 1);
            })
            .map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                ffId={ff.id}
                faturamento={ff.faturamento}
                fornecedorTipo={ff.fornecedor.tipo}
                fornecedorNome={ff.fornecedor.razao_social}
                token={token}
                onUploaded={handleUploaded}
              />
            ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs pb-6" style={{ color: "#CBD5E1" }}>
          Dúvidas? Entre em contato com a Disrupy Comunicação.
          <br />
          <span className="font-mono" style={{ fontSize: "10px" }}>ref: {token.slice(0, 8)}…</span>
        </p>
      </div>
    </div>
  );
}

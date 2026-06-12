"use client";

import { useState, useCallback } from "react";
import {
  ChevronDown, ChevronUp, FileText, ExternalLink,
  CheckCircle, XCircle, Clock, Check, X, Loader2,
  Copy, Link2, AlertTriangle, Search, Film, Send, Calendar,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeName } from "@/lib/iclips/parser";
import { formatCurrency } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type Arquivo = {
  id: string;
  arquivo_url: string;
  nome_arquivo: string;
  tamanho_bytes: number | null;
  created_at: string;
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

type DbFornecedorSimple = {
  id: string;
  razao_social: string;
  cnpj: string;
  tipo: string;
  contato_nome: string | null;
};

type FornecedorEmbed = {
  razao_social: string;
  cnpj: string;
  tipo: string;
  contato_nome: string | null;
  contato_whatsapp: string | null;
};

type FF = {
  id: string;
  valor: number;
  honorarios: number;
  valor_total: number;
  prazo_dias: number;
  status: string;
  link_token: string | null;
  nome_iclips: string | null;
  associado: boolean | null;
  tipo_iclips: string | null;
  fornecedor: FornecedorEmbed | null;
  documentos: Documento[];
};

type CustoInterno = {
  id: string;
  codigo?: string;
  servico: string;
  qtde: number;
  valor_unitario: number;
  valor_total: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const docStatusCfg: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  pendente:  { label: "Pendente",  color: "#94A3B8", bg: "#F1F5F9", Icon: Clock },
  enviado:   { label: "Enviado",   color: "#D97706", bg: "#FFFBEB", Icon: Clock },
  aprovado:  { label: "Aprovado",  color: "#059669", bg: "#ECFDF5", Icon: CheckCircle },
  reprovado: { label: "Reprovado", color: "#DC2626", bg: "#FEF2F2", Icon: XCircle },
};

const ffStatusCfg: Record<string, { label: string; color: string }> = {
  aguardando: { label: "Aguardando", color: "#94A3B8" },
  parcial:    { label: "Parcial",    color: "#D97706" },
  completo:   { label: "Completo",   color: "#059669" },
  aprovado:   { label: "Aprovado",   color: "#2E60FF" },
  reprovado:  { label: "Reprovado",  color: "#DC2626" },
};

function isFfPending(ff: FF): boolean {
  return ff.associado === false;
}

// Formata datetime-local para exibição amigável
function formatarDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// Retorna o mínimo para o datetime-local picker (agora + 5 min)
function minDatetimeLocal(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

// ── DocRow ───────────────────────────────────────────────────────────────────

function DocRow({
  doc,
  isRevisor,
  onAction,
}: {
  doc: Documento;
  isRevisor: boolean;
  onAction: (docId: string, acao: "aprovar" | "reprovar", motivo?: string) => Promise<void>;
}) {
  const cfg = docStatusCfg[doc.status] ?? docStatusCfg.pendente;
  const { Icon } = cfg;
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo]         = useState("");
  const [loading, setLoading]       = useState<"aprovar" | "reprovar" | null>(null);
  const [erro, setErro]             = useState("");

  async function handleAprovar() {
    setLoading("aprovar"); setErro("");
    await onAction(doc.id, "aprovar");
    setLoading(null);
  }
  async function handleReprovar() {
    if (!motivo.trim()) { setErro("Informe o motivo."); return; }
    setLoading("reprovar"); setErro("");
    await onAction(doc.id, "reprovar", motivo.trim());
    setLoading(null); setReprovando(false); setMotivo("");
  }

  const podeRevisar = isRevisor && doc.status === "enviado" && !!doc.arquivo_url;

  return (
    <div style={{ borderBottom: "1px solid #F1F5F9" }}>
      <div className="flex items-center gap-3 py-3 px-5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
          <FileText className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm" style={{ color: "#334155" }}>{doc.label}</p>
          {(doc.documento_arquivos?.length ?? 0) > 0 ? (
            <div className="mt-1 space-y-0.5">
              {doc.documento_arquivos.map((arq) => {
                const ext = arq.nome_arquivo.split(".").pop()?.toLowerCase() ?? "";
                const isVideo = ["mp4","mov","avi","mkv","webm"].includes(ext);
                return (
                  <a key={arq.id} href={arq.arquivo_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs hover:underline" style={{ color: "#2E60FF" }}>
                    {isVideo
                      ? <Film className="w-3 h-3 flex-shrink-0" />
                      : <ExternalLink className="w-3 h-3 flex-shrink-0" />}
                    <span className="truncate max-w-[180px]">{arq.nome_arquivo}</span>
                  </a>
                );
              })}
            </div>
          ) : doc.arquivo_url ? (
            <a href={doc.arquivo_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs mt-0.5 hover:underline" style={{ color: "#2E60FF" }}>
              <ExternalLink className="w-3 h-3" /> Ver arquivo
            </a>
          ) : null}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}>
          <Icon className="w-3 h-3" />{cfg.label}
        </span>
        {podeRevisar && !reprovando && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={handleAprovar} disabled={!!loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: "#059669", opacity: loading ? 0.6 : 1 }}>
              {loading === "aprovar" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Aprovar
            </button>
            <button onClick={() => { setReprovando(true); setErro(""); }} disabled={!!loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626", opacity: loading ? 0.6 : 1 }}>
              <X className="w-3 h-3" />Reprovar
            </button>
          </div>
        )}
      </div>
      {doc.status === "reprovado" && doc.reprovacao_motivo && (
        <div className="mx-5 mb-3 px-3 py-2 rounded-lg flex items-start gap-2" style={{ backgroundColor: "#FEF2F2" }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
          <p className="text-xs" style={{ color: "#991B1B" }}>
            <span className="font-semibold">Motivo:</span> {doc.reprovacao_motivo}
          </p>
        </div>
      )}
      {reprovando && (
        <div className="mx-5 mb-3 space-y-2">
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o motivo da reprovação..." autoFocus rows={2}
            className="w-full px-3 py-2 text-xs rounded-lg border outline-none resize-none"
            style={{ borderColor: "#DC2626", color: "#0F172A" }} />
          {erro && <p className="text-xs" style={{ color: "#DC2626" }}>{erro}</p>}
          <div className="flex gap-2">
            <button onClick={handleReprovar} disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: "#DC2626", opacity: loading ? 0.6 : 1 }}>
              {loading === "reprovar" ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              Confirmar reprovação
            </button>
            <button onClick={() => { setReprovando(false); setMotivo(""); setErro(""); }} disabled={!!loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: "#E2E8F0", color: "#64748B" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FornecedorCard ───────────────────────────────────────────────────────────

function FornecedorCard({
  ff, isRevisor, onDocAction,
}: {
  ff: FF;
  isRevisor: boolean;
  onDocAction: (ffId: string, docId: string, acao: "aprovar" | "reprovar", motivo?: string) => Promise<void>;
}) {
  const [copied, setCopied]           = useState(false);
  const [enviando, setEnviando]       = useState(false);
  const [enviado, setEnviado]         = useState(false);
  const [erroEnvio, setErroEnvio]     = useState<string | null>(null);

  // Agendamento individual
  const [mostrarAgendar, setMostrarAgendar]   = useState(false);
  const [dataAgendada, setDataAgendada]       = useState("");
  const [agendando, setAgendando]             = useState(false);
  const [agendadoEm, setAgendadoEm]           = useState<string | null>(null);

  const fornecedor = ff.fornecedor!;
  const completos = ff.documentos.filter((d) => d.status === "aprovado" || d.status === "enviado").length;
  const total     = ff.documentos.length;
  const pct       = total > 0 ? Math.round((completos / total) * 100) : 0;
  const stCfg     = ffStatusCfg[ff.status] ?? ffStatusCfg.aguardando;
  const portalUrl = ff.link_token
    ? `${typeof window !== "undefined" ? window.location.origin : "https://disrupy-app.vercel.app"}/portal/${ff.link_token}`
    : null;

  async function copyLink() {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function enviarWhatsApp() {
    setEnviando(true); setErroEnvio(null);
    const res = await fetch("/api/disparos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ffId: ff.id }),
    });
    const data = await res.json();
    setEnviando(false);
    if (!res.ok) { setErroEnvio(data.error ?? "Erro ao enviar"); return; }
    setEnviado(true); setTimeout(() => setEnviado(false), 4000);
  }

  async function agendarEnvio() {
    if (!dataAgendada) return;
    setAgendando(true); setErroEnvio(null);
    // Converte datetime-local (sem timezone) para ISO com timezone local
    const dt = new Date(dataAgendada).toISOString();
    const res = await fetch("/api/disparos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ffId: ff.id, agendadoPara: dt }),
    });
    const data = await res.json();
    setAgendando(false);
    if (!res.ok) { setErroEnvio(data.error ?? "Erro ao agendar"); return; }
    setAgendadoEm(dataAgendada);
    setMostrarAgendar(false);
    setDataAgendada("");
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden mb-3" style={{ borderColor: "#E2E8F0" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: stCfg.color + "18", color: stCfg.color }}>
              {stCfg.label}
            </span>
          </div>
          <h4 className="font-semibold text-sm" style={{ color: "#0F172A" }}>{fornecedor.razao_social}</h4>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
            {fornecedor.cnpj}{fornecedor.contato_nome ? ` · ${fornecedor.contato_nome}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(ff.valor_total)}</p>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            {formatCurrency(ff.valor)} + hon. {formatCurrency(ff.honorarios ?? 0)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 justify-end">
            <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#059669" : "#2E60FF" }} />
            </div>
            <span className="text-xs" style={{ color: "#64748B" }}>{completos}/{total}</span>
          </div>
        </div>
      </div>

      {/* Documentos */}
      <div>
        {ff.documentos
          .sort((a, b) => {
            const order: Record<string, number> = { reprovado: 0, enviado: 1, pendente: 2, aprovado: 3 };
            return (order[a.status] ?? 2) - (order[b.status] ?? 2);
          })
          .map((doc) => (
            <DocRow key={doc.id} doc={doc} isRevisor={isRevisor}
              onAction={(docId, acao, motivo) => onDocAction(ff.id, docId, acao, motivo)} />
          ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 space-y-2" style={{ backgroundColor: "#F8FAFC" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs" style={{ color: "#94A3B8" }}>Prazo: {ff.prazo_dias} dias úteis</p>

          {portalUrl && (
            <div className="flex items-center gap-2 flex-wrap">
              <a href={portalUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: "#2E60FF" }}>
                <Link2 className="w-3 h-3" /> Portal
              </a>
              <button onClick={copyLink}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                style={{ backgroundColor: copied ? "#ECFDF5" : "#EEF2FF", color: copied ? "#059669" : "#2E60FF" }}>
                {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copiado!" : "Copiar link"}
              </button>

              {/* Botões WhatsApp */}
              {fornecedor.contato_whatsapp && isRevisor && (
                <>
                  <button
                    onClick={enviarWhatsApp}
                    disabled={enviando}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
                    style={{
                      backgroundColor: enviado ? "#DCFCE7" : "#F0FDF4",
                      color: enviado ? "#16A34A" : "#15803D",
                      opacity: enviando ? 0.6 : 1,
                    }}
                  >
                    {enviando
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : enviado
                        ? <CheckCircle className="w-3 h-3" />
                        : <Send className="w-3 h-3" />}
                    {enviando ? "Enviando..." : enviado ? "Enviado!" : "Enviar agora"}
                  </button>

                  <button
                    onClick={() => setMostrarAgendar((v) => !v)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                    style={{
                      backgroundColor: mostrarAgendar || agendadoEm ? "#FEF3C7" : "#F1F5F9",
                      color: mostrarAgendar || agendadoEm ? "#D97706" : "#64748B",
                    }}
                  >
                    <Calendar className="w-3 h-3" />
                    {agendadoEm ? `⏰ ${formatarDataHora(agendadoEm)}` : "Agendar"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Painel de agendamento individual */}
        {mostrarAgendar && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="datetime-local"
              value={dataAgendada}
              min={minDatetimeLocal()}
              onChange={(e) => setDataAgendada(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border outline-none"
              style={{ borderColor: "#F59E0B", color: "#334155" }}
            />
            <button
              onClick={agendarEnvio}
              disabled={!dataAgendada || agendando}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors"
              style={{ backgroundColor: !dataAgendada || agendando ? "#94A3B8" : "#D97706" }}
            >
              {agendando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
              {agendando ? "Agendando..." : "Confirmar"}
            </button>
            <button
              onClick={() => { setMostrarAgendar(false); setDataAgendada(""); }}
              className="text-xs"
              style={{ color: "#94A3B8" }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Erro de envio */}
      {erroEnvio && (
        <div className="px-5 py-2" style={{ backgroundColor: "#FEF2F2" }}>
          <p className="text-xs" style={{ color: "#DC2626" }}>⚠ {erroEnvio}</p>
        </div>
      )}
    </div>
  );
}

// ── PendingFornecedorCard ─────────────────────────────────────────────────────

function PendingFornecedorCard({
  ff,
  onAssociated,
}: {
  ff: FF;
  onAssociated: (ffId: string, fornecedor: FornecedorEmbed) => void;
}) {
  type Mode = "idle" | "search" | "loading";
  const [mode, setMode] = useState<Mode>("idle");
  const [busca, setBusca] = useState("");
  const [dbFornecedores, setDbFornecedores] = useState<DbFornecedorSimple[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [erro, setErro] = useState("");

  async function iniciarAssociar() {
    if (!dbLoaded) {
      const supabase = createClient();
      const { data } = await supabase
        .from("fornecedores")
        .select("id, razao_social, cnpj, tipo, contato_nome")
        .eq("ativo", true)
        .order("razao_social");
      setDbFornecedores((data ?? []) as DbFornecedorSimple[]);
      setDbLoaded(true);
    }
    setMode("search");
    setBusca("");
    setErro("");
  }

  async function handleAssociar(forn: DbFornecedorSimple) {
    setMode("loading");
    setErro("");
    const res = await fetch("/api/faturamento-fornecedores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ffId: ff.id, fornecedorId: forn.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErro(j.error ?? "Erro ao associar");
      setMode("search");
      return;
    }
    onAssociated(ff.id, {
      razao_social: forn.razao_social,
      cnpj: forn.cnpj,
      tipo: forn.tipo,
      contato_nome: forn.contato_nome,
      contato_whatsapp: null,
    });
  }

  const filtrados = busca
    ? dbFornecedores.filter((f) =>
        normalizeName(f.razao_social).includes(normalizeName(busca))
      )
    : dbFornecedores;

  return (
    <div
      className="rounded-xl overflow-hidden mb-3"
      style={{ border: "2px dashed #F59E0B", backgroundColor: "#FFFBEB" }}
    >
      <div className="flex items-start justify-between px-5 py-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
            >
              <AlertTriangle className="w-3 h-3" />
              Pendente de associação
            </span>
          </div>
          <h4 className="font-semibold text-sm" style={{ color: "#0F172A" }}>
            {ff.nome_iclips ?? "Fornecedor desconhecido"}
          </h4>
          <p className="text-xs mt-0.5" style={{ color: "#78716C" }}>
            Importado do iClips · sem cadastro associado
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(ff.valor_total)}</p>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            {formatCurrency(ff.valor)} + hon. {formatCurrency(ff.honorarios ?? 0)}
          </p>
        </div>
      </div>

      <div className="px-5 pb-4">
        {mode === "idle" && (
          <button
            onClick={iniciarAssociar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-100"
            style={{ borderColor: "#F59E0B", color: "#92400E", backgroundColor: "#FEF3C7" }}
          >
            <Link2 className="w-3 h-3" />
            Associar a fornecedor do cadastro
          </button>
        )}

        {mode === "loading" && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "#64748B" }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Associando...
          </div>
        )}

        {mode === "search" && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: "#94A3B8" }} />
              <input
                autoFocus type="text" value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar fornecedor no cadastro..."
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border outline-none bg-white"
                style={{ borderColor: "#F59E0B", color: "#334155" }}
              />
            </div>
            <div
              className="border rounded-lg overflow-y-auto bg-white"
              style={{ borderColor: "#E2E8F0", maxHeight: "160px" }}
            >
              {filtrados.length === 0 ? (
                <p className="px-3 py-2 text-xs" style={{ color: "#94A3B8" }}>
                  {dbLoaded ? "Nenhum resultado" : "Carregando..."}
                </p>
              ) : (
                filtrados.map((f) => (
                  <button
                    key={f.id} type="button"
                    onClick={() => handleAssociar(f)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 transition-colors flex items-center justify-between"
                    style={{ borderBottom: "1px solid #F1F5F9" }}
                  >
                    <span className="font-medium" style={{ color: "#0F172A" }}>{f.razao_social}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 ml-2"
                      style={{
                        backgroundColor: f.tipo === "midia" ? "#EEF2FF" : "#F5F3FF",
                        color: f.tipo === "midia" ? "#00246D" : "#7C3AED",
                      }}
                    >
                      {f.tipo === "midia" ? "Mídia" : "Produção"}
                    </span>
                  </button>
                ))
              )}
            </div>
            {erro && <p className="text-xs" style={{ color: "#DC2626" }}>{erro}</p>}
            <button
              type="button" onClick={() => setMode("idle")}
              className="text-xs hover:underline" style={{ color: "#94A3B8" }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LoteModal — modal de envio em lote por grupo ──────────────────────────────

function LoteModal({
  titulo,
  ffs,
  onClose,
  onConfirm,
}: {
  titulo: string;
  ffs: FF[];
  onClose: () => void;
  onConfirm: (ffIds: string[], agendadoPara?: string) => Promise<void>;
}) {
  const [modo, setModo]               = useState<"agora" | "agendar">("agora");
  const [dataAgendada, setDataAgendada] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(
    new Set(ffs.map((f) => f.id)),
  );
  const [enviando, setEnviando]         = useState(false);
  const [resultado, setResultado]       = useState<{ enviados: number; agendados: number } | null>(null);
  const [erro, setErro]                 = useState<string | null>(null);

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (selecionados.size === 0) return;
    if (modo === "agendar" && !dataAgendada) { setErro("Selecione data e hora."); return; }
    setEnviando(true); setErro(null);

    const agPara = modo === "agendar" ? new Date(dataAgendada).toISOString() : undefined;
    await onConfirm(Array.from(selecionados), agPara);

    // Feedback inline
    setResultado({
      enviados: modo === "agora" ? selecionados.size : 0,
      agendados: modo === "agendar" ? selecionados.size : 0,
    });
    setEnviando(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl bg-white p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#0F172A" }}>
              Enviar para {titulo}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
              Selecione os fornecedores e quando enviar
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" style={{ color: "#94A3B8" }} />
          </button>
        </div>

        {resultado ? (
          /* Tela de sucesso */
          <div className="text-center py-6">
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "#16A34A" }} />
            <p className="font-semibold text-sm" style={{ color: "#0F172A" }}>
              {resultado.enviados > 0
                ? `${resultado.enviados} mensagem(ns) enviada(s)!`
                : `${resultado.agendados} disparo(s) agendado(s)!`}
            </p>
            <button
              onClick={onClose}
              className="mt-5 px-4 py-2 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: "#2E60FF" }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Lista de fornecedores */}
            <div className="space-y-1.5 mb-5 max-h-48 overflow-y-auto">
              {ffs.map((ff) => (
                <label
                  key={ff.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(ff.id)}
                    onChange={() => toggleSel(ff.id)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "#0F172A" }}>
                      {ff.fornecedor?.razao_social}
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>
                      {ff.fornecedor?.contato_whatsapp}
                    </p>
                  </div>
                  <span className="text-xs font-medium" style={{ color: "#64748B" }}>
                    {formatCurrency(ff.valor_total)}
                  </span>
                </label>
              ))}
            </div>

            {/* Modo de envio */}
            <div className="flex gap-2 mb-4">
              {(["agora", "agendar"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModo(m)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: modo === m ? "#2E60FF" : "#F1F5F9",
                    color: modo === m ? "#fff" : "#64748B",
                  }}
                >
                  {m === "agora" ? "📨 Enviar agora" : "⏰ Agendar"}
                </button>
              ))}
            </div>

            {modo === "agendar" && (
              <div className="mb-4">
                <input
                  type="datetime-local"
                  value={dataAgendada}
                  min={minDatetimeLocal()}
                  onChange={(e) => { setDataAgendada(e.target.value); setErro(null); }}
                  className="w-full text-xs px-3 py-2 rounded-lg border outline-none"
                  style={{ borderColor: "#F59E0B", color: "#334155" }}
                />
              </div>
            )}

            {erro && <p className="text-xs mb-3" style={{ color: "#DC2626" }}>{erro}</p>}

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={enviando || selecionados.size === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{
                  backgroundColor: selecionados.size === 0 ? "#94A3B8" : "#2E60FF",
                  opacity: enviando ? 0.7 : 1,
                }}
              >
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
                {enviando
                  ? "Processando..."
                  : modo === "agora"
                    ? `Enviar para ${selecionados.size}`
                    : `Agendar para ${selecionados.size}`}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-sm border"
                style={{ borderColor: "#E2E8F0", color: "#64748B" }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── GroupSection ──────────────────────────────────────────────────────────────

function GroupSection({
  title, accentColor, accentBg, count, total, pendingCount = 0,
  children, defaultOpen = false,
  loteAction,
}: {
  title: string;
  accentColor: string;
  accentBg: string;
  count: number;
  total: number;
  pendingCount?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  loteAction?: { count: number; onClick: () => void };
}) {
  const [aberto, setAberto] = useState(defaultOpen);

  return (
    <div className="rounded-xl border bg-white overflow-hidden mb-4" style={{ borderColor: "#E2E8F0" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50"
        style={{ borderBottom: aberto ? "1px solid #E2E8F0" : "none" }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
          <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>{title}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: accentBg, color: accentColor }}
          >
            {count} {count === 1 ? "item" : "itens"}
          </span>
          {pendingCount > 0 && (
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
            >
              <AlertTriangle className="w-3 h-3" />
              {pendingCount} sem associação
            </span>
          )}
          {loteAction && loteAction.count > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); loteAction.onClick(); }}
              className="flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}
            >
              <Users className="w-3 h-3" />
              Enviar para todos ({loteAction.count})
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-bold" style={{ color: "#0F172A" }}>{formatCurrency(total)}</span>
          {aberto
            ? <ChevronUp  className="w-4 h-4" style={{ color: "#94A3B8" }} />
            : <ChevronDown className="w-4 h-4" style={{ color: "#94A3B8" }} />}
        </div>
      </button>
      {aberto && <div className="p-4">{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DocumentacaoSection({
  fornecedores,
  custosInternos,
  isRevisor,
}: {
  fornecedores: FF[];
  custosInternos: CustoInterno[];
  isRevisor: boolean;
}) {
  const [ffs, setFFs] = useState<FF[]>(fornecedores);
  const [loteModal, setLoteModal] = useState<{ titulo: string; ffs: FF[] } | null>(null);

  const handleDocAction = useCallback(async (
    ffId: string, docId: string, acao: "aprovar" | "reprovar", motivo?: string,
  ) => {
    const res = await fetch("/api/documentos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentoId: docId, acao, motivo }),
    });
    if (!res.ok) { const j = await res.json(); alert(j.error ?? "Erro"); return; }
    setFFs((prev) => prev.map((ff) =>
      ff.id !== ffId ? ff : {
        ...ff,
        documentos: ff.documentos.map((d) =>
          d.id !== docId ? d : {
            ...d,
            status: acao === "aprovar" ? "aprovado" : "reprovado",
            reprovacao_motivo: acao === "reprovar" ? (motivo ?? null) : null,
          }
        ),
      }
    ));
  }, []);

  const handleAssociated = useCallback((ffId: string, fornecedor: FornecedorEmbed) => {
    setFFs((prev) => prev.map((ff) =>
      ff.id !== ffId ? ff : { ...ff, associado: true, fornecedor }
    ));
  }, []);

  async function handleEnviarLote(ffIds: string[], agendadoPara?: string) {
    await fetch("/api/disparos/lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ffIds, agendadoPara }),
    });
  }

  const midia    = ffs.filter((f) => f.fornecedor?.tipo === "midia"    || (f.associado === false && f.tipo_iclips === "midia"));
  const producao = ffs.filter((f) => f.fornecedor?.tipo === "producao" || (f.associado === false && f.tipo_iclips === "producao"));

  const midiasPendentes   = midia.filter(isFfPending).length;
  const producaoPendentes = producao.filter(isFfPending).length;

  // FFs elegíveis para envio em lote (associados + com WhatsApp)
  const midiaComWpp    = midia.filter((f)    => !isFfPending(f) && f.fornecedor?.contato_whatsapp && f.link_token);
  const producaoComWpp = producao.filter((f) => !isFfPending(f) && f.fornecedor?.contato_whatsapp && f.link_token);

  const totalMidia    = midia.reduce((s, f) => s + (f.valor_total ?? 0), 0);
  const totalProducao = producao.reduce((s, f) => s + (f.valor_total ?? 0), 0);
  const totalCustos   = custosInternos.reduce((s, c) => s + (c.valor_total ?? 0), 0);

  const hasAny = midia.length > 0 || producao.length > 0 || custosInternos.length > 0;

  if (!hasAny) {
    return (
      <div className="rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}>
        <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "#CBD5E1" }} />
        <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Nenhum item adicionado ainda.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Mídia */}
      {midia.length > 0 && (
        <GroupSection
          title="Mídia" accentColor="#2E60FF" accentBg="#EEF2FF"
          count={midia.length} total={totalMidia} pendingCount={midiasPendentes}
          loteAction={isRevisor && midiaComWpp.length > 0 ? {
            count: midiaComWpp.length,
            onClick: () => setLoteModal({ titulo: "Mídia", ffs: midiaComWpp }),
          } : undefined}
        >
          {midia.map((ff) =>
            isFfPending(ff) ? (
              <PendingFornecedorCard key={ff.id} ff={ff} onAssociated={handleAssociated} />
            ) : (
              <FornecedorCard key={ff.id} ff={ff} isRevisor={isRevisor} onDocAction={handleDocAction} />
            )
          )}
        </GroupSection>
      )}

      {/* Produção */}
      {producao.length > 0 && (
        <GroupSection
          title="Produção" accentColor="#7C3AED" accentBg="#F5F3FF"
          count={producao.length} total={totalProducao} pendingCount={producaoPendentes}
          loteAction={isRevisor && producaoComWpp.length > 0 ? {
            count: producaoComWpp.length,
            onClick: () => setLoteModal({ titulo: "Produção", ffs: producaoComWpp }),
          } : undefined}
        >
          {producao.map((ff) =>
            isFfPending(ff) ? (
              <PendingFornecedorCard key={ff.id} ff={ff} onAssociated={handleAssociated} />
            ) : (
              <FornecedorCard key={ff.id} ff={ff} isRevisor={isRevisor} onDocAction={handleDocAction} />
            )
          )}
        </GroupSection>
      )}

      {/* Custos Internos */}
      {custosInternos.length > 0 && (
        <GroupSection
          title="Custos Internos" accentColor="#64748B" accentBg="#F1F5F9"
          count={custosInternos.length} total={totalCustos}
        >
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#F8FAFC" }}>
                  <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Código</th>
                  <th className="text-left px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Serviço</th>
                  <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Qtde</th>
                  <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Unit.</th>
                  <th className="text-right px-5 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {custosInternos.map((ci, i) => (
                  <tr key={ci.id ?? i} style={{ borderTop: "1px solid #F1F5F9" }}>
                    <td className="px-5 py-3 font-mono text-xs" style={{ color: "#64748B" }}>{ci.codigo ?? "—"}</td>
                    <td className="px-5 py-3" style={{ color: "#334155" }}>{ci.servico}</td>
                    <td className="px-5 py-3 text-right" style={{ color: "#334155" }}>{ci.qtde}</td>
                    <td className="px-5 py-3 text-right" style={{ color: "#334155" }}>{formatCurrency(ci.valor_unitario)}</td>
                    <td className="px-5 py-3 text-right font-semibold" style={{ color: "#0F172A" }}>{formatCurrency(ci.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GroupSection>
      )}

      {/* Modal de envio em lote */}
      {loteModal && (
        <LoteModal
          titulo={loteModal.titulo}
          ffs={loteModal.ffs}
          onClose={() => setLoteModal(null)}
          onConfirm={handleEnviarLote}
        />
      )}
    </div>
  );
}

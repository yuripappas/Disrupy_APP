"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Clock, CheckCircle, XCircle, Calendar, Search,
  Loader2, MessageSquare, Phone, Mail, Filter, ExternalLink, GitBranch,
  Users, Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CadenciaModal } from "./CadenciaModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type DisparoRecord = {
  id: string;
  status: string;
  tipo: string;
  subtipo?: string | null;
  created_at: string;
  enviado_em: string | null;
  agendado_para: string | null;
};

type DocumentoRecord = {
  id: string;
  status: string;
};

export type FFRow = {
  id: string;
  link_token: string;
  valor_total: number;
  valor?: number;
  tipo?: string | null;
  envio_inicial_em?: string | null;
  faturamento: { id: string; nome_campanha: string; iclips_job_id: string | null };
  fornecedor:  {
    id: string; razao_social: string; cnpj: string;
    contato_nome: string | null; contato_whatsapp: string;
    contato_email?: string | null; telefone?: string | null;
  };
  documentos:  DocumentoRecord[];
  disparos:    DisparoRecord[];
};

type DocStatus   = "sem_docs" | "pendente" | "parcial" | "respondeu";
type DispStatus  = "nao_enviado" | "agendado" | "enviado" | "falhou";
type RowStatus   = "nao_enviado" | "parcial" | "concluido" | "reprovado";

type ComputedRow = FFRow & {
  docStatus:    DocStatus;
  dispStatus:   DispStatus;
  rowStatus:    RowStatus;
  ultimoDisparo: DisparoRecord | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRow(ff: FFRow): ComputedRow {
  const docs = ff.documentos ?? [];
  let docStatus: DocStatus = "sem_docs";
  if (docs.length > 0) {
    const filled = docs.filter((d) => d.status !== "pendente").length;
    if (filled === 0)               docStatus = "pendente";
    else if (filled < docs.length)  docStatus = "parcial";
    else                            docStatus = "respondeu";
  }

  const sorted = [...(ff.disparos ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const ultimoDisparo = sorted[0] ?? null;
  let dispStatus: DispStatus = "nao_enviado";
  if (ultimoDisparo) {
    if (ultimoDisparo.status === "agendado") dispStatus = "agendado";
    else if (ultimoDisparo.status === "enviado") dispStatus = "enviado";
    else if (ultimoDisparo.status === "falhou")  dispStatus = "falhou";
  }

  const hasReprovado = docs.some((d) => d.status === "reprovado");
  let rowStatus: RowStatus;
  if (hasReprovado)                        rowStatus = "reprovado";
  else if (docStatus === "respondeu")      rowStatus = "concluido";
  else if (docStatus === "parcial")        rowStatus = "parcial";
  else                                     rowStatus = "nao_enviado";

  return { ...ff, docStatus, dispStatus, rowStatus, ultimoDisparo };
}

function formatDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function minDtLocal() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function tipoLabel(tipo: string | null | undefined) {
  if (tipo === "midia")    return "Mídia";
  if (tipo === "producao") return "Produção";
  return "Outros";
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#E2E8F0", backgroundColor: bg }}>
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color }}>
        {label}
      </p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

// ── DocBadge ──────────────────────────────────────────────────────────────────

function DocBadge({ status, total, filled }: { status: DocStatus; total: number; filled: number }) {
  const cfg = {
    sem_docs:  { label: "Sem docs",   color: "#94A3B8", bg: "#F1F5F9" },
    pendente:  { label: "Pendente",   color: "#D97706", bg: "#FFFBEB" },
    parcial:   { label: "Parcial",    color: "#2E60FF", bg: "#EEF2FF" },
    respondeu: { label: "Respondeu",  color: "#059669", bg: "#ECFDF5" },
  }[status];
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
        {cfg.label}
      </span>
      {total > 0 && (
        <span className="text-xs" style={{ color: "#94A3B8" }}>{filled}/{total}</span>
      )}
    </div>
  );
}

// ── RowStatusBadge ────────────────────────────────────────────────────────────

function RowStatusBadge({ status }: { status: RowStatus }) {
  const cfg = {
    nao_enviado: { label: "Não enviado", color: "#94A3B8", bg: "#F1F5F9" },
    parcial:     { label: "Parcial",     color: "#2E60FF", bg: "#EEF2FF" },
    concluido:   { label: "Concluído",   color: "#059669", bg: "#ECFDF5" },
    reprovado:   { label: "Reprovado",   color: "#DC2626", bg: "#FEF2F2" },
  }[status];
  return (
    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

// ── UltimoDisparoCel ──────────────────────────────────────────────────────────

const SUBTIPO_LABEL: Record<string, string> = {
  link_inicial: "Link Inicial",
  lembrete_1:   "Lembrete 1",
  lembrete_2:   "Lembrete 2",
  lembrete_3:   "Lembrete 3",
  lembrete_4:   "Lembrete 4",
  confirmacao:  "Confirmação",
  divergencia:  "Divergência",
};

function UltimoDisparoCel({ row }: { row: ComputedRow }) {
  const disparos = row.disparos ?? [];

  const waSent   = disparos.some((d) => d.tipo !== "email" && d.status === "enviado");
  const mailSent = disparos.some((d) => d.tipo === "email" && d.status === "enviado");

  const stageLabel = row.ultimoDisparo?.subtipo
    ? (SUBTIPO_LABEL[row.ultimoDisparo.subtipo] ?? row.ultimoDisparo.subtipo)
    : null;

  const DispStatusBadge = () => {
    const cfg = {
      nao_enviado: { label: "Não enviado", color: "#94A3B8", bg: "#F1F5F9", Icon: Clock },
      agendado:    { label: "Agendado",    color: "#D97706", bg: "#FFFBEB", Icon: Calendar },
      enviado:     { label: "Enviado",     color: "#2E60FF", bg: "#EEF2FF", Icon: Send },
      falhou:      { label: "Falhou",      color: "#DC2626", bg: "#FEF2F2", Icon: XCircle },
    }[row.dispStatus];
    const { Icon } = cfg;
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ color: cfg.color, backgroundColor: cfg.bg }}>
        <Icon className="w-3 h-3" />{cfg.label}
      </span>
    );
  };

  return (
    <div className="space-y-1.5">
      {stageLabel ? (
        <p className="text-xs font-semibold" style={{ color: "#0F172A" }}>{stageLabel}</p>
      ) : (
        <DispStatusBadge />
      )}
      {row.ultimoDisparo && (
        <>
          {stageLabel && <DispStatusBadge />}
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            {formatDt(row.ultimoDisparo.enviado_em ?? row.ultimoDisparo.agendado_para ?? row.ultimoDisparo.created_at)}
          </p>
        </>
      )}
      {/* Canais */}
      <div className="flex items-center gap-2">
        {/* WhatsApp */}
        <div className="flex items-center gap-0.5">
          <MessageSquare className="w-3.5 h-3.5" style={{ color: waSent ? "#16A34A" : "#CBD5E1" }} />
          {waSent && (
            <span className="text-xs font-bold leading-none" style={{ color: "#16A34A", letterSpacing: "-1px" }}>✓✓</span>
          )}
        </div>
        {/* Email */}
        <div className="flex items-center gap-0.5">
          <Mail className="w-3.5 h-3.5" style={{ color: mailSent ? "#2E60FF" : "#CBD5E1" }} />
          {mailSent && (
            <span className="text-xs font-bold leading-none" style={{ color: "#2E60FF", letterSpacing: "-1px" }}>✓✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({
  row,
  onAtualizar,
  onCadencia,
  onRemover,
}: {
  row: ComputedRow;
  onAtualizar: (ffId: string, disparo: DisparoRecord) => void;
  onCadencia: (ffId: string) => void;
  onRemover?: (ffId: string) => void;
}) {
  const [enviando, setEnviando]       = useState(false);
  const [agendando, setAgendando]     = useState(false);
  const [mostrarAg, setMostrarAg]     = useState(false);
  const [dataAg, setDataAg]           = useState("");
  const [erro, setErro]               = useState<string | null>(null);
  const [enviado, setEnviado]         = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);
  const [excluindo, setExcluindo]     = useState(false);

  async function excluir() {
    setExcluindo(true);
    const res = await fetch(`/api/faturamento-fornecedores?id=${row.id}`, { method: "DELETE" });
    const data = await res.json();
    setExcluindo(false);
    if (!res.ok) { setErro(data.error ?? "Erro ao excluir"); setConfirmDel(false); return; }
    onRemover?.(row.id);
  }

  const portalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${row.link_token}`;
  const docsFilled = (row.documentos ?? []).filter((d) => d.status !== "pendente").length;
  const isRespondeu = row.docStatus === "respondeu";

  async function enviarAgora() {
    setEnviando(true); setErro(null);
    const res = await fetch("/api/disparos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ffId: row.id }),
    });
    const data = await res.json();
    setEnviando(false);
    if (!res.ok) { setErro(data.error ?? "Erro ao enviar"); return; }
    setEnviado(true);
    const agora = new Date().toISOString();
    onAtualizar(row.id, {
      id: data.id ?? "tmp-wa-" + Date.now(),
      tipo: "whatsapp",
      subtipo: "link_inicial",
      status: "enviado",
      created_at: agora,
      enviado_em: agora,
      agendado_para: null,
    });
    if (data.emailEnviado) {
      onAtualizar(row.id, {
        id: "tmp-mail-" + Date.now(),
        tipo: "email",
        subtipo: "link_inicial",
        status: "enviado",
        created_at: agora,
        enviado_em: agora,
        agendado_para: null,
      });
    }
    setTimeout(() => setEnviado(false), 4000);
  }

  async function agendar() {
    if (!dataAg) return;
    setAgendando(true); setErro(null);
    const res = await fetch("/api/disparos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ffId: row.id, agendadoPara: new Date(dataAg).toISOString() }),
    });
    const data = await res.json();
    setAgendando(false);
    if (!res.ok) { setErro(data.error ?? "Erro ao agendar"); return; }
    setMostrarAg(false);
    setDataAg("");
    onAtualizar(row.id, {
      id: "ag-" + Date.now(),
      tipo: "whatsapp",
      subtipo: "link_inicial",
      status: "agendado",
      created_at: new Date().toISOString(),
      enviado_em: null,
      agendado_para: new Date(dataAg).toISOString(),
    });
  }

  return (
    <>
      <tr
        className="transition-colors"
        style={{
          borderBottom: "1px solid #F1F5F9",
          backgroundColor: isRespondeu ? "#F0FDF4" : undefined,
        }}
      >
        {/* Fornecedor */}
        <td className="px-5 py-3.5">
          <p className="text-sm font-medium" style={{ color: "#0F172A" }}>{row.fornecedor.razao_social}</p>
          {row.fornecedor.contato_nome && (
            <p className="text-xs mt-0.5" style={{ color: "#334155" }}>{row.fornecedor.contato_nome}</p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
              <span className="text-xs font-mono" style={{ color: "#64748B" }}>{row.fornecedor.contato_whatsapp}</span>
            </div>
            {row.fornecedor.contato_email && (
              <div className="flex items-center gap-1">
                <Mail className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                <span className="text-xs" style={{ color: "#64748B" }}>{row.fornecedor.contato_email}</span>
              </div>
            )}
          </div>
        </td>

        {/* Campanha */}
        <td className="px-5 py-3.5">
          <p className="text-sm" style={{ color: "#334155" }}>{row.faturamento.nome_campanha}</p>
          {row.faturamento.iclips_job_id && (
            <p className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>{row.faturamento.iclips_job_id}</p>
          )}
        </td>

        {/* Valor repasse */}
        <td className="px-5 py-3.5">
          <p className="text-sm font-medium tabular-nums" style={{ color: "#334155" }}>
            {formatCurrency(row.valor ?? 0)}
          </p>
        </td>

        {/* Documentos */}
        <td className="px-5 py-3.5">
          <DocBadge status={row.docStatus} total={row.documentos.length} filled={docsFilled} />
        </td>

        {/* Último disparo */}
        <td className="px-5 py-3.5">
          <UltimoDisparoCel row={row} />
        </td>

        {/* Status */}
        <td className="px-5 py-3.5">
          <RowStatusBadge status={row.rowStatus} />
        </td>

        {/* Ações */}
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1.5">
            {/* Enviar */}
            <button
              onClick={enviarAgora}
              disabled={enviando}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: enviado ? "#DCFCE7" : "#F0FDF4",
                color: enviado ? "#16A34A" : "#15803D",
                opacity: enviando ? 0.6 : 1,
              }}
            >
              {enviando ? <Loader2 className="w-3 h-3 animate-spin" />
                : enviado ? <CheckCircle className="w-3 h-3" />
                : <Send className="w-3 h-3" />}
              {enviando ? "..." : enviado ? "Enviado!" : row.dispStatus === "nao_enviado" ? "Enviar" : "Reenviar"}
            </button>

            {/* Agendar */}
            <button
              onClick={() => setMostrarAg((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{
                backgroundColor: mostrarAg ? "#FEF3C7" : "#F1F5F9",
                color: mostrarAg ? "#D97706" : "#64748B",
              }}
            >
              <Calendar className="w-3 h-3" />
              Agendar
            </button>

            {/* Cadência */}
            <button
              onClick={() => onCadencia(row.id)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ backgroundColor: "#F5F3FF", color: "#7C3AED" }}
              title="Ver cadência de mensagens"
            >
              <GitBranch className="w-3 h-3" />
              Cadência
            </button>

            {/* Portal */}
            <a
              href={portalUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}
              title="Ver portal do fornecedor"
            >
              <ExternalLink className="w-3 h-3" />
            </a>

            {/* Excluir (só aparece quando onRemover é passado) */}
            {onRemover && !confirmDel && (
              <button
                onClick={() => setConfirmDel(true)}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-red-50"
                style={{ color: "#CBD5E1" }}
                title="Excluir fornecedor do faturamento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Confirmação de exclusão inline */}
          {confirmDel && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs" style={{ color: "#DC2626" }}>Remover fornecedor?</span>
              <button
                onClick={excluir}
                disabled={excluindo}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium text-white"
                style={{ backgroundColor: excluindo ? "#94A3B8" : "#DC2626" }}
              >
                {excluindo ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {excluindo ? "..." : "Confirmar"}
              </button>
              <button onClick={() => setConfirmDel(false)} className="text-xs" style={{ color: "#94A3B8" }}>
                Cancelar
              </button>
            </div>
          )}

          {erro && <p className="text-xs mt-1" style={{ color: "#DC2626" }}>⚠ {erro}</p>}
        </td>
      </tr>

      {/* Agendamento inline */}
      {mostrarAg && (
        <tr style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: "#FFFBEB" }}>
          <td colSpan={7} className="px-5 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium" style={{ color: "#92400E" }}>Agendar envio:</span>
              <input
                type="datetime-local"
                value={dataAg}
                min={minDtLocal()}
                onChange={(e) => setDataAg(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border outline-none bg-white"
                style={{ borderColor: "#F59E0B", color: "#334155" }}
              />
              <button
                onClick={agendar}
                disabled={!dataAg || agendando}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                style={{ backgroundColor: !dataAg || agendando ? "#94A3B8" : "#D97706" }}
              >
                {agendando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
                {agendando ? "Agendando..." : "Confirmar"}
              </button>
              <button onClick={() => { setMostrarAg(false); setDataAg(""); }}
                className="text-xs" style={{ color: "#94A3B8" }}>
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── GroupHeader ───────────────────────────────────────────────────────────────

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <tr>
      <td colSpan={7} style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0", borderTop: "1px solid #E2E8F0" }}>
        <div className="flex items-center gap-2 px-5 py-2">
          <Users className="w-3.5 h-3.5" style={{ color: "#64748B" }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
            {label}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#E2E8F0", color: "#64748B" }}>
            {count}
          </span>
        </div>
      </td>
    </tr>
  );
}

// ── EnviarParaTodosButton ─────────────────────────────────────────────────────

function EnviarParaTodosButton({
  rows,
  onAtualizar,
}: {
  rows: ComputedRow[];
  onAtualizar: (ffId: string, disparo: DisparoRecord) => void;
}) {
  const [estado, setEstado] = useState<"idle" | "enviando" | "concluido">("idle");
  const [progresso, setProgresso] = useState({ done: 0, total: 0, erros: 0 });

  const pendentes = rows.filter((r) => r.dispStatus === "nao_enviado" || r.dispStatus === "falhou");

  async function enviarTodos() {
    if (pendentes.length === 0) return;
    setEstado("enviando");
    setProgresso({ done: 0, total: pendentes.length, erros: 0 });

    let erros = 0;
    for (let i = 0; i < pendentes.length; i++) {
      const row = pendentes[i];
      try {
        const res = await fetch("/api/disparos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ffId: row.id }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const agora = new Date().toISOString();
          onAtualizar(row.id, {
            id: "todos-wa-" + Date.now() + i,
            tipo: "whatsapp",
            subtipo: "link_inicial",
            status: "enviado",
            created_at: agora,
            enviado_em: agora,
            agendado_para: null,
          });
          if (data.emailEnviado) {
            onAtualizar(row.id, {
              id: "todos-mail-" + Date.now() + i,
              tipo: "email",
              subtipo: "link_inicial",
              status: "enviado",
              created_at: agora,
              enviado_em: agora,
              agendado_para: null,
            });
          }
        } else {
          erros++;
        }
      } catch {
        erros++;
      }
      setProgresso({ done: i + 1, total: pendentes.length, erros });
    }

    setEstado("concluido");
    setTimeout(() => setEstado("idle"), 5000);
  }

  if (pendentes.length === 0) return null;

  return (
    <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid #E2E8F0" }}>
      {estado === "idle" && (
        <button
          onClick={enviarTodos}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#00246D", color: "white" }}
        >
          <Send className="w-3.5 h-3.5" />
          Enviar para todos ({rows.length})
        </button>
      )}
      {estado === "enviando" && (
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#2E60FF" }} />
          <span className="text-sm" style={{ color: "#334155" }}>
            Enviando {progresso.done}/{progresso.total}…
          </span>
          <div className="h-1.5 w-32 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(progresso.done / progresso.total) * 100}%`,
                backgroundColor: "#2E60FF",
              }}
            />
          </div>
        </div>
      )}
      {estado === "concluido" && (
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4" style={{ color: "#059669" }} />
          <span className="text-sm" style={{ color: "#059669" }}>
            {progresso.total - progresso.erros} enviados
            {progresso.erros > 0 && `, ${progresso.erros} falharam`}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function MonitoramentoClient({
  ffs: initialFfs,
  onRemover,
}: {
  ffs: FFRow[];
  onRemover?: (ffId: string) => void;
}) {
  const router                      = useRouter();
  const refreshTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ffs, setFfs]               = useState<FFRow[]>(initialFfs);
  const [filtroFat, setFiltroFat]   = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca]           = useState("");
  const [cadenciaFfId, setCadenciaFfId] = useState<string | null>(null);

  // Derived: sempre usa o ff atualizado de `ffs` — nunca um snapshot estático
  const cadenciaFf = useMemo(
    () => (cadenciaFfId ? (ffs.find((ff) => ff.id === cadenciaFfId) ?? null) : null),
    [cadenciaFfId, ffs],
  );

  // Quando o servidor refaz o render (router.refresh), mescla os dados reais do banco
  // com eventuais disparos otimistas que ainda não chegaram no banco.
  useEffect(() => {
    setFfs((prev) =>
      initialFfs.map((newFf) => {
        const oldFf = prev.find((f) => f.id === newFf.id);
        if (!oldFf) return newFf;
        const dbIds    = new Set(newFf.disparos.map((d) => d.id));
        const synthetic = (oldFf.disparos ?? []).filter((d) => !dbIds.has(d.id));
        return { ...newFf, disparos: [...synthetic, ...newFf.disparos] };
      }),
    );
  }, [initialFfs]);

  function handleAtualizar(ffId: string, disparo: DisparoRecord) {
    setFfs((prev) =>
      prev.map((ff) =>
        ff.id !== ffId ? ff : { ...ff, disparos: [disparo, ...(ff.disparos ?? [])] },
      ),
    );
    // Debounce: dispara uma única atualização do servidor após todos os envios
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 800);
  }

  function handleRemover(ffId: string) {
    setFfs((prev) => prev.filter((ff) => ff.id !== ffId));
    onRemover?.(ffId);
  }

  const rows = useMemo(() => ffs.map(computeRow), [ffs]);

  const kpi = useMemo(() => ({
    total:      rows.length,
    enviados:   rows.filter((r) => r.dispStatus === "enviado").length,
    responderam:rows.filter((r) => r.docStatus  === "respondeu").length,
    pendentes:  rows.filter((r) => r.dispStatus === "nao_enviado" || r.dispStatus === "falhou").length,
    agendados:  rows.filter((r) => r.dispStatus === "agendado").length,
    falhou:     rows.filter((r) => r.dispStatus === "falhou").length,
  }), [rows]);

  const faturamentos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.faturamento.id, r.faturamento.nome_campanha));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filtroFat !== "todos" && r.faturamento.id !== filtroFat) return false;
      if (filtroStatus !== "todos") {
        if (filtroStatus === "nao_enviado"  && r.dispStatus !== "nao_enviado") return false;
        if (filtroStatus === "agendado"     && r.dispStatus !== "agendado")    return false;
        if (filtroStatus === "enviado"      && r.dispStatus !== "enviado")     return false;
        if (filtroStatus === "falhou"       && r.dispStatus !== "falhou")      return false;
        if (filtroStatus === "respondeu"    && r.docStatus  !== "respondeu")   return false;
        if (filtroStatus === "pendente_doc" && r.docStatus  !== "pendente" && r.docStatus !== "parcial") return false;
        if (filtroStatus === "reprovado"    && r.rowStatus  !== "reprovado")   return false;
        if (filtroStatus === "concluido"    && r.rowStatus  !== "concluido")   return false;
      }
      if (busca) {
        const q = busca.toLowerCase();
        if (
          !r.fornecedor.razao_social.toLowerCase().includes(q) &&
          !r.faturamento.nome_campanha.toLowerCase().includes(q) &&
          !(r.fornecedor.contato_email ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, filtroFat, filtroStatus, busca]);

  // Agrupa por tipo
  const grupos = useMemo(() => {
    const ORDER = ["midia", "producao"];
    const map = new Map<string, ComputedRow[]>();
    filtered.forEach((r) => {
      const key = r.tipo ?? "outros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    const sorted: [string, ComputedRow[]][] = [];
    for (const key of ORDER) {
      if (map.has(key)) sorted.push([key, map.get(key)!]);
    }
    for (const [key, val] of map) {
      if (!ORDER.includes(key)) sorted.push([key, val]);
    }
    return sorted;
  }, [filtered]);

  const multiGrupo = grupos.length > 1;

  return (
    <div>
      {cadenciaFf && (
        <CadenciaModal ff={cadenciaFf} onClose={() => setCadenciaFfId(null)} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard label="Elegíveis"   value={kpi.total}       color="#334155" bg="#F8FAFC" />
        <KpiCard label="Enviados"    value={kpi.enviados}    color="#2E60FF" bg="#EEF2FF" />
        <KpiCard label="Responderam" value={kpi.responderam} color="#059669" bg="#ECFDF5" />
        <KpiCard label="Pendentes"   value={kpi.pendentes}   color="#D97706" bg="#FFFBEB" />
        <KpiCard label="Agendados"   value={kpi.agendados}   color="#7C3AED" bg="#F5F3FF" />
        <KpiCard label="Falhou"      value={kpi.falhou}      color="#DC2626" bg="#FEF2F2" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, campanha ou email..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none bg-white"
            style={{ borderColor: "#E2E8F0", color: "#334155" }}
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "#94A3B8" }} />
          <select
            value={filtroFat}
            onChange={(e) => setFiltroFat(e.target.value)}
            className="pl-9 pr-8 py-2 text-sm rounded-lg border outline-none bg-white appearance-none"
            style={{ borderColor: "#E2E8F0", color: "#334155" }}
          >
            <option value="todos">Todas as campanhas</option>
            {faturamentos.map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
        </div>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border outline-none bg-white appearance-none"
          style={{ borderColor: "#E2E8F0", color: "#334155" }}
        >
          <option value="todos">Todos os status</option>
          <option value="nao_enviado">Não enviado</option>
          <option value="agendado">Agendado</option>
          <option value="enviado">Enviado</option>
          <option value="falhou">Falhou</option>
          <option value="respondeu">Respondeu</option>
          <option value="pendente_doc">Docs pendentes</option>
          <option value="reprovado">Reprovado</option>
          <option value="concluido">Concluído</option>
        </select>

        <span className="text-xs ml-auto" style={{ color: "#94A3B8" }}>
          {filtered.length} de {rows.length} fornecedores
        </span>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}>
          <p className="text-sm" style={{ color: "#94A3B8" }}>Nenhum fornecedor encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>Fornecedor</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>Campanha</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>Valor</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>Documentos</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>Último disparo</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(([tipo, grupoRows]) => (
                <>
                  {multiGrupo && (
                    <GroupHeader key={`header-${tipo}`} label={tipoLabel(tipo)} count={grupoRows.length} />
                  )}
                  {grupoRows.map((row) => (
                    <Row key={row.id} row={row} onAtualizar={handleAtualizar} onCadencia={setCadenciaFfId} onRemover={onRemover ? handleRemover : undefined} />
                  ))}
                </>
              ))}
            </tbody>
          </table>

          {/* Enviar para todos */}
          <EnviarParaTodosButton rows={filtered} onAtualizar={handleAtualizar} />
        </div>
      )}

      {/* Legenda de cores */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }} />
          <span className="text-xs" style={{ color: "#94A3B8" }}>Verde = todos os documentos preenchidos</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3 h-3" style={{ color: "#16A34A" }} />
          <span className="text-xs font-bold" style={{ color: "#16A34A" }}>✓✓</span>
          <span className="text-xs" style={{ color: "#94A3B8" }}>= canal enviado com sucesso</span>
        </div>
      </div>
    </div>
  );
}

// Re-export so CadenciaModal import still works
export type { DisparoRecord };

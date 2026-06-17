"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Clock, CheckCircle, XCircle, Calendar, Search,
  Loader2, MessageSquare, Phone, Mail, Filter, ExternalLink, GitBranch,
  Users, Trash2, FileText, Edit2, AlertTriangle,
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
  tipo?: string;
  arquivo_url?: string | null;
};

export type FFRow = {
  id: string;
  link_token: string;
  valor_total: number;
  valor?: number;
  tipo?: string | null;
  envio_inicial_em?: string | null;
  orcamentos_internos_habilitado?: boolean;
  numero_os_pi?: string | null;
  faturamento: {
    id: string;
    nome_campanha: string;
    iclips_job_id: string | null;
    cliente_tipo?: string;
    cliente_nome?: string;
  };
  fornecedor:  {
    id: string; razao_social: string; cnpj: string;
    contato_nome: string | null; contato_whatsapp: string | null;
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
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ color: "#2E60FF", backgroundColor: "#EEF2FF" }}>
          <GitBranch className="w-3 h-3" />{stageLabel}
        </span>
      ) : (
        <DispStatusBadge />
      )}
      {row.ultimoDisparo && (
        <p className="text-xs" style={{ color: "#94A3B8" }}>
          {formatDt(row.ultimoDisparo.enviado_em ?? row.ultimoDisparo.agendado_para ?? row.ultimoDisparo.created_at)}
        </p>
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

// ── OrcamentosPanel ───────────────────────────────────────────────────────────
// Etapa 1: apenas seleciona se o fornecedor preenche 1 ou 3 orçamentos.
// Upload interno fica na Etapa 2 (DocumentacaoSection).

function OrcamentosPanel({
  row,
  onToggle,
}: {
  row: ComputedRow;
  onToggle: (ffId: string, enabled: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [erro,     setErro]     = useState<string | null>(null);
  const enabled = row.orcamentos_internos_habilitado ?? false;

  async function handleToggle() {
    const newVal = !enabled;
    setToggling(true);
    setErro(null);
    try {
      const res = await fetch("/api/faturamento-fornecedores", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ffId: row.id, orcamentosInternosHabilitado: newVal }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setErro(data.error ?? "Erro ao atualizar");
        return;
      }
      onToggle(row.id, newVal);
    } catch {
      setErro("Erro ao atualizar");
    } finally {
      setToggling(false);
    }
  }

  return (
    <tr style={{ borderBottom: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}>
      <td colSpan={6} className="px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold" style={{ color: "#334155" }}>
              Orçamentos pelo portal do fornecedor
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              {enabled
                ? "Fornecedor preenche os 3 orçamentos no link. Nenhum upload interno necessário na Etapa 2."
                : "Fornecedor preenche só o Orçamento 1. Os demais (2 e 3) são preenchidos internamente na Etapa 2."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {erro && <span className="text-xs" style={{ color: "#DC2626" }}>{erro}</span>}
            <span className="text-xs font-medium" style={{ color: enabled ? "#2E60FF" : "#94A3B8" }}>
              {enabled ? "3 orçamentos" : "Só Orç. 1"}
            </span>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors"
              style={{ backgroundColor: enabled ? "#2E60FF" : "#CBD5E1" }}
              title={enabled
                ? "Fornecedor preenche os 3 orçamentos no portal"
                : "Fornecedor preenche só o Orçamento 1"}
            >
              {toggling
                ? <Loader2 className="absolute left-1 w-3 h-3 animate-spin text-white" />
                : <span
                    className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
                    style={{ transform: enabled ? "translateX(18px)" : "translateX(2px)" }}
                  />
              }
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({
  row,
  onAtualizar,
  onCadencia,
  onRemover,
  onToggle,
  onOsPiChange,
  onContatoChange,
}: {
  row: ComputedRow;
  onAtualizar: (ffId: string, disparo: DisparoRecord) => void;
  onCadencia: (ffId: string) => void;
  onRemover?: (ffId: string) => void;
  onToggle: (ffId: string, enabled: boolean) => void;
  onOsPiChange: (ffId: string, value: string | null) => void;
  onContatoChange: (ffId: string, contato: { contato_nome: string | null; contato_whatsapp: string | null; contato_email: string | null }) => void;
}) {
  const [enviando, setEnviando]         = useState(false);
  const [agendando, setAgendando]       = useState(false);
  const [mostrarAg, setMostrarAg]       = useState(false);
  const [mostrarOrc, setMostrarOrc]     = useState(false);
  const [dataAg, setDataAg]             = useState("");
  const [erro, setErro]                 = useState<string | null>(null);
  const [enviado, setEnviado]           = useState(false);
  const [confirmDel, setConfirmDel]     = useState(false);
  const [excluindo, setExcluindo]       = useState(false);
  const [osPiLocal, setOsPiLocal]       = useState<string | null>(row.numero_os_pi ?? null);
  const [editandoOsPi, setEditandoOsPi] = useState(false);
  const [osPiInput, setOsPiInput]       = useState(row.numero_os_pi ?? "");
  const [salvandoOsPi, setSalvandoOsPi] = useState(false);
  const [erroOsPi, setErroOsPi]         = useState<string | null>(null);

  // Contato local (espelha o dado do fornecedor para update otimista)
  const [contatoLocal, setContatoLocal] = useState({
    nome:  row.fornecedor.contato_nome   ?? "",
    wa:    row.fornecedor.contato_whatsapp ?? "",
    email: row.fornecedor.contato_email  ?? "",
  });
  const [editandoContato, setEditandoContato] = useState(false);
  const [contatoInput, setContatoInput]       = useState({ nome: "", wa: "", email: "" });
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [erroContato, setErroContato]         = useState<string | null>(null);

  const semContato = !contatoLocal.wa && !contatoLocal.email;

  const tipoForn  = row.tipo ?? "producao";
  const osPiLabel = tipoForn === "midia" ? "PI" : "OS";

  async function handleSalvarOsPi() {
    setSalvandoOsPi(true);
    setErroOsPi(null);
    try {
      const res = await fetch("/api/faturamento-fornecedores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ffId: row.id, numeroOsPi: osPiInput.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setErroOsPi(data.error ?? "Erro ao salvar");
        return;
      }
      const val = osPiInput.trim() || null;
      setOsPiLocal(val);
      onOsPiChange(row.id, val);
      setEditandoOsPi(false);
    } catch {
      setErroOsPi("Erro ao salvar");
    } finally {
      setSalvandoOsPi(false);
    }
  }

  function abrirEdicaoContato() {
    setContatoInput({ nome: contatoLocal.nome, wa: contatoLocal.wa, email: contatoLocal.email });
    setErroContato(null);
    setEditandoContato(true);
  }

  async function handleSalvarContato() {
    setSalvandoContato(true);
    setErroContato(null);
    try {
      const res = await fetch(`/api/fornecedores/${row.fornecedor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contato_nome:      contatoInput.nome.trim()  || null,
          contato_whatsapp:  contatoInput.wa.trim()    || null,
          contato_email:     contatoInput.email.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setErroContato(data.error ?? "Erro ao salvar");
        return;
      }
      const novo = {
        nome:  contatoInput.nome.trim()  || "",
        wa:    contatoInput.wa.trim()    || "",
        email: contatoInput.email.trim() || "",
      };
      setContatoLocal(novo);
      onContatoChange(row.id, {
        contato_nome:      novo.nome  || null,
        contato_whatsapp:  novo.wa    || null,
        contato_email:     novo.email || null,
      });
      setEditandoContato(false);
    } catch {
      setErroContato("Erro ao salvar");
    } finally {
      setSalvandoContato(false);
    }
  }

  const hasOrcDocs  = (row.documentos ?? []).some(
    (d) => d.tipo === "orcamento_2" || d.tipo === "orcamento_3",
  );
  const orcEnabled  = row.orcamentos_internos_habilitado ?? false;
  const orcDotColor = orcEnabled ? "#2E60FF" : "#CBD5E1";

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
          backgroundColor: semContato ? "#FFFBEB" : isRespondeu ? "#F0FDF4" : undefined,
        }}
      >
        {/* Fornecedor */}
        <td className="px-5 py-3.5">
          <p className="text-sm font-medium" style={{ color: "#0F172A" }}>{row.fornecedor.razao_social}</p>

          {/* Alerta: dados de contato faltando */}
          {semContato && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: "#D97706" }} />
              <span className="text-xs font-medium" style={{ color: "#D97706" }}>Dados de contato incompletos</span>
            </div>
          )}

          {/* Exibição do contato atual */}
          {!semContato && (
            <div className="mt-0.5">
              {contatoLocal.nome && (
                <p className="text-xs" style={{ color: "#334155" }}>{contatoLocal.nome}</p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {contatoLocal.wa && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                    <span className="text-xs font-mono" style={{ color: "#64748B" }}>{contatoLocal.wa}</span>
                  </div>
                )}
                {contatoLocal.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                    <span className="text-xs" style={{ color: "#64748B" }}>{contatoLocal.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botão editar / adicionar contato */}
          <button
            onClick={abrirEdicaoContato}
            className="flex items-center gap-1 mt-1 group"
            title="Editar dados de contato"
          >
            <Edit2 className="w-3 h-3" style={{ color: semContato ? "#D97706" : "#CBD5E1" }} />
            <span
              className="text-xs"
              style={{ color: semContato ? "#D97706" : "#94A3B8" }}
            >
              {semContato ? "Adicionar contato" : "Editar contato"}
            </span>
          </button>

          {/* OS / PI inline */}
          <div className="mt-1">
            {editandoOsPi ? (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: "#64748B" }}>{osPiLabel}:</span>
                <input
                  autoFocus
                  value={osPiInput}
                  onChange={(e) => setOsPiInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSalvarOsPi(); if (e.key === "Escape") { setEditandoOsPi(false); setOsPiInput(osPiLocal ?? ""); } }}
                  placeholder={`Nº ${osPiLabel}`}
                  className="text-xs px-1.5 py-0.5 rounded border outline-none font-mono w-24"
                  style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                />
                <button
                  onClick={handleSalvarOsPi}
                  disabled={salvandoOsPi}
                  className="text-xs px-2 py-0.5 rounded font-medium text-white"
                  style={{ backgroundColor: salvandoOsPi ? "#94A3B8" : "#2E60FF" }}
                >
                  {salvandoOsPi ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
                </button>
                <button
                  onClick={() => { setEditandoOsPi(false); setOsPiInput(osPiLocal ?? ""); setErroOsPi(null); }}
                  className="text-xs" style={{ color: "#94A3B8" }}
                >×</button>
                {erroOsPi && <span className="text-xs" style={{ color: "#DC2626" }}>{erroOsPi}</span>}
              </div>
            ) : (
              <button
                onClick={() => { setOsPiInput(osPiLocal ?? ""); setEditandoOsPi(true); }}
                className="flex items-center gap-1 group"
                title={`Editar número ${osPiLabel}`}
              >
                <span className="text-xs font-semibold" style={{ color: "#64748B" }}>{osPiLabel}:</span>
                <span className="text-xs font-mono" style={{ color: osPiLocal ? "#0F172A" : "#CBD5E1" }}>
                  {osPiLocal ?? "—"}
                </span>
                <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#94A3B8" }} />
              </button>
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

        {/* Ações */}
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Enviar — desabilitado sem contato */}
            {semContato ? (
              <span
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium cursor-not-allowed"
                style={{ backgroundColor: "#F1F5F9", color: "#CBD5E1" }}
                title="Adicione WhatsApp ou e-mail antes de enviar"
              >
                <Send className="w-3 h-3" />
                Enviar
              </span>
            ) : (
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
            )}

            {/* Agendar */}
            {!semContato && (
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
            )}

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

            {/* Orçamentos internos */}
            {hasOrcDocs && (
              <button
                onClick={() => setMostrarOrc((v) => !v)}
                className="relative flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                style={{
                  backgroundColor: mostrarOrc ? "#EEF2FF" : "#F8FAFC",
                  color:           mostrarOrc ? "#2E60FF" : "#64748B",
                }}
                title="Orçamentos internos (2 e 3)"
              >
                <FileText className="w-3 h-3" />
                Orç.
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                  style={{ backgroundColor: orcDotColor }}
                />
              </button>
            )}

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

      {/* Painel de orçamentos (toggle por fornecedor) */}
      {mostrarOrc && (
        <OrcamentosPanel row={row} onToggle={onToggle} />
      )}

      {/* Edição de contato inline */}
      {editandoContato && (
        <tr style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: semContato ? "#FFFBEB" : "#F8FAFC" }}>
          <td colSpan={6} className="px-5 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium" style={{ color: "#64748B" }}>Nome do contato</label>
                <input
                  autoFocus
                  value={contatoInput.nome}
                  onChange={(e) => setContatoInput((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: João Silva"
                  className="text-xs px-2 py-1.5 rounded-lg border outline-none bg-white w-40"
                  style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium" style={{ color: "#64748B" }}>WhatsApp</label>
                <input
                  value={contatoInput.wa}
                  onChange={(e) => setContatoInput((p) => ({ ...p, wa: e.target.value }))}
                  placeholder="5511999999999"
                  className="text-xs px-2 py-1.5 rounded-lg border outline-none bg-white font-mono w-36"
                  style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium" style={{ color: "#64748B" }}>E-mail</label>
                <input
                  type="email"
                  value={contatoInput.email}
                  onChange={(e) => setContatoInput((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contato@empresa.com"
                  className="text-xs px-2 py-1.5 rounded-lg border outline-none bg-white w-48"
                  style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <button
                  onClick={handleSalvarContato}
                  disabled={salvandoContato}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                  style={{ backgroundColor: salvandoContato ? "#94A3B8" : "#2E60FF" }}
                >
                  {salvandoContato ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  {salvandoContato ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={() => { setEditandoContato(false); setErroContato(null); }}
                  className="text-xs" style={{ color: "#94A3B8" }}
                >
                  Cancelar
                </button>
                {erroContato && <span className="text-xs" style={{ color: "#DC2626" }}>⚠ {erroContato}</span>}
              </div>
            </div>
          </td>
        </tr>
      )}

      {/* Agendamento inline */}
      {mostrarAg && (
        <tr style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: "#FFFBEB" }}>
          <td colSpan={6} className="px-5 py-3">
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

  const pendentes = rows.filter((r) =>
    (r.dispStatus === "nao_enviado" || r.dispStatus === "falhou") &&
    (r.fornecedor.contato_whatsapp || r.fornecedor.contato_email)
  );

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

  function handleToggle(ffId: string, enabled: boolean) {
    setFfs((prev) =>
      prev.map((ff) =>
        ff.id !== ffId ? ff : { ...ff, orcamentos_internos_habilitado: enabled },
      ),
    );
  }

  function handleOsPiChange(ffId: string, value: string | null) {
    setFfs((prev) =>
      prev.map((ff) =>
        ff.id !== ffId ? ff : { ...ff, numero_os_pi: value },
      ),
    );
  }

  function handleContatoChange(ffId: string, contato: { contato_nome: string | null; contato_whatsapp: string | null; contato_email: string | null }) {
    setFfs((prev) =>
      prev.map((ff) =>
        ff.id !== ffId ? ff : { ...ff, fornecedor: { ...ff.fornecedor, ...contato } },
      ),
    );
  }


  const rows = useMemo(() => ffs.map(computeRow), [ffs]);

  const kpi = useMemo(() => ({
    total:       rows.length,
    enviados:    rows.filter((r) => r.dispStatus === "enviado").length,
    responderam: rows.filter((r) => r.docStatus  === "respondeu").length,
    pendentes:   rows.filter((r) => r.dispStatus === "nao_enviado" || r.dispStatus === "falhou").length,
    agendados:   rows.filter((r) => r.dispStatus === "agendado").length,
    falhou:      rows.filter((r) => r.dispStatus === "falhou").length,
    semContato:  rows.filter((r) => !r.fornecedor.contato_whatsapp && !r.fornecedor.contato_email).length,
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
        if (filtroStatus === "sem_contato"  && (r.fornecedor.contato_whatsapp || r.fornecedor.contato_email)) return false;
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        <KpiCard label="Total"        value={kpi.total}       color="#334155" bg="#F8FAFC" />
        <KpiCard label="Enviados"     value={kpi.enviados}    color="#2E60FF" bg="#EEF2FF" />
        <KpiCard label="Responderam"  value={kpi.responderam} color="#059669" bg="#ECFDF5" />
        <KpiCard label="Pendentes"    value={kpi.pendentes}   color="#D97706" bg="#FFFBEB" />
        <KpiCard label="Agendados"    value={kpi.agendados}   color="#7C3AED" bg="#F5F3FF" />
        <KpiCard label="Falhou"       value={kpi.falhou}      color="#DC2626" bg="#FEF2F2" />
        {kpi.semContato > 0 && (
          <KpiCard label="Sem contato" value={kpi.semContato} color="#92400E" bg="#FEF3C7" />
        )}
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
          <option value="sem_contato">⚠ Sem contato</option>
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
                    <Row key={row.id} row={row} onAtualizar={handleAtualizar} onCadencia={setCadenciaFfId} onRemover={onRemover ? handleRemover : undefined} onToggle={handleToggle} onOsPiChange={handleOsPiChange} onContatoChange={handleContatoChange} />
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

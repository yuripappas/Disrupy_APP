"use client";

import { useState } from "react";
import {
  X, CheckCircle, Clock, SkipForward, Mail, MessageSquare,
  AlertCircle, Edit2, Calendar, Loader2,
} from "lucide-react";
import type { FFRow } from "./MonitoramentoClient";

// ── Types ──────────────────────────────────────────────────────────────────────

type DisparoEnriquecido = {
  id: string;
  status: string;
  tipo: string;
  subtipo?: string | null;
  created_at: string;
  enviado_em: string | null;
  agendado_para: string | null;
};

type StepStatus = "sent" | "failed" | "scheduled" | "skipped" | "pending";

type StepDef = {
  step: string;
  nome: string;
  descricao: string;
  dias: number | null;
  whatsapp: boolean;
  email: boolean;
  isEvento: boolean;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const CADENCIA: StepDef[] = [
  { step: "link_inicial", nome: "Envio do Link",  descricao: "Link do portal enviado ao fornecedor",  dias: 0, whatsapp: true,  email: true,  isEvento: false },
  { step: "lembrete_1",   nome: "Lembrete 1",      descricao: "2 dias sem preencher a documentação",  dias: 2, whatsapp: true,  email: true,  isEvento: false },
  { step: "lembrete_2",   nome: "Lembrete 2",      descricao: "3 dias sem preencher a documentação",  dias: 3, whatsapp: false, email: true,  isEvento: false },
  { step: "lembrete_3",   nome: "Lembrete 3",      descricao: "4 dias sem preencher a documentação",  dias: 4, whatsapp: false, email: true,  isEvento: false },
  { step: "lembrete_4",   nome: "Lembrete 4",      descricao: "5 dias sem preencher a documentação",  dias: 5, whatsapp: true,  email: true,  isEvento: false },
];

const EVENTOS: StepDef[] = [
  { step: "confirmacao",  nome: "Confirmação",     descricao: "Quando todos os documentos forem preenchidos", dias: null, whatsapp: false, email: true, isEvento: true },
  { step: "divergencia",  nome: "Divergência",     descricao: "Quando um documento for reprovado",            dias: null, whatsapp: true,  email: true, isEvento: true },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function minDtLocal() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

// ── ChannelPill ───────────────────────────────────────────────────────────────

function ChannelPill({
  icon: Icon,
  label,
  activeColor,
  active,
  failed,
  scheduled,
}: {
  icon: React.ElementType;
  label: string;
  activeColor: string;
  active: boolean;
  failed: boolean;
  scheduled: boolean;
}) {
  const color  = active ? activeColor : failed ? "#DC2626" : scheduled ? "#D97706" : "#CBD5E1";
  const bg     = active ? (activeColor === "#16A34A" ? "#DCFCE7" : "#EEF2FF")
               : failed ? "#FEF2F2" : scheduled ? "#FFFBEB" : "#F1F5F9";
  const mark   = active ? "✓✓" : failed ? "✗" : scheduled ? "⏰" : "–";
  const markColor = active ? activeColor : failed ? "#DC2626" : scheduled ? "#D97706" : "#CBD5E1";

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
      style={{ backgroundColor: bg }}>
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-xs font-semibold" style={{ color: markColor }}>{mark}</span>
      <span className="text-xs" style={{ color }}>{label}</span>
    </div>
  );
}

// ── EditDateForm ──────────────────────────────────────────────────────────────

function EditDateForm({
  disparoId,
  currentDate,
  onSalvo,
  onCancelar,
}: {
  disparoId: string;
  currentDate: string | null;
  onSalvo: (novaData: string) => void;
  onCancelar: () => void;
}) {
  const [novaData, setNovaData] = useState(currentDate ? toDatetimeLocal(currentDate) : "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState<string | null>(null);

  async function salvar() {
    if (!novaData) return;
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/disparos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: disparoId, agendado_para: new Date(novaData).toISOString() }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Erro"); }
      onSalvo(new Date(novaData).toISOString());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <input
        type="datetime-local"
        value={novaData}
        min={minDtLocal()}
        onChange={(e) => setNovaData(e.target.value)}
        className="text-xs px-2 py-1 rounded-lg border outline-none bg-white"
        style={{ borderColor: "#7C3AED", color: "#334155" }}
      />
      <button
        onClick={salvar}
        disabled={!novaData || salvando}
        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium text-white"
        style={{ backgroundColor: !novaData || salvando ? "#94A3B8" : "#7C3AED" }}
      >
        {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
        {salvando ? "Salvando…" : "Confirmar"}
      </button>
      <button onClick={onCancelar} className="text-xs" style={{ color: "#94A3B8" }}>Cancelar</button>
      {erro && <span className="text-xs" style={{ color: "#DC2626" }}>{erro}</span>}
    </div>
  );
}

// ── StepRow ───────────────────────────────────────────────────────────────────

function StepRow({
  stepDef,
  disparos,
  inicialDate,
  jaRespondeu,
  showLine,
}: {
  stepDef: StepDef;
  disparos: DisparoEnriquecido[];
  inicialDate: Date | null;
  jaRespondeu: boolean;
  showLine: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [localDisparos, setLocalDisparos] = useState(disparos);

  const byStep = localDisparos.filter((d) =>
    stepDef.isEvento
      ? d.subtipo === stepDef.step
      : (d.subtipo === stepDef.step || (stepDef.step === "link_inicial" && !d.subtipo)),
  );

  const wasSent     = byStep.some((d) => d.status === "enviado");
  const hasFailed   = byStep.some((d) => d.status === "falhou");
  const isScheduled = byStep.some((d) => d.status === "agendado");
  const agendadoDsp = byStep.find((d) => d.status === "agendado");

  let stepStatus: StepStatus;
  if (wasSent)                                                    stepStatus = "sent";
  else if (hasFailed)                                             stepStatus = "failed";
  else if (isScheduled)                                           stepStatus = "scheduled";
  else if (jaRespondeu && stepDef.step !== "link_inicial")        stepStatus = "skipped";
  else                                                            stepStatus = "pending";

  const lastSent = byStep
    .filter((d) => d.status === "enviado")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const scheduledDate =
    inicialDate && stepDef.dias !== null ? addDays(inicialDate, stepDef.dias) : null;

  // Status icon config
  const iconCfg = {
    sent:      { Icon: CheckCircle, color: "#16A34A", bg: "#DCFCE7", border: "#16A34A" },
    failed:    { Icon: AlertCircle, color: "#DC2626", bg: "#FEF2F2", border: "#DC2626" },
    scheduled: { Icon: Clock,       color: "#D97706", bg: "#FFFBEB", border: "#D97706" },
    skipped:   { Icon: SkipForward, color: "#94A3B8", bg: "#F1F5F9", border: "#CBD5E1" },
    pending:   { Icon: Clock,       color: "#CBD5E1", bg: "#F8FAFC", border: "#E2E8F0" },
  }[stepStatus];
  const { Icon: StatusIcon } = iconCfg;

  // Per-channel sent/failed/scheduled
  const waSent      = byStep.some(d => d.tipo !== "email" && d.status === "enviado");
  const waFailed    = !waSent && byStep.some(d => d.tipo !== "email" && d.status === "falhou");
  const waScheduled = !waSent && !waFailed && byStep.some(d => d.tipo !== "email" && d.status === "agendado");
  const mailSent    = byStep.some(d => d.tipo === "email" && d.status === "enviado");
  const mailFailed  = !mailSent && byStep.some(d => d.tipo === "email" && d.status === "falhou");
  const mailSched   = !mailSent && !mailFailed && byStep.some(d => d.tipo === "email" && d.status === "agendado");

  // Date label
  let dataLabel: string;
  let dataValue: string | null = null;
  if (stepStatus === "sent") {
    dataLabel = fmt(lastSent?.enviado_em ?? lastSent?.created_at);
  } else if (stepStatus === "scheduled" && agendadoDsp) {
    dataLabel = `Agendado para ${fmt(agendadoDsp.agendado_para)}`;
    dataValue = agendadoDsp.agendado_para;
  } else if (stepStatus === "skipped") {
    dataLabel = "Pulado — fornecedor já respondeu";
  } else if (stepDef.isEvento) {
    dataLabel = stepDef.descricao;
  } else if (scheduledDate) {
    dataLabel = `Previsto: ${fmtDate(scheduledDate.toISOString())} (Dia ${stepDef.dias})`;
  } else {
    dataLabel = "Aguardando envio do link inicial";
  }

  function handleSalvoData(novaData: string) {
    if (agendadoDsp) {
      setLocalDisparos((prev) =>
        prev.map((d) => d.id === agendadoDsp.id ? { ...d, agendado_para: novaData } : d)
      );
    }
    setEditando(false);
  }

  const canEdit = stepStatus === "scheduled" && agendadoDsp;

  return (
    <div className="flex items-start gap-3">
      {/* Timeline dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ backgroundColor: iconCfg.bg, border: `2px solid ${iconCfg.border}` }}
        >
          <StatusIcon className="w-3.5 h-3.5" style={{ color: iconCfg.color }} />
        </div>
        {showLine && (
          <div className="w-0.5 h-4 mt-1" style={{ backgroundColor: "#F1F5F9" }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>
            {stepDef.nome}
          </span>
          {wasSent && byStep.length > 1 && (
            <span className="text-xs" style={{ color: "#94A3B8" }}>
              ({byStep.filter((d) => d.status === "enviado").length}x enviado)
            </span>
          )}
        </div>

        {/* Data */}
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs" style={{ color: "#94A3B8" }}>{dataLabel}</p>
          {canEdit && !editando && (
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded hover:bg-slate-100"
              style={{ color: "#7C3AED" }}
              title="Ajustar data"
            >
              <Edit2 className="w-2.5 h-2.5" /> Ajustar
            </button>
          )}
        </div>

        {/* Edit form */}
        {editando && agendadoDsp && (
          <EditDateForm
            disparoId={agendadoDsp.id}
            currentDate={dataValue}
            onSalvo={handleSalvoData}
            onCancelar={() => setEditando(false)}
          />
        )}

        {/* Canais */}
        {(stepDef.whatsapp || stepDef.email) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {stepDef.whatsapp && (
              <ChannelPill
                icon={MessageSquare}
                label="WhatsApp"
                activeColor="#16A34A"
                active={waSent}
                failed={waFailed}
                scheduled={waScheduled}
              />
            )}
            {stepDef.email && (
              <ChannelPill
                icon={Mail}
                label="Email"
                activeColor="#2E60FF"
                active={mailSent}
                failed={mailFailed}
                scheduled={mailSched}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CadenciaModal ─────────────────────────────────────────────────────────────

export function CadenciaModal({
  ff,
  onClose,
}: {
  ff: FFRow & { envio_inicial_em?: string | null };
  onClose: () => void;
}) {
  const disparos = (ff.disparos ?? []) as DisparoEnriquecido[];

  const docsTotal  = ff.documentos?.length ?? 0;
  const docsFilled = ff.documentos?.filter((d) => d.status !== "pendente").length ?? 0;
  const jaRespondeu = docsTotal > 0 && docsFilled === docsTotal;

  const inicialDate = ff.envio_inicial_em ? new Date(ff.envio_inicial_em) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "#F1F5F9" }}>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-base" style={{ color: "#0F172A" }}>
              Cadência de Mensagens
            </h2>
            <p className="text-sm mt-0.5 truncate" style={{ color: "#334155" }}>
              {ff.fornecedor.razao_social}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "#94A3B8" }}>
              {ff.faturamento.nome_campanha}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors ml-3 flex-shrink-0"
            style={{ color: "#64748B" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status bar */}
        <div
          className="px-5 py-2.5 border-b flex items-center gap-3 text-xs flex-wrap"
          style={{ borderColor: "#F1F5F9", backgroundColor: "#F8FAFC" }}
        >
          <span style={{ color: "#64748B" }}>Documentos:</span>
          <span className="font-medium" style={{
            color: docsTotal === 0 ? "#94A3B8" : jaRespondeu ? "#059669" : "#D97706",
          }}>
            {docsTotal === 0 ? "Sem documentos"
              : jaRespondeu ? `✓ Todos preenchidos (${docsTotal}/${docsTotal})`
              : `${docsFilled}/${docsTotal} preenchidos`}
          </span>
          {inicialDate && (
            <>
              <span style={{ color: "#E2E8F0" }}>·</span>
              <span style={{ color: "#64748B" }}>Início:</span>
              <span className="font-medium" style={{ color: "#334155" }}>
                {fmt(inicialDate.toISOString())}
              </span>
            </>
          )}
        </div>

        {/* Legenda canais */}
        <div className="px-5 py-2 border-b flex items-center gap-4 text-xs flex-wrap"
          style={{ borderColor: "#F1F5F9" }}>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" style={{ color: "#16A34A" }} />
            <span className="font-bold" style={{ color: "#16A34A" }}>✓✓</span>
            <span style={{ color: "#64748B" }}>WhatsApp enviado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" style={{ color: "#2E60FF" }} />
            <span className="font-bold" style={{ color: "#2E60FF" }}>✓✓</span>
            <span style={{ color: "#64748B" }}>Email enviado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" style={{ color: "#CBD5E1" }} />
            <span style={{ color: "#CBD5E1" }}>–</span>
            <span style={{ color: "#94A3B8" }}>Não enviado</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Cadence steps */}
          <div className="space-y-1 mb-4">
            {CADENCIA.map((stepDef, i) => (
              <StepRow
                key={stepDef.step}
                stepDef={stepDef}
                disparos={disparos}
                inicialDate={inicialDate}
                jaRespondeu={jaRespondeu}
                showLine={i < CADENCIA.length - 1}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-3">
            <div className="h-px flex-1" style={{ backgroundColor: "#F1F5F9" }} />
            <span className="text-xs font-medium" style={{ color: "#94A3B8" }}>
              Eventos automáticos
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: "#F1F5F9" }} />
          </div>

          {/* Event steps */}
          <div className="space-y-1">
            {EVENTOS.map((stepDef, i) => (
              <StepRow
                key={stepDef.step}
                stepDef={stepDef}
                disparos={disparos}
                inicialDate={inicialDate}
                jaRespondeu={jaRespondeu}
                showLine={i < EVENTOS.length - 1}
              />
            ))}
          </div>

          {/* Contact info */}
          <div className="mt-4 p-3 rounded-lg space-y-1.5" style={{ backgroundColor: "#F8FAFC" }}>
            <div className="flex items-center gap-2 text-xs">
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#94A3B8" }} />
              <span style={{ color: "#64748B" }}>WhatsApp: </span>
              <span className="font-mono font-medium" style={{ color: "#334155" }}>
                {ff.fornecedor.contato_whatsapp}
              </span>
            </div>
            {ff.fornecedor.contato_email && (
              <div className="flex items-center gap-2 text-xs">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#94A3B8" }} />
                <span style={{ color: "#64748B" }}>Email: </span>
                <span className="font-medium" style={{ color: "#334155" }}>
                  {ff.fornecedor.contato_email}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

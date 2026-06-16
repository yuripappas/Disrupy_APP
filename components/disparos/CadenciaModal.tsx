"use client";

import {
  X, CheckCircle, Clock, SkipForward, Mail, MessageSquare, AlertCircle,
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

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── StatusIcon ────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: StepStatus }) {
  const map = {
    sent:      { Icon: CheckCircle, color: "#16A34A", bg: "#DCFCE7", border: "#16A34A" },
    failed:    { Icon: AlertCircle, color: "#DC2626", bg: "#FEF2F2", border: "#DC2626" },
    scheduled: { Icon: Clock,       color: "#D97706", bg: "#FFFBEB", border: "#D97706" },
    skipped:   { Icon: SkipForward, color: "#94A3B8", bg: "#F1F5F9", border: "#CBD5E1" },
    pending:   { Icon: Clock,       color: "#CBD5E1", bg: "#F8FAFC", border: "#E2E8F0" },
  }[status];
  const { Icon, color, bg, border } = map;
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: bg, border: `2px solid ${border}` }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color }} />
    </div>
  );
}

// ── ChannelStatus ─────────────────────────────────────────────────────────────

function ChannelStatus({
  icon: Icon,
  label,
  color,
  sent,
  failed,
  scheduled,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  sent: boolean;
  failed: boolean;
  scheduled: boolean;
}) {
  const statusColor = sent ? "#16A34A" : failed ? "#DC2626" : scheduled ? "#D97706" : "#CBD5E1";
  const statusIcon  = sent ? "✓" : failed ? "✗" : scheduled ? "⏰" : "–";
  return (
    <div className="flex items-center gap-1">
      <Icon className="w-3 h-3" style={{ color }} />
      <span className="text-xs font-medium" style={{ color: statusColor }}>{statusIcon}</span>
      <span className="text-xs" style={{ color: "#94A3B8" }}>{label}</span>
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
  const byStep = disparos.filter((d) =>
    stepDef.isEvento
      ? d.subtipo === stepDef.step
      : (d.subtipo === stepDef.step || (stepDef.step === "link_inicial" && !d.subtipo)),
  );

  const wasSent    = byStep.some((d) => d.status === "enviado");
  const hasFailed  = byStep.some((d) => d.status === "falhou");
  const isScheduled = byStep.some((d) => d.status === "agendado");

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

  let subLabel: string;
  if (stepStatus === "sent") {
    subLabel = `Enviado em ${fmt(lastSent?.enviado_em ?? lastSent?.created_at)}`;
  } else if (stepStatus === "failed") {
    subLabel = "Falhou ao enviar";
  } else if (stepStatus === "scheduled") {
    const ag = byStep.find((d) => d.status === "agendado");
    subLabel = `Agendado para ${fmt(ag?.agendado_para)}`;
  } else if (stepStatus === "skipped") {
    subLabel = "Não necessário — fornecedor já respondeu";
  } else if (stepDef.isEvento) {
    subLabel = stepDef.descricao;
  } else if (scheduledDate) {
    subLabel = `Previsto para ${scheduledDate.toLocaleDateString("pt-BR")} (Dia ${stepDef.dias})`;
  } else {
    subLabel = "Aguardando envio do link inicial";
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <StatusIcon status={stepStatus} />
        {showLine && (
          <div className="w-0.5 h-4 mt-1" style={{ backgroundColor: "#F1F5F9" }} />
        )}
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "#0F172A" }}>
            {stepDef.nome}
          </span>
          {wasSent && byStep.length > 1 && (
            <span className="text-xs" style={{ color: "#94A3B8" }}>
              ({byStep.filter((d) => d.status === "enviado").length}x enviado)
            </span>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{subLabel}</p>
        {/* Status por canal */}
        <div className="flex items-center gap-3 mt-1.5">
          {stepDef.whatsapp && (
            <ChannelStatus
              icon={MessageSquare}
              label="WhatsApp"
              color="#16A34A"
              sent={byStep.filter(d => d.tipo !== "email" && d.status === "enviado").length > 0}
              failed={!byStep.some(d => d.tipo !== "email" && d.status === "enviado") && byStep.some(d => d.tipo !== "email" && d.status === "falhou")}
              scheduled={!byStep.some(d => d.tipo !== "email" && (d.status === "enviado" || d.status === "falhou")) && byStep.some(d => d.tipo !== "email" && d.status === "agendado")}
            />
          )}
          {stepDef.email && (
            <ChannelStatus
              icon={Mail}
              label="Email"
              color="#2E60FF"
              sent={byStep.filter(d => d.tipo === "email" && d.status === "enviado").length > 0}
              failed={!byStep.some(d => d.tipo === "email" && d.status === "enviado") && byStep.some(d => d.tipo === "email" && d.status === "falhou")}
              scheduled={!byStep.some(d => d.tipo === "email" && (d.status === "enviado" || d.status === "falhou")) && byStep.some(d => d.tipo === "email" && d.status === "agendado")}
            />
          )}
        </div>
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
          <span
            className="font-medium"
            style={{
              color: docsTotal === 0 ? "#94A3B8" : jaRespondeu ? "#059669" : "#D97706",
            }}
          >
            {docsTotal === 0
              ? "Sem documentos"
              : jaRespondeu
              ? `✓ Todos preenchidos (${docsTotal}/${docsTotal})`
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

          {/* Phone info */}
          <div
            className="mt-4 p-3 rounded-lg flex items-center gap-2 text-xs"
            style={{ backgroundColor: "#F8FAFC" }}
          >
            <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#94A3B8" }} />
            <span style={{ color: "#64748B" }}>WhatsApp: </span>
            <span className="font-mono font-medium" style={{ color: "#334155" }}>
              {ff.fornecedor.contato_whatsapp}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

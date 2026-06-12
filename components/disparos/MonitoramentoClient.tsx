"use client";

import { useMemo, useState } from "react";
import {
  Send, Clock, CheckCircle, XCircle, Calendar, Search,
  ChevronDown, ChevronUp, Loader2, MessageSquare, Phone,
  Filter, ExternalLink, GitBranch,
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
  envio_inicial_em?: string | null;
  faturamento: { id: string; nome_campanha: string; iclips_job_id: string | null };
  fornecedor:  { id: string; razao_social: string; cnpj: string; contato_nome: string | null; contato_whatsapp: string };
  documentos:  DocumentoRecord[];
  disparos:    DisparoRecord[];
};

type DocStatus   = "sem_docs" | "pendente" | "parcial" | "respondeu";
type DispStatus  = "nao_enviado" | "agendado" | "enviado" | "falhou";

type ComputedRow = FFRow & { docStatus: DocStatus; dispStatus: DispStatus; ultimoDisparo: DisparoRecord | null };

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

  return { ...ff, docStatus, dispStatus, ultimoDisparo };
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

// ── DispBadge ─────────────────────────────────────────────────────────────────

function DispBadge({ status }: { status: DispStatus }) {
  const cfg = {
    nao_enviado: { label: "Não enviado", color: "#94A3B8", bg: "#F1F5F9", Icon: Clock },
    agendado:    { label: "Agendado",    color: "#D97706", bg: "#FFFBEB", Icon: Calendar },
    enviado:     { label: "Enviado",     color: "#2E60FF", bg: "#EEF2FF", Icon: Send },
    falhou:      { label: "Falhou",      color: "#DC2626", bg: "#FEF2F2", Icon: XCircle },
  }[status];
  const { Icon } = cfg;
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

// ── HistoricoPanel ────────────────────────────────────────────────────────────

function HistoricoPanel({ disparos }: { disparos: DisparoRecord[] }) {
  if (disparos.length === 0) {
    return <p className="text-xs py-2 px-4" style={{ color: "#94A3B8" }}>Nenhuma mensagem enviada ainda.</p>;
  }
  const sorted = [...disparos].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return (
    <div className="space-y-1 py-2 px-4">
      {sorted.map((d) => {
        const ok = d.status === "enviado";
        const ag = d.status === "agendado";
        return (
          <div key={d.id} className="flex items-center gap-3 text-xs py-1">
            {ok ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#059669" }} />
              : ag ? <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D97706" }} />
              : <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#DC2626" }} />}
            <span className="font-medium" style={{ color: "#334155" }}>
              {ok ? "Enviado" : ag ? "Agendado para" : "Falhou"}
            </span>
            <span style={{ color: "#94A3B8" }}>
              {ok ? formatDt(d.enviado_em ?? d.created_at)
                : ag ? formatDt(d.agendado_para)
                : formatDt(d.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({
  row,
  onAtualizar,
  onCadencia,
}: {
  row: ComputedRow;
  onAtualizar: (ffId: string, disparo: DisparoRecord) => void;
  onCadencia: (ff: FFRow) => void;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [enviando, setEnviando]     = useState(false);
  const [agendando, setAgendando]   = useState(false);
  const [mostrarAg, setMostrarAg]   = useState(false);
  const [dataAg, setDataAg]         = useState("");
  const [erro, setErro]             = useState<string | null>(null);
  const [enviado, setEnviado]       = useState(false);

  const portalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${row.link_token}`;

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
    onAtualizar(row.id, {
      id: data.id ?? "tmp-" + Date.now(),
      tipo: "whatsapp",
      subtipo: "link_inicial",
      status: "enviado",
      created_at: new Date().toISOString(),
      enviado_em: new Date().toISOString(),
      agendado_para: null,
    });
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

  const docsFilled = (row.documentos ?? []).filter((d) => d.status !== "pendente").length;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors" style={{ borderBottom: "1px solid #F1F5F9" }}>
        {/* Fornecedor */}
        <td className="px-5 py-3.5">
          <p className="text-sm font-medium" style={{ color: "#0F172A" }}>{row.fornecedor.razao_social}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3" style={{ color: "#94A3B8" }} />
            <span className="text-xs font-mono" style={{ color: "#64748B" }}>
              {row.fornecedor.contato_whatsapp}
            </span>
            {row.fornecedor.contato_nome && (
              <span className="text-xs" style={{ color: "#94A3B8" }}>· {row.fornecedor.contato_nome}</span>
            )}
          </div>
        </td>

        {/* Faturamento */}
        <td className="px-5 py-3.5">
          <p className="text-sm" style={{ color: "#334155" }}>{row.faturamento.nome_campanha}</p>
          {row.faturamento.iclips_job_id && (
            <p className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>{row.faturamento.iclips_job_id}</p>
          )}
        </td>

        {/* Documentos */}
        <td className="px-5 py-3.5">
          <DocBadge status={row.docStatus} total={row.documentos.length} filled={docsFilled} />
        </td>

        {/* Último disparo */}
        <td className="px-5 py-3.5">
          <DispBadge status={row.dispStatus} />
          {row.ultimoDisparo && (
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              {formatDt(row.ultimoDisparo.enviado_em ?? row.ultimoDisparo.agendado_para ?? row.ultimoDisparo.created_at)}
            </p>
          )}
        </td>

        {/* Ações */}
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Enviar agora */}
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

            {/* Histórico */}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{
                backgroundColor: expanded ? "#EEF2FF" : "#F1F5F9",
                color: expanded ? "#2E60FF" : "#64748B",
              }}
            >
              <MessageSquare className="w-3 h-3" />
              {row.disparos?.length ?? 0}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {/* Cadência */}
            <button
              onClick={() => onCadencia(row)}
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
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
              style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {erro && <p className="text-xs mt-1" style={{ color: "#DC2626" }}>⚠ {erro}</p>}
        </td>
      </tr>

      {/* Agendamento inline */}
      {mostrarAg && (
        <tr style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: "#FFFBEB" }}>
          <td colSpan={5} className="px-5 py-3">
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

      {/* Histórico de mensagens */}
      {expanded && (
        <tr style={{ borderBottom: "1px solid #F1F5F9", backgroundColor: "#F8FAFC" }}>
          <td colSpan={5}>
            <HistoricoPanel disparos={row.disparos ?? []} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function MonitoramentoClient({ ffs: initialFfs }: { ffs: FFRow[] }) {
  const [ffs, setFfs]                         = useState<FFRow[]>(initialFfs);
  const [filtroFat, setFiltroFat]             = useState("todos");
  const [filtroStatus, setFiltroStatus]       = useState("todos");
  const [busca, setBusca]                     = useState("");
  const [cadenciaFf, setCadenciaFf]           = useState<FFRow | null>(null);

  // Adiciona disparo localmente (otimistic update)
  function handleAtualizar(ffId: string, disparo: DisparoRecord) {
    setFfs((prev) =>
      prev.map((ff) =>
        ff.id !== ffId ? ff : { ...ff, disparos: [disparo, ...(ff.disparos ?? [])] },
      ),
    );
  }

  const rows = useMemo(() => ffs.map(computeRow), [ffs]);

  // KPIs
  const kpi = useMemo(() => ({
    total:      rows.length,
    enviados:   rows.filter((r) => r.dispStatus === "enviado").length,
    responderam:rows.filter((r) => r.docStatus  === "respondeu").length,
    pendentes:  rows.filter((r) => r.dispStatus === "nao_enviado" || r.dispStatus === "falhou").length,
    agendados:  rows.filter((r) => r.dispStatus === "agendado").length,
    falhou:     rows.filter((r) => r.dispStatus === "falhou").length,
  }), [rows]);

  // Faturamentos únicos para o filtro
  const faturamentos = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.faturamento.id, r.faturamento.nome_campanha));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  // Filtragem
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filtroFat !== "todos" && r.faturamento.id !== filtroFat) return false;
      if (filtroStatus !== "todos") {
        if (filtroStatus === "nao_enviado" && r.dispStatus !== "nao_enviado") return false;
        if (filtroStatus === "agendado"    && r.dispStatus !== "agendado")    return false;
        if (filtroStatus === "enviado"     && r.dispStatus !== "enviado")     return false;
        if (filtroStatus === "falhou"      && r.dispStatus !== "falhou")      return false;
        if (filtroStatus === "respondeu"   && r.docStatus  !== "respondeu")   return false;
        if (filtroStatus === "pendente_doc"&& r.docStatus  !== "pendente" && r.docStatus !== "parcial") return false;
      }
      if (busca) {
        const q = busca.toLowerCase();
        if (
          !r.fornecedor.razao_social.toLowerCase().includes(q) &&
          !r.faturamento.nome_campanha.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, filtroFat, filtroStatus, busca]);

  return (
    <div>
      {/* Cadência modal */}
      {cadenciaFf && (
        <CadenciaModal
          ff={cadenciaFf}
          onClose={() => setCadenciaFf(null)}
        />
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
        {/* Busca */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor ou campanha..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none bg-white"
            style={{ borderColor: "#E2E8F0", color: "#334155" }}
          />
        </div>

        {/* Faturamento */}
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

        {/* Status */}
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
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
                  Fornecedor
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
                  Campanha
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
                  Documentos
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
                  Último disparo
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Row key={row.id} row={row} onAtualizar={handleAtualizar} onCadencia={setCadenciaFf} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

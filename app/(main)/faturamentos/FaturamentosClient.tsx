"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus, FileSpreadsheet, ChevronRight, FileText, Trash2,
  Search, X, ChevronDown,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NovoFaturamentoModal } from "@/components/faturamentos/NovoFaturamentoModal";
import { ImportarIClipsModal } from "@/components/faturamentos/ImportarIClipsModal";
import { DeletarFaturamentoModal } from "@/components/faturamentos/DeletarFaturamentoModal";

const ETAPA_NOME: Record<number, string> = {
  1: "Enviar Faturamento",
  2: "Documentação Fornecedores",
  3: "Documentação Agência",
  4: "Revisão do Processo",
  5: "Publicação",
  6: "Concluído",
};

const CLIENTE_TIPO: Record<string, { label: string; color: string }> = {
  governo_al: { label: "Governo AL", color: "#00246D" },
  sebrae:     { label: "SEBRAE",     color: "#2E60FF" },
  prefeitura: { label: "Prefeitura", color: "#7C3AED" },
  brk:        { label: "BRK",        color: "#059669" },
  outro:      { label: "Outro",      color: "#64748B" },
};

type Faturamento = {
  id: string; nome_campanha: string; cliente_nome: string; cliente_tipo: string;
  iclips_job_id?: string; empenho?: string; secretaria?: string;
  status: string; etapa_atual: number; valor_total: number; updated_at: string;
};

type ViewMode = "ativos" | "concluidos" | "todos";
type DeleteTarget = { id: string; nome_campanha: string };

function ProgressBar({ etapaAtual }: { etapaAtual: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-1.5 flex-1 rounded-full" style={{
          backgroundColor:
            i < etapaAtual - 1 ? "#10B981" :
            i === etapaAtual - 1 ? "#2E60FF" :
            "#E2E8F0",
        }} />
      ))}
    </div>
  );
}

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium transition-all"
      style={{
        borderColor:   active ? "#2E60FF" : "#E2E8F0",
        background:    active ? "#EEF2FF" : "white",
        color:         active ? "#2E60FF" : "#64748B",
        fontWeight:    active ? "600" : "500",
      }}
    >
      {children}
    </button>
  );
}

export function FaturamentosClient({
  faturamentos, isGestor,
}: { faturamentos: Faturamento[]; isGestor: boolean }) {
  const [modalOpen,    setModalOpen]    = useState(false);
  const [importOpen,   setImportOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [viewMode,        setViewMode]        = useState<ViewMode>("ativos");
  const [busca,           setBusca]           = useState("");
  const [filtroInconf,    setFiltroInconf]    = useState(false);
  const [filtroEtapa3,    setFiltroEtapa3]    = useState(false);
  const [filtroPublicacao, setFiltroPublicacao] = useState(false);
  const [filtroCliente,   setFiltroCliente]   = useState("");

  // ── Derived counts (always from full list) ─────────────────────────────────
  const totalAtivos    = useMemo(() => faturamentos.filter((f) => f.status !== "concluido" && f.status !== "cancelado").length, [faturamentos]);
  const totalConcluidos = useMemo(() => faturamentos.filter((f) => f.status === "concluido").length, [faturamentos]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtrados = useMemo(() => {
    let list = faturamentos;

    if (viewMode === "ativos")    list = list.filter((f) => f.status !== "concluido" && f.status !== "cancelado");
    if (viewMode === "concluidos") list = list.filter((f) => f.status === "concluido");

    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter((f) =>
        f.nome_campanha.toLowerCase().includes(q) ||
        f.cliente_nome.toLowerCase().includes(q) ||
        (f.empenho ?? "").toLowerCase().includes(q) ||
        (f.iclips_job_id ?? "").toLowerCase().includes(q),
      );
    }

    if (filtroInconf)    list = list.filter((f) => f.status === "inconformidade");
    if (filtroEtapa3)    list = list.filter((f) => f.etapa_atual === 3);
    if (filtroPublicacao) list = list.filter((f) => f.etapa_atual === 5);
    if (filtroCliente)   list = list.filter((f) => f.cliente_tipo === filtroCliente);

    return list;
  }, [faturamentos, viewMode, busca, filtroInconf, filtroEtapa3, filtroPublicacao, filtroCliente]);

  // ── Active chips ───────────────────────────────────────────────────────────
  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (filtroInconf)    chips.push({ key: "inconf",    label: "Inconformidade",       remove: () => setFiltroInconf(false) });
  if (filtroEtapa3)    chips.push({ key: "etapa3",    label: "Docs Agência (Et. 3)", remove: () => setFiltroEtapa3(false) });
  if (filtroPublicacao) chips.push({ key: "pub",       label: "Publicação (Et. 5)",   remove: () => setFiltroPublicacao(false) });
  if (filtroCliente)   chips.push({ key: "cliente",   label: CLIENTE_TIPO[filtroCliente]?.label ?? filtroCliente, remove: () => setFiltroCliente("") });

  const hasFilters = !!(busca.trim() || filtroInconf || filtroEtapa3 || filtroPublicacao || filtroCliente);

  function clearAll() {
    setBusca(""); setFiltroInconf(false); setFiltroEtapa3(false);
    setFiltroPublicacao(false); setFiltroCliente("");
  }

  return (
    <div className="p-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Faturamentos</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {totalAtivos} em andamento · {totalConcluidos} concluídos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors hover:bg-slate-50"
            style={{ borderColor: "#E2E8F0", color: "#334155" }}
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: "#059669" }} />
            Importar do iClips
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#2E60FF" }}
          >
            <Plus className="w-4 h-4" /> Novo Faturamento
          </button>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-white p-4 mb-5 space-y-3" style={{ borderColor: "#E2E8F0" }}>
        {/* Row 1: search + view toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#94A3B8" }} />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar campanha, cliente, empenho…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none transition-all"
              style={{ borderColor: "#E2E8F0", color: "#0F172A", fontSize: "13px" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#2E60FF")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E2E8F0")}
            />
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden flex-shrink-0" style={{ borderColor: "#E2E8F0" }}>
            {(["ativos", "concluidos", "todos"] as ViewMode[]).map((v) => {
              const labels: Record<ViewMode, string> = { ativos: "Ativos", concluidos: "Concluídos", todos: "Todos" };
              return (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className="px-3 py-2 text-xs font-semibold transition-colors border-r last:border-r-0"
                  style={{
                    borderColor: "#E2E8F0",
                    background: viewMode === v ? "#EEF2FF" : "white",
                    color:      viewMode === v ? "#2E60FF" : "#64748B",
                  }}
                >
                  {labels[v]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: quick pills + cliente select */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: "#94A3B8" }}>Filtrar:</span>

          <Pill active={filtroInconf}    onClick={() => setFiltroInconf(!filtroInconf)}>Inconformidade</Pill>
          <Pill active={filtroEtapa3}    onClick={() => setFiltroEtapa3(!filtroEtapa3)}>Docs Agência</Pill>
          <Pill active={filtroPublicacao} onClick={() => setFiltroPublicacao(!filtroPublicacao)}>Publicação</Pill>

          {/* Cliente tipo */}
          <div className="relative">
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="appearance-none pr-6 pl-3 py-1 rounded-full border text-xs font-medium cursor-pointer transition-all outline-none"
              style={{
                borderColor: filtroCliente ? "#2E60FF" : "#E2E8F0",
                background:  filtroCliente ? "#EEF2FF" : "white",
                color:       filtroCliente ? "#2E60FF" : "#64748B",
                fontWeight:  filtroCliente ? "600" : "500",
              }}
            >
              <option value="">Tipo cliente</option>
              {Object.entries(CLIENTE_TIPO).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
              style={{ color: filtroCliente ? "#2E60FF" : "#94A3B8" }}
            />
          </div>
        </div>

        {/* Row 3: active chips (only when filters applied) */}
        {chips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t" style={{ borderColor: "#F1F5F9" }}>
            <span className="text-xs" style={{ color: "#94A3B8" }}>Ativos:</span>
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: "#EEF2FF", color: "#2E60FF" }}
              >
                {chip.label}
                <button onClick={chip.remove} className="ml-0.5 hover:opacity-60 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearAll}
              className="text-xs underline transition-colors"
              style={{ color: "#94A3B8" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#2E60FF")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* Result count */}
      {hasFilters && (
        <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>
          {filtrados.length} resultado{filtrados.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      {filtrados.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#F1F5F9" }}>
            <FileText className="w-8 h-8" style={{ color: "#94A3B8" }} />
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: "#0F172A" }}>
            {hasFilters ? "Nenhum resultado encontrado" : "Nenhum faturamento ainda"}
          </p>
          <p className="text-sm" style={{ color: "#64748B" }}>
            {hasFilters ? "Tente ajustar os filtros." : "Crie o primeiro faturamento para começar."}
          </p>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="mt-4 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ background: "#EEF2FF", color: "#2E60FF" }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((fat) => {
            const tipo        = CLIENTE_TIPO[fat.cliente_tipo] ?? { label: fat.cliente_tipo, color: "#64748B" };
            const isConcluido = fat.status === "concluido";
            const isInconf    = fat.status === "inconformidade";
            return (
              <Link
                key={fat.id}
                href={`/faturamentos/${fat.id}`}
                className="block rounded-xl border bg-white p-5 hover:shadow-sm transition-all duration-150 group"
                style={{ borderColor: isInconf ? "#FECACA" : "#E2E8F0", opacity: isConcluido ? 0.7 : 1 }}
              >
                <div className="flex items-start gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: tipo.color }}
                      >
                        {tipo.label}
                      </span>
                      {fat.iclips_job_id && (
                        <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>{fat.iclips_job_id}</span>
                      )}
                      {fat.empenho && (
                        <span className="text-xs" style={{ color: "#94A3B8" }}>· Empenho {fat.empenho}</span>
                      )}
                      {isInconf && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#FEE2E2", color: "#DC2626" }}>
                          Inconformidade
                        </span>
                      )}
                      {isConcluido && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#DCFCE7", color: "#059669" }}>
                          Concluído
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-base mb-0.5" style={{ color: "#0F172A" }}>{fat.nome_campanha}</h3>
                    <p className="text-sm" style={{ color: "#64748B" }}>
                      {fat.cliente_nome}{fat.secretaria ? ` · ${fat.secretaria}` : ""}
                    </p>
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs" style={{ color: "#94A3B8" }}>
                          Etapa {fat.etapa_atual} de 6 — {ETAPA_NOME[fat.etapa_atual] ?? "Em andamento"}
                        </span>
                      </div>
                      <ProgressBar etapaAtual={fat.etapa_atual} />
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-xl font-bold" style={{ color: "#0F172A" }}>{formatCurrency(fat.valor_total)}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Atualizado {formatDate(fat.updated_at)}</p>
                    <div className="mt-3 flex items-center justify-end gap-3">
                      <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#2E60FF" }}>
                        Ver detalhes <ChevronRight className="w-3 h-3" />
                      </span>
                      {isGestor && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteTarget({ id: fat.id, nome_campanha: fat.nome_campanha });
                          }}
                          title="Excluir faturamento"
                          className="p-1 rounded-md hover:bg-red-50 transition-colors"
                          style={{ color: "#CBD5E1" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#DC2626")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#CBD5E1")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <NovoFaturamentoModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ImportarIClipsModal open={importOpen} onClose={() => setImportOpen(false)} />
      {deleteTarget && (
        <DeletarFaturamentoModal
          faturamento={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

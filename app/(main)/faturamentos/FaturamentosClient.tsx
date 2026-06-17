"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FileSpreadsheet, ChevronRight, FileText, Trash2 } from "lucide-react";
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

const clienteTipo: Record<string, { label: string; color: string }> = {
  governo_al: { label: "Governo AL", color: "#00246D" },
  sebrae: { label: "SEBRAE", color: "#2E60FF" },
  prefeitura: { label: "Prefeitura", color: "#7C3AED" },
  brk: { label: "BRK", color: "#059669" },
  outro: { label: "Outro", color: "#64748B" },
};

type Faturamento = {
  id: string; nome_campanha: string; cliente_nome: string; cliente_tipo: string;
  iclips_job_id?: string; empenho?: string; secretaria?: string;
  status: string; etapa_atual: number; valor_total: number; updated_at: string;
};

function ProgressBar({ etapaAtual }: { etapaAtual: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-1.5 flex-1 rounded-full" style={{
          backgroundColor: i < etapaAtual - 1 ? "#10B981" : i === etapaAtual - 1 ? "#2E60FF" : "#E2E8F0"
        }} />
      ))}
    </div>
  );
}

type DeleteTarget = { id: string; nome_campanha: string };

export function FaturamentosClient({ faturamentos, isGestor }: { faturamentos: Faturamento[]; isGestor: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const ativos = faturamentos.filter((f) => f.status !== "concluido" && f.status !== "cancelado");
  const concluidos = faturamentos.filter((f) => f.status === "concluido");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Faturamentos</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {ativos.length} em andamento · {concluidos.length} concluídos
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

      {faturamentos.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#EEF2FF" }}>
            <FileText className="w-8 h-8" style={{ color: "#2E60FF" }} />
          </div>
          <p className="text-lg font-semibold mb-1" style={{ color: "#0F172A" }}>Nenhum faturamento ainda</p>
          <p className="text-sm" style={{ color: "#64748B" }}>Crie o primeiro faturamento para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {faturamentos.map((fat) => {
            const tipo = clienteTipo[fat.cliente_tipo] ?? { label: fat.cliente_tipo, color: "#64748B" };
            return (
              <Link key={fat.id} href={`/faturamentos/${fat.id}`}
                className="block rounded-xl border bg-white p-5 hover:shadow-sm transition-all duration-150 group"
                style={{ borderColor: "#E2E8F0" }}
              >
                <div className="flex items-start gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-white" style={{ backgroundColor: tipo.color }}>{tipo.label}</span>
                      {fat.iclips_job_id && <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>{fat.iclips_job_id}</span>}
                      {fat.empenho && <span className="text-xs" style={{ color: "#94A3B8" }}>· Empenho {fat.empenho}</span>}
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

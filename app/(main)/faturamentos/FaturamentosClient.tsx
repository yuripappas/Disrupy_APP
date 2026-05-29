"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, FileSpreadsheet, ChevronRight, Clock, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NovoFaturamentoModal } from "@/components/faturamentos/NovoFaturamentoModal";
import { ImportarIClipsModal } from "@/components/faturamentos/ImportarIClipsModal";

const statusLabel: Record<string, string> = {
  aguardando_inicio: "Aguardando Início",
  docs_fornecedores: "Docs. Fornecedores",
  revisao_docs: "Revisão de Docs.",
  docs_agencia: "Docs. Agência",
  revisao_processo: "Revisão do Processo",
  publicacao: "Publicação",
  aguardando_validacao: "Aguardando Validação",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const statusColor: Record<string, { bg: string; text: string }> = {
  aguardando_inicio: { bg: "#F1F5F9", text: "#64748B" },
  docs_fornecedores: { bg: "#EEF2FF", text: "#2E60FF" },
  revisao_docs: { bg: "#FFFBEB", text: "#D97706" },
  docs_agencia: { bg: "#F5F3FF", text: "#7C3AED" },
  revisao_processo: { bg: "#FFFBEB", text: "#D97706" },
  publicacao: { bg: "#ECFDF5", text: "#059669" },
  aguardando_validacao: { bg: "#F0FDFA", text: "#0891B2" },
  concluido: { bg: "#ECFDF5", text: "#059669" },
  cancelado: { bg: "#FEF2F2", text: "#DC2626" },
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
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-1.5 flex-1 rounded-full" style={{
          backgroundColor: i < etapaAtual - 1 ? "#2E60FF" : i === etapaAtual - 1 ? "#00E7FF" : "#E2E8F0"
        }} />
      ))}
    </div>
  );
}

export function FaturamentosClient({ faturamentos }: { faturamentos: Faturamento[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
          <p className="text-sm mb-6" style={{ color: "#64748B" }}>Crie o primeiro faturamento para começar.</p>
          <button onClick={() => setModalOpen(true)} className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: "#2E60FF" }}>
            + Novo Faturamento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {faturamentos.map((fat) => {
            const tipo = clienteTipo[fat.cliente_tipo] ?? { label: fat.cliente_tipo, color: "#64748B" };
            const status = statusColor[fat.status] ?? { bg: "#F1F5F9", text: "#64748B" };
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
                        <span className="text-xs" style={{ color: "#94A3B8" }}>Etapa {fat.etapa_atual} de 8</span>
                      </div>
                      <ProgressBar etapaAtual={fat.etapa_atual} />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md mb-3" style={{ backgroundColor: status.bg, color: status.text }}>
                      {fat.status === "aguardando_inicio" && <Clock className="w-3 h-3" />}
                      {statusLabel[fat.status] ?? fat.status}
                    </div>
                    <p className="text-xl font-bold" style={{ color: "#0F172A" }}>{formatCurrency(fat.valor_total)}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>Atualizado {formatDate(fat.updated_at)}</p>
                    <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium" style={{ color: "#2E60FF" }}>
                      Ver detalhes <ChevronRight className="w-3 h-3" />
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
    </div>
  );
}

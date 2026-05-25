import Link from "next/link";
import { Plus, ChevronRight, Clock, AlertCircle } from "lucide-react";
import { mockFaturamentos } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Faturamento } from "@/types";

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

function EtapasProgress({ fat }: { fat: Faturamento }) {
  return (
    <div className="flex items-center gap-0.5">
      {fat.etapas.map((etapa) => (
        <div
          key={etapa.numero}
          className="h-1.5 flex-1 rounded-full"
          style={{
            backgroundColor:
              etapa.status === "concluida"
                ? "#2E60FF"
                : etapa.status === "em_andamento"
                ? "#00E7FF"
                : etapa.status === "inconformidade"
                ? "#EF4444"
                : "#E2E8F0",
          }}
          title={`${etapa.numero}. ${etapa.nome}: ${etapa.status}`}
        />
      ))}
    </div>
  );
}

export default function FaturamentosPage() {
  const ativos = mockFaturamentos.filter(
    (f) => f.status !== "concluido" && f.status !== "cancelado"
  );
  const concluidos = mockFaturamentos.filter((f) => f.status === "concluido");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>
            Faturamentos
          </h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {ativos.length} em andamento · {concluidos.length} concluídos
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#2E60FF" }}
        >
          <Plus className="w-4 h-4" />
          Novo Faturamento
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {mockFaturamentos.map((fat) => {
          const tipo = clienteTipo[fat.cliente_tipo];
          const status = statusColor[fat.status];
          const fornsPendentes = fat.fornecedores.filter((fp) =>
            fp.documentos.some((d) => d.status === "pendente")
          ).length;

          return (
            <Link
              key={fat.id}
              href={`/faturamentos/${fat.id}`}
              className="block rounded-xl border bg-white p-5 hover:shadow-sm transition-all duration-150 group"
              style={{ borderColor: "#E2E8F0" }}
            >
              <div className="flex items-start gap-5">
                {/* Left: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: tipo.color }}
                    >
                      {tipo.label}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>
                      {fat.iclips_job_id}
                    </span>
                    {fat.empenho && (
                      <span className="text-xs" style={{ color: "#94A3B8" }}>
                        · Empenho {fat.empenho}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-base mb-0.5" style={{ color: "#0F172A" }}>
                    {fat.nome_campanha}
                  </h3>
                  <p className="text-sm" style={{ color: "#64748B" }}>
                    {fat.cliente_nome}
                    {fat.secretaria ? ` · ${fat.secretaria}` : ""}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: "#94A3B8" }}>
                        Etapa {fat.etapa_atual} de {fat.etapas.length}
                      </span>
                      <span className="text-xs font-medium" style={{ color: "#64748B" }}>
                        {fat.etapas.find((e) => e.numero === fat.etapa_atual)?.nome}
                      </span>
                    </div>
                    <EtapasProgress fat={fat} />
                  </div>
                </div>

                {/* Right: meta */}
                <div className="flex-shrink-0 text-right">
                  <div
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md mb-3"
                    style={{ backgroundColor: status.bg, color: status.text }}
                  >
                    {fat.status === "aguardando_inicio" && <Clock className="w-3 h-3" />}
                    {statusLabel[fat.status]}
                  </div>

                  <p className="text-xl font-bold" style={{ color: "#0F172A" }}>
                    {formatCurrency(fat.valor_total)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    Atualizado {formatDate(fat.atualizado_em)}
                  </p>

                  {fornsPendentes > 0 && (
                    <div
                      className="flex items-center gap-1 mt-2 text-xs justify-end"
                      style={{ color: "#D97706" }}
                    >
                      <AlertCircle className="w-3 h-3" />
                      {fornsPendentes} forn. c/ docs pendentes
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-1 text-xs font-medium group-hover:gap-2 transition-all" style={{ color: "#2E60FF" }}>
                    Ver detalhes <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

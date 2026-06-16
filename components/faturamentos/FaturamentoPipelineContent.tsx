"use client";

import { useState, useMemo } from "react";
import {
  Send, Eye, BookOpen, CheckCircle2, FileArchive, FileStack,
} from "lucide-react";
import { PipelineSection } from "@/components/faturamentos/PipelineSection";
import { DocumentacaoSection } from "@/components/faturamentos/DocumentacaoSection";
import { Etapa4Section } from "@/components/faturamentos/Etapa4Section";
import { MonitoramentoClient, FFRow } from "@/components/disparos/MonitoramentoClient";
import { FaturamentoDetailClient } from "@/app/(main)/faturamentos/[id]/FaturamentoDetailClient";
import { formatCurrency } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type EtapaStatus = "concluida" | "em_andamento" | "inconformidade" | "pendente";

interface Etapa {
  id: string;
  numero: number;
  nome: string;
  status: EtapaStatus;
  retornos: number;
  inconformidade_motivo?: string | null;
}

interface FornecedorNf {
  ffId: string;
  razaoSocial: string;
  cnpj: string | null;
  valor: number;
  valorNf: string | null;
  numeroNf: string | null;
  nfStatus: string | null;
}

interface Certidao {
  id: string;
  tipo: string;
  label: string;
  arquivo_url: string | null;
  nome_arquivo: string | null;
  tamanho_bytes: number | null;
}

interface ValorCards {
  totalRepasse: number;
  repasseMidia: number;
  repasseProducao: number;
  honorariosMidia: number;
  honorariosProducao: number;
  totalHonorarios: number;
  valorCustosInternos: number;
  valorTotal: number;
}

interface Props {
  faturamentoId: string;
  nomeCampanha: string;
  jobId: string | null;
  propostaId: string | null;
  clienteTipo: string;
  clienteNome: string;
  etapas: Etapa[];
  isRevisor: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fornecedores: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custosInternos: any[];
  fornecedoresNf: FornecedorNf[];
  certidoesIniciais: Certidao[];
  fornecedoresJaAdicionados: string[];
  valorCards: ValorCards;
}

// ── EtapaBanner ──────────────────────────────────────────────────────────────

function EtapaBanner({
  icon: Icon, title, descricao,
}: {
  icon: React.ElementType;
  title: string;
  descricao: string;
}) {
  return (
    <div
      className="flex items-start gap-3 px-5 py-3.5 rounded-xl mb-5"
      style={{ backgroundColor: "#EEF2FF", border: "1px solid #C7D2FE" }}
    >
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#2E60FF" }} />
      <div>
        <p className="text-xs font-semibold" style={{ color: "#1E40AF" }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "#3730A3" }}>{descricao}</p>
      </div>
    </div>
  );
}

// ── ValorCards ───────────────────────────────────────────────────────────────

function ValorCardsRow({ v }: { v: ValorCards }) {
  const hasValues = v.totalRepasse > 0 || v.totalHonorarios > 0 || v.valorCustosInternos > 0;
  if (!hasValues) return null;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Repasse Fornecedores</p>
        <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(v.totalRepasse)}</p>
        <div className="mt-1.5 space-y-0.5">
          {v.repasseProducao > 0 && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#94A3B8" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: "#7C3AED" }} />
              Produção: {formatCurrency(v.repasseProducao)}
            </p>
          )}
          {v.repasseMidia > 0 && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#94A3B8" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: "#2E60FF" }} />
              Mídia: {formatCurrency(v.repasseMidia)}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Honorários Agência</p>
        <p className="text-lg font-bold" style={{ color: "#059669" }}>{formatCurrency(v.totalHonorarios)}</p>
        <div className="mt-1.5 space-y-0.5">
          {v.honorariosProducao > 0 && (
            <p className="text-xs" style={{ color: "#94A3B8" }}>Produção: {formatCurrency(v.honorariosProducao)}</p>
          )}
          {v.honorariosMidia > 0 && (
            <p className="text-xs" style={{ color: "#94A3B8" }}>Mídia: {formatCurrency(v.honorariosMidia)}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Custos Internos</p>
        <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(v.valorCustosInternos)}</p>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "#2E60FF", backgroundColor: "#EEF2FF" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#2E60FF" }}>Total do Cliente</p>
        <p className="text-lg font-bold" style={{ color: "#00246D" }}>{formatCurrency(v.valorTotal)}</p>
        <p className="text-xs mt-1" style={{ color: "#2E60FF" }}>repasse + hon. + interno</p>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function FaturamentoPipelineContent({
  faturamentoId, nomeCampanha, jobId, propostaId, clienteTipo, clienteNome,
  etapas, isRevisor, fornecedores, custosInternos,
  fornecedoresNf, certidoesIniciais, fornecedoresJaAdicionados, valorCards,
}: Props) {
  const etapaAtual = etapas.find((e) => e.status === "em_andamento");
  const [selectedEtapa, setSelectedEtapa] = useState(etapaAtual?.numero ?? 1);

  // Converte FF[] → FFRow[] para o MonitoramentoClient da Etapa 2
  const ffRows = useMemo((): FFRow[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (fornecedores as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((ff: any) => ff.associado !== false && ff.fornecedor?.contato_whatsapp && ff.link_token)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((ff: any): FFRow => ({
        id: ff.id,
        link_token: ff.link_token,
        valor_total: ff.valor_total,
        faturamento: { id: faturamentoId, nome_campanha: nomeCampanha, iclips_job_id: jobId },
        fornecedor: {
          id: ff.fornecedor.id,
          razao_social: ff.fornecedor.razao_social,
          cnpj: ff.fornecedor.cnpj,
          contato_nome: ff.fornecedor.contato_nome,
          contato_whatsapp: ff.fornecedor.contato_whatsapp,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        documentos: (ff.documentos ?? []).map((d: any) => ({ id: d.id, status: d.status })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        disparos: (ff.disparos ?? []).map((d: any) => ({
          id: d.id,
          status: d.status,
          tipo: "whatsapp",
          subtipo: "link_inicial" as const,
          created_at: d.created_at,
          enviado_em: d.enviado_em,
          agendado_para: d.agendado_para,
        })),
      }));
  }, [fornecedores, faturamentoId, nomeCampanha, jobId]);

  function renderContent() {
    switch (selectedEtapa) {
      case 1:
        return (
          <div>
            <EtapaBanner
              icon={Send}
              title="Etapa 1 — Envio para Fornecedores"
              descricao="Envie os links de documentação para cada fornecedor via WhatsApp. Use 'Enviar para todos' no grupo para agilizar."
            />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: "#0F172A" }}>Documentação dos Fornecedores</h2>
              {isRevisor && (
                <FaturamentoDetailClient
                  faturamentoId={faturamentoId}
                  fornecedoresJaAdicionados={fornecedoresJaAdicionados}
                />
              )}
            </div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <DocumentacaoSection fornecedores={fornecedores as any} custosInternos={custosInternos as any} isRevisor={isRevisor} />
          </div>
        );

      case 2:
        return (
          <div>
            <EtapaBanner
              icon={Eye}
              title="Etapa 2 — Acompanhar Envios"
              descricao="Monitore o status dos disparos e documentos recebidos. Reenvie ou ajuste cadências conforme necessário."
            />
            {ffRows.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  Nenhum fornecedor elegível para disparo neste faturamento.
                  Verifique se os fornecedores têm WhatsApp cadastrado.
                </p>
              </div>
            ) : (
              <MonitoramentoClient ffs={ffRows} />
            )}
          </div>
        );

      case 3:
        return (
          <div>
            <EtapaBanner
              icon={BookOpen}
              title="Etapa 3 — Revisar Documentos"
              descricao="Verifique os documentos enviados pelos fornecedores. Aprove o que está correto e reprove com motivo o que precisar de correção."
            />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <DocumentacaoSection fornecedores={fornecedores as any} custosInternos={custosInternos as any} isRevisor={isRevisor} />
          </div>
        );

      case 4:
        return (
          <Etapa4Section
            faturamentoId={faturamentoId}
            nomeCampanha={nomeCampanha}
            jobId={jobId}
            propostaId={propostaId}
            clienteTipo={clienteTipo}
            clienteNome={clienteNome}
            fornecedoresNf={fornecedoresNf}
            certidoesIniciais={certidoesIniciais}
          />
        );

      case 5:
        return (
          <div>
            <EtapaBanner
              icon={CheckCircle2}
              title="Etapa 5 — Revisão Final"
              descricao="Revisão final antes do fechamento. Confirme que todos os documentos dos fornecedores estão aprovados e corretos."
            />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <DocumentacaoSection fornecedores={fornecedores as any} custosInternos={custosInternos as any} isRevisor={isRevisor} />
          </div>
        );

      case 6:
        return (
          <div>
            <EtapaBanner
              icon={FileArchive}
              title="Etapa 6 — Gerar PDF do Processo"
              descricao="Organize os grupos de documentos e gere o PDF consolidado do processo para envio ao cliente."
            />
            <div
              className="rounded-xl border p-12 text-center"
              style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}
            >
              <FileStack className="w-10 h-10 mx-auto mb-3" style={{ color: "#CBD5E1" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "#334155" }}>Geração de PDF em desenvolvimento</p>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                Em breve: organizar grupos por arrastar, reordenar e gerar PDF consolidado do processo.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}>
            <p className="text-sm" style={{ color: "#94A3B8" }}>Selecione uma etapa no pipeline acima.</p>
          </div>
        );
    }
  }

  return (
    <div>
      <PipelineSection
        faturamentoId={faturamentoId}
        etapas={etapas}
        isRevisor={isRevisor}
        selectedEtapaNum={selectedEtapa}
        onSelectEtapa={setSelectedEtapa}
      />

      <ValorCardsRow v={valorCards} />

      {renderContent()}
    </div>
  );
}

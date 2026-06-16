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
  countMidia: number;
  countProducao: number;
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
  return (
    <div className="grid grid-cols-5 gap-4 mb-6">
      {/* Fornecedores Mídia */}
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Forn. Mídia</p>
        <p className="text-2xl font-bold" style={{ color: "#2E60FF" }}>{v.countMidia}</p>
        {v.repasseMidia > 0 && (
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{formatCurrency(v.repasseMidia)}</p>
        )}
      </div>

      {/* Fornecedores Produção */}
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Forn. Produção</p>
        <p className="text-2xl font-bold" style={{ color: "#7C3AED" }}>{v.countProducao}</p>
        {v.repasseProducao > 0 && (
          <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{formatCurrency(v.repasseProducao)}</p>
        )}
      </div>

      {/* Honorários */}
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Honorários</p>
        <p className="text-lg font-bold" style={{ color: "#059669" }}>{formatCurrency(v.totalHonorarios)}</p>
      </div>

      {/* Custos Internos */}
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Custos Internos</p>
        <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(v.valorCustosInternos)}</p>
      </div>

      {/* Total */}
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

  // Converte FF[] → FFRow[] para o MonitoramentoClient da Etapa 1
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
        valor: ff.valor ?? 0,
        tipo: ff.fornecedor?.tipo ?? ff.tipo_iclips ?? null,
        faturamento: { id: faturamentoId, nome_campanha: nomeCampanha, iclips_job_id: jobId },
        fornecedor: {
          id: ff.fornecedor.id,
          razao_social: ff.fornecedor.razao_social,
          cnpj: ff.fornecedor.cnpj,
          contato_nome: ff.fornecedor.contato_nome,
          contato_whatsapp: ff.fornecedor.contato_whatsapp,
          contato_email: ff.fornecedor.contato_email ?? null,
          telefone: ff.fornecedor.telefone ?? null,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        documentos: (ff.documentos ?? []).map((d: any) => ({ id: d.id, status: d.status })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        disparos: (ff.disparos ?? []).map((d: any) => ({
          id: d.id,
          status: d.status,
          tipo: d.tipo ?? "whatsapp",
          subtipo: d.subtipo ?? "link_inicial",
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
              title="Etapa 1 — Iniciar Faturamento"
              descricao="Envie os links de documentação para cada fornecedor via WhatsApp. Use 'Enviar para todos' para agilizar. O primeiro envio libera automaticamente a revisão."
            />
            {isRevisor && (
              <div className="flex justify-end mb-4">
                <FaturamentoDetailClient
                  faturamentoId={faturamentoId}
                  fornecedoresJaAdicionados={fornecedoresJaAdicionados}
                />
              </div>
            )}
            {ffRows.length === 0 ? (
              <div className="rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  Nenhum fornecedor elegível. Verifique se os fornecedores têm WhatsApp cadastrado.
                </p>
              </div>
            ) : (
              <MonitoramentoClient ffs={ffRows} />
            )}
          </div>
        );

      case 2:
        return (
          <div>
            <EtapaBanner
              icon={BookOpen}
              title="Etapa 2 — Revisão de Documentação"
              descricao="Verifique os documentos enviados pelos fornecedores. Aprove o que está correto e reprove com motivo o que precisar de correção."
            />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <DocumentacaoSection fornecedores={fornecedores as any} custosInternos={custosInternos as any} isRevisor={isRevisor} />
          </div>
        );

      case 3:
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

      case 4:
        return (
          <div>
            <EtapaBanner
              icon={CheckCircle2}
              title="Etapa 4 — Revisão do Processo"
              descricao="Revisão final antes do fechamento. Confirme que todos os documentos dos fornecedores e da agência estão aprovados e corretos."
            />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <DocumentacaoSection fornecedores={fornecedores as any} custosInternos={custosInternos as any} isRevisor={isRevisor} />
          </div>
        );

      case 5:
        return (
          <div>
            <EtapaBanner
              icon={FileArchive}
              title="Etapa 5 — Publicação"
              descricao="Gere o PDF consolidado do processo e publique a documentação para envio ao cliente."
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

      case 6:
        return (
          <div>
            <EtapaBanner
              icon={Eye}
              title="Etapa 6 — Aguardando Validação"
              descricao="Processo publicado. Aguardando validação pelo cliente ou gestor responsável."
            />
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}>
              <p className="text-sm" style={{ color: "#94A3B8" }}>Em andamento — aguardando resposta.</p>
            </div>
          </div>
        );

      case 7:
        return (
          <div>
            <EtapaBanner
              icon={CheckCircle2}
              title="Etapa 7 — Conclusão"
              descricao="Faturamento concluído. Todos os documentos foram validados e o processo está encerrado."
            />
            <div className="rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}>
              <p className="text-sm font-medium" style={{ color: "#059669" }}>✓ Processo concluído com sucesso.</p>
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

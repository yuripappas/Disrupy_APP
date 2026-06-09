import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Check,
  Clock,
  AlertTriangle,
  FileText,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FaturamentoDetailClient } from "./FaturamentoDetailClient";
import { FornecedorDocumentosSection } from "@/components/faturamentos/FornecedorDocumentosSection";
import { CustosInternosSection } from "@/components/faturamentos/CustosInternosSection";

// ── Visual helpers ──────────────────────────────────────────────────────────

const etapaStatusStyle: Record<string, { ring: string; bg: string; text: string }> = {
  concluida:    { ring: "#2E60FF", bg: "#2E60FF", text: "white" },
  em_andamento: { ring: "#00E7FF", bg: "#00246D", text: "white" },
  inconformidade: { ring: "#EF4444", bg: "#EF4444", text: "white" },
  pendente:     { ring: "#E2E8F0", bg: "white",   text: "#94A3B8" },
};


const clienteTipoLabel: Record<string, string> = {
  governo_al: "Governo de Alagoas",
  sebrae:     "SEBRAE",
  prefeitura: "Prefeitura",
  brk:        "BRK",
  outro:      "Outro",
};

// ── Sub-components ──────────────────────────────────────────────────────────

function EtapaCircle({
  etapa,
  isLast,
}: {
  etapa: { numero: number; nome: string; status: string; retornos: number; inconformidade_motivo?: string | null };
  isLast: boolean;
}) {
  const style = etapaStatusStyle[etapa.status] ?? etapaStatusStyle.pendente;
  const icon =
    etapa.status === "concluida"    ? <Check        className="w-3.5 h-3.5 text-white" /> :
    etapa.status === "em_andamento" ? <Clock        className="w-3.5 h-3.5 text-white" /> :
    etapa.status === "inconformidade" ? <AlertTriangle className="w-3.5 h-3.5 text-white" /> :
    null;

  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold"
          style={{ borderColor: style.ring, backgroundColor: style.bg, color: style.text }}
        >
          {etapa.status === "pendente" ? etapa.numero : icon}
        </div>
        <span
          className="text-xs text-center mt-1.5 max-w-[70px] leading-tight"
          style={{
            color: etapa.status === "em_andamento" ? "#00246D" : etapa.status === "concluida" ? "#2E60FF" : "#94A3B8",
            fontWeight: etapa.status === "em_andamento" ? 600 : 400,
          }}
        >
          {etapa.nome}
        </span>
        {(etapa.retornos ?? 0) > 0 && (
          <span className="text-xs mt-0.5 font-medium" style={{ color: "#EF4444" }}>
            ↩ {etapa.retornos}
          </span>
        )}
      </div>
      {!isLast && (
        <div
          className="h-0.5 w-10 mx-1 flex-shrink-0 mb-7"
          style={{ backgroundColor: etapa.status === "concluida" ? "#2E60FF" : "#E2E8F0" }}
        />
      )}
    </div>
  );
}


// ── Page ────────────────────────────────────────────────────────────────────

export default async function FaturamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const isRevisor = user?.app_metadata?.role === "gestor" || user?.app_metadata?.role === "faturamento";

  const { data: fat } = await supabase
    .from("faturamentos")
    .select(`
      *,
      faturamento_etapas ( id, numero, nome, status, retornos, inconformidade_motivo ),
      faturamento_custos_internos ( id, codigo, servico, qtde, valor_unitario, valor_total ),
      faturamento_fornecedores (
        id, valor, honorarios, valor_total, prazo_dias, status, link_token,
        fornecedor:fornecedores ( razao_social, cnpj, tipo, contato_nome ),
        documentos ( id, tipo, label, status, arquivo_url, reprovacao_motivo )
      )
    `)
    .eq("id", id)
    .single();

  if (!fat) notFound();

  const etapas = (fat.faturamento_etapas ?? []).sort((a: { numero: number }, b: { numero: number }) => a.numero - b.numero);
  const custosInternos = fat.faturamento_custos_internos ?? [];
  const fornecedores = fat.faturamento_fornecedores ?? [];

  const valorFornecedores = fornecedores.reduce((s: number, f: { valor_total: number }) => s + (f.valor_total ?? 0), 0);
  const valorCustosInternos = custosInternos.reduce((s: number, c: { valor_total: number }) => s + (c.valor_total ?? 0), 0);

  // Get fornecedor_ids for the modal (to exclude already-added ones)
  const { data: ffIds } = await supabase
    .from("faturamento_fornecedores")
    .select("fornecedor_id")
    .eq("faturamento_id", id);

  const fornecedoresJaAdicionados = (ffIds ?? []).map((r: { fornecedor_id: string }) => r.fornecedor_id);

  const inconformidade = etapas.find((e: { inconformidade_motivo?: string | null }) => e.inconformidade_motivo);

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/faturamentos" className="flex items-center gap-1 text-sm" style={{ color: "#64748B" }}>
          <ChevronLeft className="w-4 h-4" /> Faturamentos
        </Link>
        <ChevronRight className="w-3 h-3" style={{ color: "#CBD5E1" }} />
        <span className="text-sm font-medium" style={{ color: "#0F172A" }}>
          {fat.iclips_job_id ?? fat.nome_campanha}
        </span>
      </div>

      {/* Header */}
      <div className="rounded-xl border bg-white p-6 mb-6" style={{ borderColor: "#E2E8F0" }}>
        <div className="flex items-start justify-between">
          <div>
            {fat.iclips_job_id && (
              <p className="text-xs font-mono mb-1" style={{ color: "#94A3B8" }}>
                {fat.iclips_job_id}{fat.iclips_proposta_id ? ` · Proposta ${fat.iclips_proposta_id}` : ""}
              </p>
            )}
            <h1 className="text-xl font-bold mb-1" style={{ color: "#0F172A" }}>{fat.nome_campanha}</h1>
            <p className="text-sm" style={{ color: "#64748B" }}>
              {fat.cliente_nome} · {clienteTipoLabel[fat.cliente_tipo] ?? fat.cliente_tipo}
              {fat.secretaria ? ` · ${fat.secretaria}` : ""}
            </p>
            {fat.empenho && (
              <p className="text-xs mt-1 font-mono" style={{ color: "#2E60FF" }}>Empenho: {fat.empenho}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: "#0F172A" }}>{formatCurrency(fat.valor_total ?? 0)}</p>
            <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
              Atualizado em {formatDate(fat.updated_at)}
            </p>
            {(fat.responsavel_midia || fat.responsavel_faturamento) && (
              <div className="flex items-center gap-4 mt-2 text-xs justify-end" style={{ color: "#64748B" }}>
                {fat.responsavel_midia && <span>Mídia: <strong>{fat.responsavel_midia}</strong></span>}
                {fat.responsavel_faturamento && <span>Fat.: <strong>{fat.responsavel_faturamento}</strong></span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="rounded-xl border bg-white p-6 mb-6" style={{ borderColor: "#E2E8F0" }}>
        <h2 className="text-sm font-semibold mb-5" style={{ color: "#0F172A" }}>Pipeline de Etapas</h2>
        <div className="flex items-start overflow-x-auto pb-2">
          {etapas.map((etapa: { numero: number; nome: string; status: string; retornos: number; inconformidade_motivo?: string | null }, i: number) => (
            <EtapaCircle key={etapa.numero} etapa={etapa} isLast={i === etapas.length - 1} />
          ))}
        </div>
        {inconformidade && (
          <div className="mt-4 p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: "#FEF2F2" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: "#991B1B" }}>Inconformidade registrada:</p>
              <p className="text-xs mt-0.5" style={{ color: "#991B1B" }}>{inconformidade.inconformidade_motivo}</p>
            </div>
          </div>
        )}
      </div>

      {/* Valores resumo */}
      {(valorFornecedores > 0 || valorCustosInternos > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Fornecedores</p>
            <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(valorFornecedores)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{fornecedores.length} fornecedor(es)</p>
          </div>
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Custos Internos</p>
            <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(valorCustosInternos)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{custosInternos.length} item(ns)</p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: "#2E60FF", backgroundColor: "#EEF2FF" }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#2E60FF" }}>Total</p>
            <p className="text-lg font-bold" style={{ color: "#00246D" }}>{formatCurrency(fat.valor_total ?? 0)}</p>
          </div>
        </div>
      )}

      {/* Custos Internos */}
      {custosInternos.length > 0 && (
        <CustosInternosSection itens={custosInternos} />
      )}

      {/* Fornecedores */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#0F172A" }}>
            Documentação de Fornecedores
            {fornecedores.length > 0 && (
              <span className="ml-2 text-xs font-normal" style={{ color: "#94A3B8" }}>
                ({fornecedores.length})
              </span>
            )}
          </h2>
          <FaturamentoDetailClient
            faturamentoId={id}
            fornecedoresJaAdicionados={fornecedoresJaAdicionados}
          />
        </div>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <FornecedorDocumentosSection initialFFs={fornecedores as any} isRevisor={isRevisor} />
      </div>
    </div>
  );
}

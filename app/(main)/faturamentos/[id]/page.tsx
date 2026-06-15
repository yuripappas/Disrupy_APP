import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FaturamentoDetailClient } from "./FaturamentoDetailClient";
import { DocumentacaoSection } from "@/components/faturamentos/DocumentacaoSection";
import { PipelineSection } from "@/components/faturamentos/PipelineSection";
import { Etapa4Section } from "@/components/faturamentos/Etapa4Section";

// ── Visual helpers ──────────────────────────────────────────────────────────

const clienteTipoLabel: Record<string, string> = {
  governo_al: "Governo de Alagoas",
  sebrae:     "SEBRAE",
  prefeitura: "Prefeitura",
  brk:        "BRK",
  outro:      "Outro",
};

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
        nome_iclips, associado, tipo_iclips,
        fornecedor:fornecedores ( id, razao_social, cnpj, tipo, contato_nome, contato_whatsapp, contato_email ),
        documentos ( id, tipo, label, status, arquivo_url, reprovacao_motivo,
          numero_nf, numero_nf_status, valor_nf,
          documento_arquivos ( id, arquivo_url, nome_arquivo, tamanho_bytes, created_at ) ),
        disparos ( id, status, created_at, enviado_em, agendado_para )
      )
    `)
    .eq("id", id)
    .single();

  if (!fat) notFound();

  const etapas = (fat.faturamento_etapas ?? []).sort((a: { numero: number }, b: { numero: number }) => a.numero - b.numero);
  const custosInternos = fat.faturamento_custos_internos ?? [];
  const fornecedores = fat.faturamento_fornecedores ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ffMidia    = fornecedores.filter((f: any) => f.fornecedor?.tipo === "midia"    || (f.associado === false && f.tipo_iclips === "midia"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ffProducao = fornecedores.filter((f: any) => f.fornecedor?.tipo === "producao" || (f.associado === false && f.tipo_iclips === "producao"));

  // Repasse = valor base do fornecedor (sem honorários) — o que sai para os fornecedores
  const repasseMidia    = ffMidia.reduce((s: number, f: { valor: number })    => s + (f.valor    ?? 0), 0);
  const repasseProducao = ffProducao.reduce((s: number, f: { valor: number }) => s + (f.valor    ?? 0), 0);

  // Honorários = margem da agência sobre fornecedores externos
  const honorariosMidia    = ffMidia.reduce((s: number, f: { honorarios: number })    => s + (f.honorarios ?? 0), 0);
  const honorariosProducao = ffProducao.reduce((s: number, f: { honorarios: number }) => s + (f.honorarios ?? 0), 0);
  const totalHonorarios    = honorariosMidia + honorariosProducao;

  const valorCustosInternos = custosInternos.reduce((s: number, c: { valor_total: number }) => s + (c.valor_total ?? 0), 0);

  // Totais para os cards de resumo
  const valorMidia    = repasseMidia    + honorariosMidia;
  const valorProducao = repasseProducao + honorariosProducao;
  const totalRepasse  = repasseMidia    + repasseProducao;

  // Get fornecedor_ids for the modal (to exclude already-added ones)
  const { data: ffIds } = await supabase
    .from("faturamento_fornecedores")
    .select("fornecedor_id")
    .eq("faturamento_id", id);

  const fornecedoresJaAdicionados = (ffIds ?? []).map((r: { fornecedor_id: string }) => r.fornecedor_id);

  const { data: certidoesData } = await supabase
    .from("faturamento_certidoes")
    .select("id, tipo, label, arquivo_url, nome_arquivo, tamanho_bytes")
    .eq("faturamento_id", id)
    .order("created_at");

  // Fornecedores com NF para a discriminação (associados, excluindo não-associados)
  // Usa f.valor (repasse base, sem honorários) — evita bitributação na NFS-e da agência
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fornecedoresNf = fornecedores
    .filter((f: any) => f.associado !== false && f.fornecedor)
    .flatMap((f: any) => {
      const nfDoc = (f.documentos ?? []).find((d: any) => d.tipo === "nf");
      if (!nfDoc) return [];
      return [{
        ffId:        f.id,
        razaoSocial: f.fornecedor.razao_social,
        cnpj:        f.fornecedor.cnpj,
        valor:       f.valor ?? 0,           // repasse ao fornecedor (sem honorários)
        valorNf:     nfDoc.valor_nf ?? null, // valor líquido extraído do PDF
        numeroNf:    nfDoc.numero_nf ?? null,
        nfStatus:    nfDoc.numero_nf_status ?? null,
      }];
    });

  return (
    <div className="p-8">
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

      {/* Pipeline interativo */}
      <PipelineSection
        faturamentoId={id}
        etapas={etapas}
        isRevisor={isRevisor}
      />

      {/* Valores resumo — Repasse | Honorários | Custos Internos | Total cliente */}
      {(valorMidia > 0 || valorProducao > 0 || valorCustosInternos > 0) && (
        <div className="grid grid-cols-4 gap-4 mb-6">

          {/* Repasse Fornecedores */}
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Repasse Fornecedores</p>
            <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(totalRepasse)}</p>
            <div className="mt-1.5 space-y-0.5">
              {repasseProducao > 0 && (
                <p className="text-xs flex items-center gap-1" style={{ color: "#94A3B8" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#7C3AED", display: "inline-block" }} />
                  Produção: {formatCurrency(repasseProducao)}
                </p>
              )}
              {repasseMidia > 0 && (
                <p className="text-xs flex items-center gap-1" style={{ color: "#94A3B8" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#2E60FF", display: "inline-block" }} />
                  Mídia: {formatCurrency(repasseMidia)}
                </p>
              )}
            </div>
          </div>

          {/* Honorários da Agência */}
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Honorários Agência</p>
            <p className="text-lg font-bold" style={{ color: "#059669" }}>{formatCurrency(totalHonorarios)}</p>
            <div className="mt-1.5 space-y-0.5">
              {honorariosProducao > 0 && (
                <p className="text-xs" style={{ color: "#94A3B8" }}>Produção: {formatCurrency(honorariosProducao)}</p>
              )}
              {honorariosMidia > 0 && (
                <p className="text-xs" style={{ color: "#94A3B8" }}>Mídia: {formatCurrency(honorariosMidia)}</p>
              )}
            </div>
          </div>

          {/* Custos Internos */}
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>Custos Internos</p>
            <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(valorCustosInternos)}</p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{custosInternos.length} item(ns) da agência</p>
          </div>

          {/* Total cobrado do cliente */}
          <div className="rounded-xl border p-4" style={{ borderColor: "#2E60FF", backgroundColor: "#EEF2FF" }}>
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#2E60FF" }}>Total do Cliente</p>
            <p className="text-lg font-bold" style={{ color: "#00246D" }}>{formatCurrency(fat.valor_total ?? 0)}</p>
            <p className="text-xs mt-1" style={{ color: "#2E60FF" }}>
              repasse + hon. + interno
            </p>
          </div>

        </div>
      )}

      {/* Documentação agrupada — Mídia, Produção, Custos Internos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#0F172A" }}>Documentação dos Fornecedores</h2>
          <FaturamentoDetailClient
            faturamentoId={id}
            fornecedoresJaAdicionados={fornecedoresJaAdicionados}
          />
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <DocumentacaoSection fornecedores={fornecedores as any} custosInternos={custosInternos} isRevisor={isRevisor} />
      </div>

      {/* Etapa 4 — Documentação da Agência */}
      <Etapa4Section
        faturamentoId={id}
        nomeCampanha={fat.nome_campanha}
        jobId={fat.iclips_job_id ?? null}
        propostaId={fat.iclips_proposta_id ?? null}
        clienteTipo={fat.cliente_tipo}
        clienteNome={fat.cliente_nome}
        fornecedoresNf={fornecedoresNf}
        certidoesIniciais={certidoesData ?? []}
      />
    </div>
  );
}

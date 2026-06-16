import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FaturamentoPipelineContent } from "@/components/faturamentos/FaturamentoPipelineContent";

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

  const repasseMidia    = ffMidia.reduce((s: number, f: { valor: number })    => s + (f.valor    ?? 0), 0);
  const repasseProducao = ffProducao.reduce((s: number, f: { valor: number }) => s + (f.valor    ?? 0), 0);
  const honorariosMidia    = ffMidia.reduce((s: number, f: { honorarios: number })    => s + (f.honorarios ?? 0), 0);
  const honorariosProducao = ffProducao.reduce((s: number, f: { honorarios: number }) => s + (f.honorarios ?? 0), 0);
  const totalHonorarios    = honorariosMidia + honorariosProducao;
  const valorCustosInternos = custosInternos.reduce((s: number, c: { valor_total: number }) => s + (c.valor_total ?? 0), 0);
  const totalRepasse = repasseMidia + repasseProducao;

  // Fornecedores JA adicionados (para o modal de adicionar fornecedor)
  const { data: ffIds } = await supabase
    .from("faturamento_fornecedores")
    .select("fornecedor_id")
    .eq("faturamento_id", id);
  const fornecedoresJaAdicionados = (ffIds ?? []).map((r: { fornecedor_id: string }) => r.fornecedor_id);

  // Certidões + documentos agência (empenhos, proposta, evidências, ofício)
  const { data: certidoesData } = await supabase
    .from("faturamento_certidoes")
    .select("id, tipo, label, arquivo_url, nome_arquivo, tamanho_bytes")
    .eq("faturamento_id", id)
    .order("created_at");

  // Fornecedores com NF para a discriminação GISS
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
        valor:       f.valor ?? 0,
        valorNf:     nfDoc.valor_nf ?? null,
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

      {/* Pipeline + conteúdo contextual por etapa */}
      <FaturamentoPipelineContent
        faturamentoId={id}
        nomeCampanha={fat.nome_campanha}
        jobId={fat.iclips_job_id ?? null}
        propostaId={fat.iclips_proposta_id ?? null}
        clienteTipo={fat.cliente_tipo}
        clienteNome={fat.cliente_nome}
        etapas={etapas}
        isRevisor={isRevisor}
        fornecedores={fornecedores}
        custosInternos={custosInternos}
        fornecedoresNf={fornecedoresNf}
        certidoesIniciais={certidoesData ?? []}
        fornecedoresJaAdicionados={fornecedoresJaAdicionados}
        valorCards={{
          totalRepasse,
          repasseMidia,
          repasseProducao,
          honorariosMidia,
          honorariosProducao,
          totalHonorarios,
          valorCustosInternos,
          valorTotal: fat.valor_total ?? 0,
        }}
      />
    </div>
  );
}

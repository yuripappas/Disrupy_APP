import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Check,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FaturamentoDetailClient } from "./FaturamentoDetailClient";

// ── Visual helpers ──────────────────────────────────────────────────────────

const etapaStatusStyle: Record<string, { ring: string; bg: string; text: string }> = {
  concluida:    { ring: "#2E60FF", bg: "#2E60FF", text: "white" },
  em_andamento: { ring: "#00E7FF", bg: "#00246D", text: "white" },
  inconformidade: { ring: "#EF4444", bg: "#EF4444", text: "white" },
  pendente:     { ring: "#E2E8F0", bg: "white",   text: "#94A3B8" },
};

const docStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pendente:  { label: "Pendente",  color: "#94A3B8", bg: "#F1F5F9" },
  enviado:   { label: "Enviado",   color: "#D97706", bg: "#FFFBEB" },
  aprovado:  { label: "Aprovado",  color: "#059669", bg: "#ECFDF5" },
  reprovado: { label: "Reprovado", color: "#DC2626", bg: "#FEF2F2" },
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

function DocumentoRow({
  doc,
}: {
  doc: { tipo: string; label: string; status: string; arquivo_url?: string | null };
}) {
  const cfg = docStatusConfig[doc.status] ?? docStatusConfig.pendente;
  return (
    <div className="flex items-center justify-between py-2.5 px-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
      <div className="flex items-center gap-3">
        <FileText className="w-4 h-4" style={{ color: "#94A3B8" }} />
        <span className="text-sm" style={{ color: "#334155" }}>{doc.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </span>
        {doc.arquivo_url ? (
          <a href={doc.arquivo_url} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Ver arquivo" target="_blank">
            <ExternalLink className="w-3.5 h-3.5" style={{ color: "#2E60FF" }} />
          </a>
        ) : (
          <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Fazer upload">
            <Upload className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          </button>
        )}
      </div>
    </div>
  );
}

function FornecedorCard({ ff }: { ff: {
  id: string; valor: number; honorarios: number; valor_total: number;
  prazo_dias: number; status: string; link_token?: string | null;
  fornecedor: { razao_social: string; cnpj: string; tipo: string; contato_nome?: string | null };
  documentos: { tipo: string; label: string; status: string; arquivo_url?: string | null }[];
} }) {
  const completos = ff.documentos.filter((d) => d.status === "aprovado" || d.status === "enviado").length;
  const total = ff.documentos.length;
  const pct = total > 0 ? Math.round((completos / total) * 100) : 0;

  const statusColor: Record<string, string> = {
    aguardando: "#94A3B8",
    parcial:    "#D97706",
    completo:   "#059669",
  };
  const statusLabel: Record<string, string> = {
    aguardando: "Aguardando",
    parcial:    "Parcial",
    completo:   "Completo",
  };

  return (
    <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: ff.fornecedor.tipo === "midia" ? "#00246D" : "#7C3AED" }}
            >
              {ff.fornecedor.tipo === "midia" ? "Mídia" : "Produção"}
            </span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-md"
              style={{ backgroundColor: (statusColor[ff.status] ?? "#94A3B8") + "20", color: statusColor[ff.status] ?? "#94A3B8" }}
            >
              {statusLabel[ff.status] ?? ff.status}
            </span>
          </div>
          <h4 className="font-semibold text-sm" style={{ color: "#0F172A" }}>{ff.fornecedor.razao_social}</h4>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
            {ff.fornecedor.cnpj}{ff.fornecedor.contato_nome ? ` · ${ff.fornecedor.contato_nome}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: "#0F172A" }}>{formatCurrency(ff.valor_total)}</p>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            {formatCurrency(ff.valor)} + hon. {formatCurrency(ff.honorarios ?? 0)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 justify-end">
            <div className="h-1.5 w-20 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#059669" : "#2E60FF" }} />
            </div>
            <span className="text-xs" style={{ color: "#64748B" }}>{completos}/{total}</span>
          </div>
        </div>
      </div>
      <div>
        {ff.documentos.map((doc) => (
          <DocumentoRow key={doc.tipo} doc={doc} />
        ))}
      </div>
      <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: "#F8FAFC" }}>
        <p className="text-xs" style={{ color: "#94A3B8" }}>Prazo: {ff.prazo_dias} dias úteis</p>
        {ff.link_token && (
          <a
            href={`/portal/${ff.link_token}`}
            target="_blank"
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "#2E60FF" }}
          >
            Link do portal <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
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

  const { data: fat } = await supabase
    .from("faturamentos")
    .select(`
      *,
      faturamento_etapas ( id, numero, nome, status, retornos, inconformidade_motivo ),
      faturamento_custos_internos ( id, codigo, servico, qtde, valor_unitario, valor_total ),
      faturamento_fornecedores (
        id, valor, honorarios, valor_total, prazo_dias, status, link_token,
        fornecedor:fornecedores ( razao_social, cnpj, tipo, contato_nome ),
        documentos ( tipo, label, status, arquivo_url )
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
        <div className="rounded-xl border bg-white mb-6 overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
            <h2 className="text-sm font-semibold" style={{ color: "#0F172A" }}>Custos Internos (Tabela de Preços)</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#F8FAFC" }}>
                <th className="text-left px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Código</th>
                <th className="text-left px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Serviço</th>
                <th className="text-right px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Qtde</th>
                <th className="text-right px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Unit.</th>
                <th className="text-right px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {custosInternos.map((ci: { id: string; codigo?: string; servico: string; qtde: number; valor_unitario: number; valor_total: number }, i: number) => (
                <tr key={ci.id ?? i} style={{ borderTop: "1px solid #F1F5F9" }}>
                  <td className="px-6 py-3 font-mono text-xs" style={{ color: "#64748B" }}>{ci.codigo ?? "—"}</td>
                  <td className="px-6 py-3" style={{ color: "#334155" }}>{ci.servico}</td>
                  <td className="px-6 py-3 text-right" style={{ color: "#334155" }}>{ci.qtde}</td>
                  <td className="px-6 py-3 text-right" style={{ color: "#334155" }}>{formatCurrency(ci.valor_unitario)}</td>
                  <td className="px-6 py-3 text-right font-semibold" style={{ color: "#0F172A" }}>{formatCurrency(ci.valor_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

        {fornecedores.length > 0 ? (
          <div className="space-y-4">
            {fornecedores.map((ff: {
              id: string; valor: number; honorarios: number; valor_total: number;
              prazo_dias: number; status: string; link_token?: string | null;
              fornecedor: { razao_social: string; cnpj: string; tipo: string; contato_nome?: string | null };
              documentos: { tipo: string; label: string; status: string; arquivo_url?: string | null }[];
            }) => (
              <FornecedorCard key={ff.id} ff={ff} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border p-12 text-center" style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}>
            <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "#CBD5E1" }} />
            <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>Nenhum fornecedor adicionado ainda.</p>
            <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>
              Clique em &quot;Adicionar Fornecedor&quot; para começar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

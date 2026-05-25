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
import { mockFaturamentos } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Etapa, FornecedorNoProjeto, DocumentoFornecedor } from "@/types";

const etapaStatusIcon: Record<string, React.ReactNode> = {
  concluida: <Check className="w-3.5 h-3.5 text-white" />,
  em_andamento: <Clock className="w-3.5 h-3.5 text-white" />,
  inconformidade: <AlertTriangle className="w-3.5 h-3.5 text-white" />,
  pendente: null,
};

const etapaStatusStyle: Record<string, { ring: string; bg: string; text: string }> = {
  concluida: { ring: "#2E60FF", bg: "#2E60FF", text: "white" },
  em_andamento: { ring: "#00E7FF", bg: "#00246D", text: "white" },
  inconformidade: { ring: "#EF4444", bg: "#EF4444", text: "white" },
  pendente: { ring: "#E2E8F0", bg: "white", text: "#94A3B8" },
};

const docStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Pendente", color: "#94A3B8", bg: "#F1F5F9" },
  enviado: { label: "Enviado", color: "#D97706", bg: "#FFFBEB" },
  aprovado: { label: "Aprovado", color: "#059669", bg: "#ECFDF5" },
  rejeitado: { label: "Rejeitado", color: "#DC2626", bg: "#FEF2F2" },
};

function EtapaCircle({ etapa, isLast }: { etapa: Etapa; isLast: boolean }) {
  const style = etapaStatusStyle[etapa.status];
  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold"
          style={{
            borderColor: style.ring,
            backgroundColor: style.bg,
            color: style.text,
          }}
        >
          {etapa.status === "pendente" ? etapa.numero : etapaStatusIcon[etapa.status]}
        </div>
        <span
          className="text-xs text-center mt-1.5 max-w-[70px] leading-tight"
          style={{
            color:
              etapa.status === "em_andamento"
                ? "#00246D"
                : etapa.status === "concluida"
                ? "#2E60FF"
                : "#94A3B8",
            fontWeight: etapa.status === "em_andamento" ? 600 : 400,
          }}
        >
          {etapa.nome}
        </span>
        {etapa.retornos > 0 && (
          <span
            className="text-xs mt-0.5 font-medium"
            style={{ color: "#EF4444" }}
          >
            ↩ {etapa.retornos}
          </span>
        )}
      </div>
      {!isLast && (
        <div
          className="h-0.5 w-10 mx-1 flex-shrink-0 mb-7"
          style={{
            backgroundColor: etapa.status === "concluida" ? "#2E60FF" : "#E2E8F0",
          }}
        />
      )}
    </div>
  );
}

function DocumentoRow({ doc }: { doc: DocumentoFornecedor }) {
  const cfg = docStatusConfig[doc.status];
  return (
    <div
      className="flex items-center justify-between py-2.5 px-4"
      style={{ borderBottom: "1px solid #F1F5F9" }}
    >
      <div className="flex items-center gap-3">
        <FileText className="w-4 h-4" style={{ color: "#94A3B8" }} />
        <span className="text-sm" style={{ color: "#334155" }}>
          {doc.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
        {doc.arquivo_url ? (
          <a
            href={doc.arquivo_url}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Ver arquivo"
          >
            <ExternalLink className="w-3.5 h-3.5" style={{ color: "#2E60FF" }} />
          </a>
        ) : (
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="Fazer upload"
          >
            <Upload className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
          </button>
        )}
      </div>
    </div>
  );
}

function FornecedorCard({ fp }: { fp: FornecedorNoProjeto }) {
  const completos = fp.documentos.filter((d) => d.status === "aprovado" || d.status === "enviado").length;
  const total = fp.documentos.length;
  const pct = Math.round((completos / total) * 100);

  const statusColor: Record<string, string> = {
    aguardando: "#94A3B8",
    parcial: "#D97706",
    completo: "#059669",
  };

  return (
    <div
      className="rounded-xl border bg-white overflow-hidden"
      style={{ borderColor: "#E2E8F0" }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #F1F5F9" }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
              style={{
                backgroundColor:
                  fp.fornecedor.tipo === "midia" ? "#00246D" : "#7C3AED",
              }}
            >
              {fp.fornecedor.tipo === "midia" ? "Mídia" : "Produção"}
            </span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-md"
              style={{
                backgroundColor: statusColor[fp.status] + "20",
                color: statusColor[fp.status],
              }}
            >
              {fp.status === "aguardando"
                ? "Aguardando"
                : fp.status === "parcial"
                ? "Parcial"
                : "Completo"}
            </span>
          </div>
          <h4 className="font-semibold text-sm" style={{ color: "#0F172A" }}>
            {fp.fornecedor.razao_social}
          </h4>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
            {fp.fornecedor.cnpj} · {fp.fornecedor.contato_nome}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: "#0F172A" }}>
            {formatCurrency(fp.valor_total)}
          </p>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            {formatCurrency(fp.valor)} + hon. {formatCurrency(fp.honorarios ?? 0)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 justify-end">
            <div
              className="h-1.5 w-20 rounded-full overflow-hidden"
              style={{ backgroundColor: "#E2E8F0" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: pct === 100 ? "#059669" : "#2E60FF",
                }}
              />
            </div>
            <span className="text-xs" style={{ color: "#64748B" }}>
              {completos}/{total}
            </span>
          </div>
        </div>
      </div>
      <div>
        {fp.documentos.map((doc) => (
          <DocumentoRow key={doc.tipo} doc={doc} />
        ))}
      </div>
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <p className="text-xs" style={{ color: "#94A3B8" }}>
          Prazo: {fp.prazo_dias} dias · {fp.dias_cobrados} dia(s) decorrido(s)
        </p>
        <a
          href={`/portal/${fp.link_token}`}
          target="_blank"
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: "#2E60FF" }}
        >
          Link do portal <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default async function FaturamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fat = mockFaturamentos.find((f) => f.id === id);
  if (!fat) notFound();

  const clienteTipoLabel: Record<string, string> = {
    governo_al: "Governo de Alagoas",
    sebrae: "SEBRAE",
    prefeitura: "Prefeitura",
    brk: "BRK",
    outro: "Outro",
  };

  const valorFornecedores = fat.fornecedores.reduce((s, f) => s + f.valor_total, 0);
  const valorCustosInternos = fat.custos_internos.reduce((s, c) => s + c.valor_total, 0);

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/faturamentos"
          className="flex items-center gap-1 text-sm"
          style={{ color: "#64748B" }}
        >
          <ChevronLeft className="w-4 h-4" />
          Faturamentos
        </Link>
        <ChevronRight className="w-3 h-3" style={{ color: "#CBD5E1" }} />
        <span className="text-sm font-medium" style={{ color: "#0F172A" }}>
          {fat.iclips_job_id}
        </span>
      </div>

      {/* Header */}
      <div
        className="rounded-xl border bg-white p-6 mb-6"
        style={{ borderColor: "#E2E8F0" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-mono mb-1" style={{ color: "#94A3B8" }}>
              {fat.iclips_job_id} · Proposta {fat.iclips_proposta_id}
            </p>
            <h1 className="text-xl font-bold mb-1" style={{ color: "#0F172A" }}>
              {fat.nome_campanha}
            </h1>
            <p className="text-sm" style={{ color: "#64748B" }}>
              {fat.cliente_nome} · {clienteTipoLabel[fat.cliente_tipo]}
              {fat.secretaria ? ` · ${fat.secretaria}` : ""}
            </p>
            {fat.empenho && (
              <p className="text-xs mt-1 font-mono" style={{ color: "#2E60FF" }}>
                Empenho: {fat.empenho}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: "#0F172A" }}>
              {formatCurrency(fat.valor_total)}
            </p>
            <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
              Atualizado em {formatDate(fat.atualizado_em)}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs justify-end" style={{ color: "#64748B" }}>
              {fat.responsavel_midia && <span>Mídia: <strong>{fat.responsavel_midia}</strong></span>}
              {fat.responsavel_faturamento && <span>Fat.: <strong>{fat.responsavel_faturamento}</strong></span>}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div
        className="rounded-xl border bg-white p-6 mb-6"
        style={{ borderColor: "#E2E8F0" }}
      >
        <h2 className="text-sm font-semibold mb-5" style={{ color: "#0F172A" }}>
          Pipeline de Etapas
        </h2>
        <div className="flex items-start overflow-x-auto pb-2">
          {fat.etapas.map((etapa, i) => (
            <EtapaCircle
              key={etapa.numero}
              etapa={etapa}
              isLast={i === fat.etapas.length - 1}
            />
          ))}
        </div>
        {fat.etapas.find((e) => e.inconformidade_motivo) && (
          <div
            className="mt-4 p-3 rounded-lg flex items-start gap-2"
            style={{ backgroundColor: "#FEF2F2" }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: "#991B1B" }}>
                Inconformidade registrada:
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#991B1B" }}>
                {fat.etapas.find((e) => e.inconformidade_motivo)?.inconformidade_motivo}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Valores resumo */}
      {(valorFornecedores > 0 || valorCustosInternos > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "#E2E8F0" }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>
              Fornecedores
            </p>
            <p className="text-lg font-bold" style={{ color: "#0F172A" }}>
              {formatCurrency(valorFornecedores)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              {fat.fornecedores.length} fornecedor(es)
            </p>
          </div>
          <div
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: "#E2E8F0" }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#94A3B8" }}>
              Custos Internos
            </p>
            <p className="text-lg font-bold" style={{ color: "#0F172A" }}>
              {formatCurrency(valorCustosInternos)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              {fat.custos_internos.length} item(ns)
            </p>
          </div>
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "#2E60FF", backgroundColor: "#EEF2FF" }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#2E60FF" }}>
              Total
            </p>
            <p className="text-lg font-bold" style={{ color: "#00246D" }}>
              {formatCurrency(fat.valor_total)}
            </p>
          </div>
        </div>
      )}

      {/* Custos Internos */}
      {fat.custos_internos.length > 0 && (
        <div
          className="rounded-xl border bg-white mb-6 overflow-hidden"
          style={{ borderColor: "#E2E8F0" }}
        >
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
            <h2 className="text-sm font-semibold" style={{ color: "#0F172A" }}>
              Custos Internos (Tabela de Preços)
            </h2>
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
              {fat.custos_internos.map((ci, i) => (
                <tr key={i} style={{ borderTop: "1px solid #F1F5F9" }}>
                  <td className="px-6 py-3 font-mono text-xs" style={{ color: "#64748B" }}>{ci.codigo}</td>
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
      {fat.fornecedores.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "#0F172A" }}>
            Documentação de Fornecedores
          </h2>
          <div className="space-y-4">
            {fat.fornecedores.map((fp) => (
              <FornecedorCard key={fp.id} fp={fp} />
            ))}
          </div>
        </div>
      )}

      {fat.fornecedores.length === 0 && fat.custos_internos.length === 0 && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}
        >
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "#CBD5E1" }} />
          <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>
            Nenhum fornecedor ou custo interno cadastrado ainda.
          </p>
          <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>
            Inicie o faturamento para adicionar fornecedores.
          </p>
        </div>
      )}
    </div>
  );
}

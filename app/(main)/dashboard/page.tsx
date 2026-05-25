import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { mockFaturamentos, mockCertidoes } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/utils";

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

const statusColor: Record<string, string> = {
  aguardando_inicio: "#94A3B8",
  docs_fornecedores: "#2E60FF",
  revisao_docs: "#F59E0B",
  docs_agencia: "#8B5CF6",
  revisao_processo: "#F59E0B",
  publicacao: "#10B981",
  aguardando_validacao: "#06B6D4",
  concluido: "#10B981",
  cancelado: "#EF4444",
};

const clienteTipo: Record<string, { label: string; color: string }> = {
  governo_al: { label: "Governo AL", color: "#2E60FF" },
  sebrae: { label: "SEBRAE", color: "#00246D" },
  prefeitura: { label: "Prefeitura", color: "#8B5CF6" },
  brk: { label: "BRK", color: "#059669" },
  outro: { label: "Outro", color: "#64748B" },
};

const certidaoStatusColor: Record<string, string> = {
  valida: "#10B981",
  vencendo: "#F59E0B",
  vencida: "#EF4444",
};

export default function DashboardPage() {
  const emAndamento = mockFaturamentos.filter(
    (f) => f.status !== "concluido" && f.status !== "cancelado"
  );
  const valorTotal = mockFaturamentos.reduce((sum, f) => sum + f.valor_total, 0);
  const certidoesAlerta = mockCertidoes.filter(
    (c) => c.status === "vencida" || c.status === "vencendo"
  );

  const docsPendentes = mockFaturamentos
    .flatMap((f) => f.fornecedores)
    .flatMap((fp) => fp.documentos)
    .filter((d) => d.status === "pendente").length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Visão geral dos faturamentos em andamento
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        <MetricCard
          label="Em andamento"
          value={String(emAndamento.length)}
          icon={<FileText className="w-5 h-5" style={{ color: "#2E60FF" }} />}
          iconBg="#EEF2FF"
          trend="3 projetos ativos"
        />
        <MetricCard
          label="Docs. pendentes"
          value={String(docsPendentes)}
          icon={<Clock className="w-5 h-5" style={{ color: "#F59E0B" }} />}
          iconBg="#FFFBEB"
          trend="de fornecedores"
          alert={docsPendentes > 0}
        />
        <MetricCard
          label="Valor a faturar"
          value={formatCurrency(valorTotal)}
          icon={<TrendingUp className="w-5 h-5" style={{ color: "#10B981" }} />}
          iconBg="#ECFDF5"
          trend="soma de todos os projetos"
          small
        />
        <MetricCard
          label="Alertas"
          value={String(certidoesAlerta.length)}
          icon={<AlertTriangle className="w-5 h-5" style={{ color: "#EF4444" }} />}
          iconBg="#FEF2F2"
          trend="certidões vencidas/vencendo"
          alert={certidoesAlerta.length > 0}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Faturamentos Recentes */}
        <div className="col-span-2">
          <div
            className="rounded-xl border bg-white"
            style={{ borderColor: "#E2E8F0" }}
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid #E2E8F0" }}
            >
              <h2 className="font-semibold text-sm" style={{ color: "#0F172A" }}>
                Faturamentos Recentes
              </h2>
              <Link
                href="/faturamentos"
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: "#2E60FF" }}
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
              {mockFaturamentos.map((fat) => {
                const tipo = clienteTipo[fat.cliente_tipo];
                return (
                  <Link
                    key={fat.id}
                    href={`/faturamentos/${fat.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: tipo.color }}
                        >
                          {tipo.label}
                        </span>
                        <span className="text-xs" style={{ color: "#94A3B8" }}>
                          {fat.iclips_job_id}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate" style={{ color: "#0F172A" }}>
                        {fat.nome_campanha}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                        {fat.cliente_nome}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div
                        className="text-xs font-medium px-2 py-1 rounded-md mb-1"
                        style={{
                          backgroundColor: statusColor[fat.status] + "20",
                          color: statusColor[fat.status],
                        }}
                      >
                        {statusLabel[fat.status]}
                      </div>
                      <p className="text-xs font-semibold" style={{ color: "#0F172A" }}>
                        {formatCurrency(fat.valor_total)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Certidões Alert */}
        <div>
          <div
            className="rounded-xl border bg-white"
            style={{ borderColor: "#E2E8F0" }}
          >
            <div
              className="px-6 py-4"
              style={{ borderBottom: "1px solid #E2E8F0" }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm" style={{ color: "#0F172A" }}>
                  Certidões
                </h2>
                <Link
                  href="/certidoes"
                  className="text-xs font-medium"
                  style={{ color: "#2E60FF" }}
                >
                  Gerenciar
                </Link>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              {mockCertidoes.map((cert) => (
                <div key={cert.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: certidaoStatusColor[cert.status] }}
                    />
                    <span
                      className="text-xs truncate"
                      style={{ color: "#334155" }}
                    >
                      {cert.label}
                    </span>
                  </div>
                  <span
                    className="text-xs font-medium flex-shrink-0 ml-2"
                    style={{ color: certidaoStatusColor[cert.status] }}
                  >
                    {cert.status === "vencida"
                      ? "Vencida"
                      : cert.status === "vencendo"
                      ? "Vencendo"
                      : formatDate(cert.validade)}
                  </span>
                </div>
              ))}
            </div>
            {certidoesAlerta.length > 0 && (
              <div
                className="mx-4 mb-4 px-3 py-2.5 rounded-lg flex items-start gap-2"
                style={{ backgroundColor: "#FEF2F2" }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                <p className="text-xs" style={{ color: "#991B1B" }}>
                  {certidoesAlerta.length} certidão(ões) precisam de atenção.{" "}
                  Renove antes de prosseguir com o faturamento.
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div
            className="rounded-xl border bg-white mt-4"
            style={{ borderColor: "#E2E8F0" }}
          >
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #E2E8F0" }}>
              <h2 className="font-semibold text-sm" style={{ color: "#0F172A" }}>
                Ações Rápidas
              </h2>
            </div>
            <div className="px-6 py-4 space-y-2">
              <Link
                href="/faturamentos"
                className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:border-blue-200 hover:bg-blue-50 group"
                style={{ borderColor: "#E2E8F0" }}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4" style={{ color: "#2E60FF" }} />
                  <span className="text-sm font-medium" style={{ color: "#334155" }}>
                    Novo Faturamento
                  </span>
                </div>
                <ArrowRight className="w-4 h-4" style={{ color: "#CBD5E1" }} />
              </Link>
              <Link
                href="/fornecedores"
                className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:border-blue-200 hover:bg-blue-50"
                style={{ borderColor: "#E2E8F0" }}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4" style={{ color: "#10B981" }} />
                  <span className="text-sm font-medium" style={{ color: "#334155" }}>
                    Ver Fornecedores
                  </span>
                </div>
                <ArrowRight className="w-4 h-4" style={{ color: "#CBD5E1" }} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  iconBg,
  trend,
  alert = false,
  small = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  trend: string;
  alert?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: alert ? "#FECACA" : "#E2E8F0" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
          {label}
        </span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBg }}>
          {icon}
        </div>
      </div>
      <p
        className={`font-bold mb-1 ${small ? "text-lg" : "text-3xl"}`}
        style={{ color: "#0F172A" }}
      >
        {value}
      </p>
      <p className="text-xs" style={{ color: "#94A3B8" }}>
        {trend}
      </p>
    </div>
  );
}

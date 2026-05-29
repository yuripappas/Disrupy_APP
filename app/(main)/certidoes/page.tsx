import { Upload, RefreshCw, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

function calcStatus(validade: string): "valida" | "vencendo" | "vencida" {
  const dias = Math.ceil((new Date(validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return "vencida";
  if (dias <= 15) return "vencendo";
  return "valida";
}

function diasRestantes(validade: string): number {
  return Math.ceil((new Date(validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const certidaoStatus = {
  valida: {
    label: "Válida",
    icon: <CheckCircle className="w-5 h-5" style={{ color: "#059669" }} />,
    color: "#059669", bg: "#ECFDF5", border: "#A7F3D0", textColor: "#064E3B",
  },
  vencendo: {
    label: "Vencendo em breve",
    icon: <Clock className="w-5 h-5" style={{ color: "#D97706" }} />,
    color: "#D97706", bg: "#FFFBEB", border: "#FCD34D", textColor: "#78350F",
  },
  vencida: {
    label: "Vencida",
    icon: <AlertTriangle className="w-5 h-5" style={{ color: "#DC2626" }} />,
    color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", textColor: "#7F1D1D",
  },
};

export default async function CerticoesPage() {
  const supabase = await createClient();
  const { data: certidoes = [] } = await supabase
    .from("certidoes")
    .select("*")
    .order("tipo");

  const comStatus = (certidoes ?? []).map((c) => ({ ...c, status: calcStatus(c.validade) }));
  const validas = comStatus.filter((c) => c.status === "valida");
  const vencendo = comStatus.filter((c) => c.status === "vencendo");
  const vencidas = comStatus.filter((c) => c.status === "vencida");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Certidões Negativas</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {validas.length} válidas · {vencendo.length} vencendo · {vencidas.length} vencida(s)
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: "#2E60FF" }}>
          <Upload className="w-4 h-4" /> Upload de Certidão
        </button>
      </div>

      {(vencidas.length > 0 || vencendo.length > 0) && (
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#991B1B" }}>Atenção: certidões com situação irregular</p>
            <p className="text-sm mt-0.5" style={{ color: "#B91C1C" }}>
              {vencidas.length > 0 && `${vencidas.length} certidão(ões) vencida(s). `}
              {vencendo.length > 0 && `${vencendo.length} certidão(ões) vencendo em breve. `}
              Certidões irregulares bloqueiam o envio do processo ao cliente.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {comStatus.map((cert) => {
          const cfg = certidaoStatus[cert.status];
          const dias = diasRestantes(cert.validade);
          return (
            <div key={cert.id} className="rounded-xl border bg-white p-6" style={{ borderColor: cfg.border }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                    {cfg.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: "#0F172A" }}>{cert.label}</h3>
                    <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: "#94A3B8" }}>Validade</p>
                  <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{formatDate(cert.validade)}</p>
                </div>
              </div>
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: cfg.bg }}>
                <span className="text-xs font-medium" style={{ color: cfg.textColor }}>
                  {cert.status === "vencida" ? `Vencida há ${Math.abs(dias)} dia(s)`
                    : cert.status === "vencendo" ? `Vence em ${dias} dia(s)`
                    : `Válida por mais ${dias} dia(s)`}
                </span>
                <button className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md text-white" style={{ backgroundColor: cfg.color }}>
                  <RefreshCw className="w-3 h-3" /> Renovar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border p-5" style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#334155" }}>Prazos de Validade Padrão</h3>
        <div className="grid grid-cols-3 gap-4 text-xs" style={{ color: "#64748B" }}>
          <div><strong style={{ color: "#334155" }}>Federal (Receita + PGFN)</strong><br />180 dias</div>
          <div><strong style={{ color: "#334155" }}>FGTS (Caixa)</strong><br />30 dias</div>
          <div><strong style={{ color: "#334155" }}>Trabalhista (TST)</strong><br />180 dias</div>
          <div><strong style={{ color: "#334155" }}>Estadual (SEFAZ-AL)</strong><br />Variável</div>
          <div><strong style={{ color: "#334155" }}>Municipal (SEMFAZ Maceió)</strong><br />Variável</div>
          <div><strong style={{ color: "#334155" }}>Falência/Concordata (TJAL)</strong><br />Variável</div>
        </div>
      </div>
    </div>
  );
}

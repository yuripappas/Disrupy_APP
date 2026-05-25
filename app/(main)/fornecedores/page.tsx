import { Plus, Mail, Phone, MessageCircle } from "lucide-react";
import { mockFornecedores } from "@/lib/mock-data";

const tipoConfig = {
  midia: { label: "Mídia", color: "#00246D", bg: "#EEF2FF" },
  producao: { label: "Produção", color: "#7C3AED", bg: "#F5F3FF" },
};

function formatCNPJ(cnpj: string) {
  return cnpj;
}

function formatWhatsApp(num: string) {
  const n = num.replace(/\D/g, "");
  if (n.length === 11) {
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  }
  return num;
}

export default function FornecedoresPage() {
  const midia = mockFornecedores.filter((f) => f.tipo === "midia");
  const producao = mockFornecedores.filter((f) => f.tipo === "producao");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>
            Fornecedores
          </h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {midia.length} de mídia · {producao.length} de produção
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "#2E60FF" }}
        >
          <Plus className="w-4 h-4" />
          Novo Fornecedor
        </button>
      </div>

      {/* Mídia */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: "#00246D" }}
          >
            Mídia
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "#E2E8F0" }} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {midia.map((f) => (
            <FornecedorCard key={f.id} fornecedor={f} />
          ))}
        </div>
      </div>

      {/* Produção */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span
            className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: "#7C3AED" }}
          >
            Produção
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "#E2E8F0" }} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {producao.map((f) => (
            <FornecedorCard key={f.id} fornecedor={f} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FornecedorCard({ fornecedor: f }: { fornecedor: (typeof mockFornecedores)[0] }) {
  const tipo = tipoConfig[f.tipo];

  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "#E2E8F0" }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: tipo.bg, color: tipo.color }}
            >
              {tipo.label}
            </span>
            {f.ativo ? (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#ECFDF5", color: "#059669" }}
              >
                Ativo
              </span>
            ) : (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#F1F5F9", color: "#64748B" }}
              >
                Inativo
              </span>
            )}
          </div>
          <h3 className="font-semibold text-sm leading-tight" style={{ color: "#0F172A" }}>
            {f.razao_social}
          </h3>
          <p className="text-xs mt-1 font-mono" style={{ color: "#94A3B8" }}>
            {formatCNPJ(f.cnpj)}
          </p>
        </div>
      </div>

      <div
        className="rounded-lg p-3 space-y-2"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <p className="text-xs font-medium" style={{ color: "#334155" }}>
          {f.contato_nome}
        </p>
        <div className="flex items-center gap-3">
          <a
            href={`mailto:${f.contato_email}`}
            className="flex items-center gap-1.5 text-xs hover:underline"
            style={{ color: "#2E60FF" }}
          >
            <Mail className="w-3 h-3" />
            {f.contato_email}
          </a>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={`https://wa.me/55${f.contato_whatsapp}`}
            target="_blank"
            className="flex items-center gap-1.5 text-xs hover:underline"
            style={{ color: "#059669" }}
          >
            <MessageCircle className="w-3 h-3" />
            {formatWhatsApp(f.contato_whatsapp)}
          </a>
          {f.telefone && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#64748B" }}>
              <Phone className="w-3 h-3" />
              {f.telefone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

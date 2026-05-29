"use client";

import { useState } from "react";
import { Plus, Mail, MessageCircle, Phone, MapPin, Globe, Search } from "lucide-react";
import { NovoFornecedorModal } from "@/components/fornecedores/NovoFornecedorModal";

const tipoConfig = {
  midia: { label: "Mídia", color: "#00246D", bg: "#EEF2FF" },
  producao: { label: "Produção", color: "#7C3AED", bg: "#F5F3FF" },
};

function formatWhatsApp(num: string) {
  const n = (num || "").replace(/\D/g, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  return num;
}

type Fornecedor = {
  id: string; razao_social: string; cnpj?: string; tipo: "midia" | "producao";
  contato_nome?: string; contato_whatsapp?: string; contato_email?: string;
  telefone?: string; email?: string; endereco?: string; cidade?: string; uf?: string;
  site?: string; ativo: boolean;
};

export function FornecedoresClient({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "midia" | "producao">("todos");

  const filtrados = fornecedores.filter((f) => {
    const matchTipo = tipoFiltro === "todos" || f.tipo === tipoFiltro;
    const q = busca.toLowerCase();
    const matchBusca = !q || f.razao_social.toLowerCase().includes(q) ||
      (f.cnpj ?? "").includes(q) ||
      (f.cidade ?? "").toLowerCase().includes(q) ||
      (f.contato_nome ?? "").toLowerCase().includes(q);
    return matchTipo && matchBusca;
  });

  const midia = filtrados.filter((f) => f.tipo === "midia");
  const producao = filtrados.filter((f) => f.tipo === "producao");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>Fornecedores</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            {fornecedores.filter(f => f.tipo === "midia").length} de mídia ·{" "}
            {fornecedores.filter(f => f.tipo === "producao").length} de produção
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: "#2E60FF" }}
        >
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
          <input
            type="text"
            placeholder="Buscar por nome, CNPJ, cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm outline-none focus:border-blue-400"
            style={{ borderColor: "#E2E8F0", backgroundColor: "#F8FAFC", color: "#334155" }}
          />
        </div>
        {(["todos", "midia", "producao"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipoFiltro(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: tipoFiltro === t ? "#2E60FF" : "#E2E8F0",
              backgroundColor: tipoFiltro === t ? "#EEF2FF" : "white",
              color: tipoFiltro === t ? "#2E60FF" : "#64748B",
            }}
          >
            {t === "todos" ? "Todos" : t === "midia" ? "Mídia" : "Produção"}
          </button>
        ))}
        {busca && (
          <p className="text-xs ml-1" style={{ color: "#94A3B8" }}>
            {filtrados.length} resultado(s)
          </p>
        )}
      </div>

      {fornecedores.length === 0 ? (
        <div className="text-center py-20" style={{ color: "#94A3B8" }}>
          <p className="text-lg font-medium mb-2">Nenhum fornecedor cadastrado</p>
          <p className="text-sm">Clique em &quot;Novo Fornecedor&quot; para adicionar o primeiro.</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-20" style={{ color: "#94A3B8" }}>
          <p className="text-sm">Nenhum fornecedor encontrado para &quot;{busca}&quot;.</p>
        </div>
      ) : (
        <>
          {midia.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white" style={{ backgroundColor: "#00246D" }}>Mídia</span>
                <span className="text-xs" style={{ color: "#94A3B8" }}>{midia.length} veículos</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "#E2E8F0" }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {midia.map((f) => <FornecedorCard key={f.id} fornecedor={f} />)}
              </div>
            </div>
          )}
          {producao.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white" style={{ backgroundColor: "#7C3AED" }}>Produção</span>
                <span className="text-xs" style={{ color: "#94A3B8" }}>{producao.length} fornecedores</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "#E2E8F0" }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {producao.map((f) => <FornecedorCard key={f.id} fornecedor={f} />)}
              </div>
            </div>
          )}
        </>
      )}

      <NovoFornecedorModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function FornecedorCard({ fornecedor: f }: { fornecedor: Fornecedor }) {
  const tipo = tipoConfig[f.tipo];
  const emailPrincipal = f.contato_email || f.email;
  const telefonePrincipal = f.contato_whatsapp || f.telefone;
  return (
    <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#E2E8F0" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: tipo.bg, color: tipo.color }}>{tipo.label}</span>
          </div>
          <h3 className="font-semibold text-sm leading-tight" style={{ color: "#0F172A" }}>{f.razao_social}</h3>
          {f.cnpj && <p className="text-xs mt-0.5 font-mono" style={{ color: "#94A3B8" }}>{f.cnpj}</p>}
          {(f.cidade || f.uf) && (
            <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              <MapPin className="w-3 h-3" />{[f.cidade, f.uf].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
      <div className="rounded-lg p-3 space-y-1.5" style={{ backgroundColor: "#F8FAFC" }}>
        {f.contato_nome && <p className="text-xs font-medium" style={{ color: "#334155" }}>{f.contato_nome}</p>}
        <div className="flex flex-col gap-1">
          {emailPrincipal && (
            <a href={`mailto:${emailPrincipal}`} className="flex items-center gap-1.5 text-xs hover:underline truncate" style={{ color: "#2E60FF" }}>
              <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{emailPrincipal}</span>
            </a>
          )}
          {f.contato_whatsapp ? (
            <a href={`https://wa.me/55${f.contato_whatsapp.replace(/\D/g, "")}`} target="_blank" className="flex items-center gap-1.5 text-xs hover:underline" style={{ color: "#059669" }}>
              <MessageCircle className="w-3 h-3" />{formatWhatsApp(f.contato_whatsapp)}
            </a>
          ) : f.telefone ? (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "#64748B" }}>
              <Phone className="w-3 h-3" />{f.telefone}
            </span>
          ) : null}
          {f.site && (
            <a href={f.site.startsWith("http") ? f.site : `https://${f.site}`} target="_blank" className="flex items-center gap-1.5 text-xs hover:underline truncate" style={{ color: "#64748B" }}>
              <Globe className="w-3 h-3 flex-shrink-0" /><span className="truncate">{f.site}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

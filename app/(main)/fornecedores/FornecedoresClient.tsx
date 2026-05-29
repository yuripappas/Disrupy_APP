"use client";

import { useState } from "react";
import { Plus, Mail, MessageCircle, Phone, MapPin, Search, ExternalLink, Pencil } from "lucide-react";
import { NovoFornecedorModal } from "@/components/fornecedores/NovoFornecedorModal";
import { EditarFornecedorModal } from "@/components/fornecedores/EditarFornecedorModal";

function formatWhatsApp(num: string) {
  const n = (num || "").replace(/\D/g, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return num;
}

type Fornecedor = {
  id: string; razao_social: string; cnpj?: string; tipo: "midia" | "producao";
  contato_nome?: string; contato_whatsapp?: string; contato_email?: string;
  telefone?: string; email?: string; endereco?: string; cidade?: string; uf?: string;
  site?: string; ativo: boolean;
};

export function FornecedoresClient({ fornecedores: inicial }: { fornecedores: Fornecedor[] }) {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(inicial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "midia" | "producao">("todos");

  function handleSaved(updated: Fornecedor) {
    if (!updated.ativo) {
      setFornecedores((prev) => prev.filter((f) => f.id !== updated.id));
    } else {
      setFornecedores((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    }
    setEditando(null);
  }

  const filtrados = fornecedores.filter((f) => {
    const matchTipo = tipoFiltro === "todos" || f.tipo === tipoFiltro;
    const q = busca.toLowerCase();
    const matchBusca = !q || f.razao_social.toLowerCase().includes(q) ||
      (f.cnpj ?? "").includes(q) ||
      (f.cidade ?? "").toLowerCase().includes(q) ||
      (f.contato_nome ?? "").toLowerCase().includes(q) ||
      (f.contato_email ?? "").toLowerCase().includes(q) ||
      (f.email ?? "").toLowerCase().includes(q);
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
      <div className="flex items-center gap-3 mb-4">
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
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white" style={{ backgroundColor: "#00246D" }}>Mídia</span>
                <span className="text-xs" style={{ color: "#94A3B8" }}>{midia.length} veículos</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "#E2E8F0" }} />
              </div>
              <FornecedorTable fornecedores={midia} onEdit={setEditando} />
            </div>
          )}
          {producao.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white" style={{ backgroundColor: "#7C3AED" }}>Produção</span>
                <span className="text-xs" style={{ color: "#94A3B8" }}>{producao.length} fornecedores</span>
                <div className="flex-1 h-px" style={{ backgroundColor: "#E2E8F0" }} />
              </div>
              <FornecedorTable fornecedores={producao} onEdit={setEditando} />
            </div>
          )}
        </>
      )}

      <NovoFornecedorModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <EditarFornecedorModal
        fornecedor={editando}
        onClose={() => setEditando(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function FornecedorTable({ fornecedores, onEdit }: { fornecedores: Fornecedor[]; onEdit: (f: Fornecedor) => void }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>Nome / CNPJ</th>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>Localização</th>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>Contato</th>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>E-mail</th>
            <th className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "#94A3B8" }}>Telefone / WhatsApp</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {fornecedores.map((f, i) => {
            const emailPrincipal = f.contato_email || f.email;
            const telefonePrincipal = f.contato_whatsapp || f.telefone;
            const isWhatsApp = !!f.contato_whatsapp;
            return (
              <tr
                key={f.id}
                style={{
                  borderBottom: i < fornecedores.length - 1 ? "1px solid #F1F5F9" : undefined,
                  backgroundColor: i % 2 === 0 ? "white" : "#FAFAFA",
                }}
              >
                {/* Nome / CNPJ */}
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: "#0F172A" }}>{f.razao_social}</div>
                  {f.cnpj && (
                    <div className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>{f.cnpj}</div>
                  )}
                  {f.site && (
                    <a
                      href={f.site.startsWith("http") ? f.site : `https://${f.site}`}
                      target="_blank"
                      className="flex items-center gap-1 text-xs mt-0.5 hover:underline"
                      style={{ color: "#64748B" }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="truncate max-w-[160px]">{f.site.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                </td>

                {/* Localização */}
                <td className="px-4 py-3">
                  {(f.cidade || f.uf) ? (
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#64748B" }}>
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {[f.cidade, f.uf].filter(Boolean).join(" · ")}
                    </div>
                  ) : (
                    <span className="text-xs" style={{ color: "#CBD5E1" }}>—</span>
                  )}
                </td>

                {/* Contato */}
                <td className="px-4 py-3">
                  {f.contato_nome ? (
                    <span className="text-xs" style={{ color: "#334155" }}>{f.contato_nome}</span>
                  ) : (
                    <span className="text-xs" style={{ color: "#CBD5E1" }}>—</span>
                  )}
                </td>

                {/* E-mail */}
                <td className="px-4 py-3">
                  {emailPrincipal ? (
                    <a
                      href={`mailto:${emailPrincipal}`}
                      className="flex items-center gap-1 text-xs hover:underline"
                      style={{ color: "#2E60FF" }}
                    >
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[200px]">{emailPrincipal}</span>
                    </a>
                  ) : (
                    <span className="text-xs" style={{ color: "#CBD5E1" }}>—</span>
                  )}
                </td>

                {/* Telefone / WhatsApp */}
                <td className="px-4 py-3">
                  {telefonePrincipal ? (
                    isWhatsApp ? (
                      <a
                        href={`https://wa.me/55${f.contato_whatsapp!.replace(/\D/g, "")}`}
                        target="_blank"
                        className="flex items-center gap-1 text-xs hover:underline"
                        style={{ color: "#059669" }}
                      >
                        <MessageCircle className="w-3 h-3" />
                        {formatWhatsApp(telefonePrincipal)}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1 text-xs" style={{ color: "#64748B" }}>
                        <Phone className="w-3 h-3" />
                        {telefonePrincipal}
                      </span>
                    )
                  ) : (
                    <span className="text-xs" style={{ color: "#CBD5E1" }}>—</span>
                  )}
                </td>

                {/* Editar */}
                <td className="px-2 py-3">
                  <button
                    onClick={() => onEdit(f)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Editar fornecedor"
                  >
                    <Pencil className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

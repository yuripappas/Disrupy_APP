"use client";

import { useState } from "react";
import { Building2, Phone, Mail, User, Edit2, Check, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type Fornecedor = {
  id: string;
  razao_social: string;
  cnpj: string;
  tipo: "midia" | "producao";
  contato_nome: string | null;
  contato_whatsapp: string | null;
  contato_email: string | null;
  ativo: boolean;
};

// ── Linha de fornecedor com edição inline ────────────────────────────────────

function FornecedorRow({ fornecedor: initial }: { fornecedor: Fornecedor }) {
  const [forn, setForn]         = useState(initial);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState<string | null>(null);

  const [form, setForm] = useState({
    contato_nome:     initial.contato_nome     ?? "",
    contato_whatsapp: initial.contato_whatsapp ?? "",
    contato_email:    initial.contato_email    ?? "",
  });

  function abrirEdicao() {
    setForm({
      contato_nome:     forn.contato_nome     ?? "",
      contato_whatsapp: forn.contato_whatsapp ?? "",
      contato_email:    forn.contato_email    ?? "",
    });
    setErro(null);
    setEditando(true);
  }

  function cancelar() { setEditando(false); setErro(null); }

  async function salvar() {
    setSalvando(true); setErro(null);
    const res = await fetch(`/api/fornecedores/${forn.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contato_nome:     form.contato_nome.trim()     || null,
        contato_whatsapp: form.contato_whatsapp.trim() || null,
        contato_email:    form.contato_email.trim()    || null,
      }),
    });
    const data = await res.json();
    setSalvando(false);
    if (!res.ok) { setErro(data.error ?? "Erro ao salvar"); return; }
    setForn((prev) => ({
      ...prev,
      contato_nome:     data.fornecedor.contato_nome,
      contato_whatsapp: data.fornecedor.contato_whatsapp,
      contato_email:    data.fornecedor.contato_email,
    }));
    setEditando(false);
  }

  const semContato = !forn.contato_nome && !forn.contato_whatsapp && !forn.contato_email;

  return (
    <div style={{ borderBottom: "1px solid #F1F5F9" }}>
      {/* Linha principal */}
      <div className="flex items-center gap-4 px-5 py-3">
        {/* Empresa */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "#0F172A" }}>
            {forn.razao_social}
          </p>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#94A3B8" }}>{forn.cnpj}</p>
        </div>

        {/* Contatos (modo visualização) */}
        {!editando && (
          <div className="flex items-center gap-4 flex-shrink-0">
            {semContato ? (
              <span className="text-xs italic" style={{ color: "#F59E0B" }}>
                ⚠ Sem contato
              </span>
            ) : (
              <>
                {forn.contato_nome && (
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                    <span className="text-xs" style={{ color: "#334155" }}>{forn.contato_nome}</span>
                  </div>
                )}
                {forn.contato_whatsapp && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                    <span className="text-xs font-mono" style={{ color: "#334155" }}>{forn.contato_whatsapp}</span>
                  </div>
                )}
                {forn.contato_email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                    <span className="text-xs" style={{ color: "#334155" }}>{forn.contato_email}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Botão editar */}
        {!editando && (
          <button
            onClick={abrirEdicao}
            title="Editar contatos"
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
            style={{ color: "#64748B" }}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Formulário de edição (expansível) */}
      {editando && (
        <div
          className="px-5 pb-4 space-y-3"
          style={{ backgroundColor: "#F8FAFC", borderTop: "1px solid #F1F5F9" }}
        >
          <div className="grid grid-cols-3 gap-3 pt-3">
            <label className="block">
              <span className="text-xs font-medium block mb-1" style={{ color: "#475569" }}>Nome do contato</span>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-white" style={{ borderColor: "#CBD5E1" }}>
                <User className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                <input
                  type="text"
                  value={form.contato_nome}
                  onChange={(e) => setForm((f) => ({ ...f, contato_nome: e.target.value }))}
                  placeholder="João Silva"
                  className="flex-1 text-xs outline-none bg-transparent"
                  style={{ color: "#0F172A" }}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium block mb-1" style={{ color: "#475569" }}>WhatsApp</span>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-white" style={{ borderColor: "#CBD5E1" }}>
                <Phone className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                <input
                  type="tel"
                  value={form.contato_whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, contato_whatsapp: e.target.value }))}
                  placeholder="5582999999999"
                  className="flex-1 text-xs font-mono outline-none bg-transparent"
                  style={{ color: "#0F172A" }}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium block mb-1" style={{ color: "#475569" }}>E-mail</span>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-white" style={{ borderColor: "#CBD5E1" }}>
                <Mail className="w-3 h-3 flex-shrink-0" style={{ color: "#94A3B8" }} />
                <input
                  type="email"
                  value={form.contato_email}
                  onChange={(e) => setForm((f) => ({ ...f, contato_email: e.target.value }))}
                  placeholder="contato@empresa.com"
                  className="flex-1 text-xs outline-none bg-transparent"
                  style={{ color: "#0F172A" }}
                />
              </div>
            </label>
          </div>

          {erro && <p className="text-xs" style={{ color: "#DC2626" }}>⚠ {erro}</p>}

          <div className="flex gap-2">
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: salvando ? "#94A3B8" : "#2E60FF" }}
            >
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={cancelar}
              disabled={salvando}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
              style={{ borderColor: "#E2E8F0", color: "#64748B" }}
            >
              <X className="w-3 h-3" /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grupo colapsável (Mídia / Produção) ──────────────────────────────────────

function GrupoFornecedores({
  titulo,
  accentColor,
  accentBg,
  fornecedores,
}: {
  titulo: string;
  accentColor: string;
  accentBg: string;
  fornecedores: Fornecedor[];
}) {
  const [aberto, setAberto] = useState(true);
  const semContato = fornecedores.filter(
    (f) => !f.contato_nome && !f.contato_whatsapp && !f.contato_email,
  ).length;

  return (
    <div className="rounded-xl border bg-white overflow-hidden mb-4" style={{ borderColor: "#E2E8F0" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
        style={{ borderBottom: aberto ? "1px solid #E2E8F0" : "none" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>{titulo}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: accentBg, color: accentColor }}
          >
            {fornecedores.length} {fornecedores.length === 1 ? "fornecedor" : "fornecedores"}
          </span>
          {semContato > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
            >
              {semContato} sem contato
            </span>
          )}
        </div>
        {aberto
          ? <ChevronUp className="w-4 h-4" style={{ color: "#94A3B8" }} />
          : <ChevronDown className="w-4 h-4" style={{ color: "#94A3B8" }} />}
      </button>

      {aberto && (
        <div>
          {fornecedores.map((f) => (
            <FornecedorRow key={f.id} fornecedor={f} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FornecedoresConfig({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const midia    = fornecedores.filter((f) => f.tipo === "midia");
  const producao = fornecedores.filter((f) => f.tipo === "producao");

  if (fornecedores.length === 0) {
    return (
      <div
        className="rounded-xl border p-12 text-center"
        style={{ borderColor: "#E2E8F0", borderStyle: "dashed" }}
      >
        <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: "#CBD5E1" }} />
        <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>
          Nenhum fornecedor cadastrado ainda.
        </p>
        <p className="text-xs mt-1" style={{ color: "#CBD5E1" }}>
          Importe um orçamento do iClips para adicionar fornecedores.
        </p>
      </div>
    );
  }

  return (
    <div>
      {midia.length > 0 && (
        <GrupoFornecedores
          titulo="Mídia"
          accentColor="#2E60FF"
          accentBg="#EEF2FF"
          fornecedores={midia}
        />
      )}
      {producao.length > 0 && (
        <GrupoFornecedores
          titulo="Produção"
          accentColor="#7C3AED"
          accentBg="#F5F3FF"
          fornecedores={producao}
        />
      )}
    </div>
  );
}

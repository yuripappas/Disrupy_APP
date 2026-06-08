"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle2, User, Phone, Mail } from "lucide-react";

type UserData = {
  id: string;
  email: string;
  nome: string;
  role: string;
};

const ROLES = [
  {
    id: "gestor",
    label: "Gestor",
    desc: "Acesso total, gerencia usuários e configurações",
    color: "#00246D",
    bg: "#EEF2FF",
  },
  {
    id: "faturamento",
    label: "Faturamento",
    desc: "Cria e gerencia faturamentos e documentos",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    id: "midia",
    label: "Mídia",
    desc: "Acesso à área de mídia e campanhas",
    color: "#2E60FF",
    bg: "#EEF2FF",
  },
  {
    id: "producao",
    label: "Produção",
    desc: "Acesso à área de produção e execução",
    color: "#059669",
    bg: "#ECFDF5",
  },
];

export function EditarUsuarioModal({
  user,
  currentUserId,
  onClose,
  onSaved,
}: {
  user: UserData;
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isSelf = user.id === currentUserId;

  const [nome,     setNome]     = useState(user.nome);
  const [email,    setEmail]    = useState(user.email);
  const [telefone, setTelefone] = useState("");
  const [role,     setRole]     = useState(user.role);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body: Record<string, string> = { userId: user.id };
    if (nome.trim()     !== user.nome)  body.nome     = nome.trim();
    if (email.trim()    !== user.email) body.email    = email.trim();
    if (telefone.trim())                body.telefone = telefone.trim();
    if (role             !== user.role) body.role     = role;

    // Always send role to ensure it's set
    body.role = role;

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Erro ao salvar");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => { onSaved(); }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: "#2E60FF" }}>
              {(user.nome || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#0F172A" }}>Editar usuário</h2>
              <p className="text-xs truncate max-w-[220px]" style={{ color: "#94A3B8" }}>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: "#64748B" }} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12" style={{ color: "#059669" }} />
            <p className="text-base font-semibold" style={{ color: "#0F172A" }}>Usuário atualizado!</p>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="px-6 py-5 space-y-4">

              {/* Nome */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#374151" }}>Nome completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome do usuário"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                    style={{ borderColor: "#E2E8F0", color: "#0F172A" }}
                    onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                    onBlur={(e)  => (e.target.style.borderColor = "#E2E8F0")}
                  />
                </div>
              </div>

              {/* Telefone */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#374151" }}>Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(82) 9 9999-9999"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                    style={{ borderColor: "#E2E8F0", color: "#0F172A" }}
                    onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                    onBlur={(e)  => (e.target.style.borderColor = "#E2E8F0")}
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#374151" }}>E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@disrupy.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                    style={{ borderColor: "#E2E8F0", color: "#0F172A" }}
                    onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                    onBlur={(e)  => (e.target.style.borderColor = "#E2E8F0")}
                  />
                </div>
              </div>

              {/* Perfil */}
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: "#374151" }}>Perfil de acesso</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const active = role === r.id;
                    const blocked = isSelf && r.id !== "gestor";
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={blocked}
                        onClick={() => !blocked && setRole(r.id)}
                        className="relative text-left p-3 rounded-xl border-2 transition-all"
                        style={{
                          borderColor:     active ? r.color : "#E2E8F0",
                          backgroundColor: active ? r.bg   : "white",
                          opacity:         blocked ? 0.4   : 1,
                          cursor:          blocked ? "not-allowed" : "pointer",
                        }}
                      >
                        <p className="text-xs font-bold" style={{ color: active ? r.color : "#374151" }}>{r.label}</p>
                        <p className="text-xs mt-0.5 leading-tight" style={{ color: "#94A3B8" }}>{r.desc}</p>
                      </button>
                    );
                  })}
                </div>
                {isSelf && (
                  <p className="text-xs mt-2" style={{ color: "#D97706" }}>
                    ⚠️ Você não pode remover seu próprio perfil de Gestor.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#FEF2F2", color: "#991B1B" }}>
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 rounded-lg border text-sm font-medium"
                style={{ borderColor: "#E2E8F0", color: "#64748B" }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: "#2E60FF", opacity: loading ? 0.7 : 1 }}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, CheckCircle2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CurrentUser = { id: string; nome: string; email: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  gestor:      "Gestor",
  midia:       "Mídia",
  producao:    "Produção",
  faturamento: "Faturamento",
};

export function MeuPerfilModal({
  user,
  onClose,
}: {
  user: CurrentUser;
  onClose: () => void;
}) {
  const router = useRouter();
  const [nome,     setNome]     = useState(user.nome);
  const [telefone, setTelefone] = useState("");
  const [email,    setEmail]    = useState(user.email);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const updates: Parameters<typeof supabase.auth.updateUser>[0] = {
      data: { full_name: nome.trim(), phone: telefone.trim() },
    };
    if (email.trim() !== user.email) {
      updates.email = email.trim().toLowerCase();
    }

    const { error } = await supabase.auth.updateUser(updates);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    router.refresh();
    setTimeout(onClose, 1500);
  }

  const perfil = ROLE_LABEL[user.role] ?? user.role;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#E2E8F0" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ backgroundColor: "#2E60FF" }}>
              {(user.nome || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#0F172A" }}>Meu perfil</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}>
                {perfil}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: "#64748B" }} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12" style={{ color: "#059669" }} />
            <p className="text-base font-semibold" style={{ color: "#0F172A" }}>Perfil atualizado!</p>
            {email !== user.email && (
              <p className="text-xs" style={{ color: "#64748B" }}>
                Um e-mail de confirmação foi enviado para <strong>{email}</strong>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="px-6 py-5 space-y-4">

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#374151" }}>
                  Nome completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome"
                    autoFocus
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                    style={{ borderColor: "#E2E8F0", color: "#0F172A" }}
                    onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                    onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#374151" }}>
                  Telefone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(82) 9 9999-9999"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                  style={{ borderColor: "#E2E8F0", color: "#0F172A" }}
                  onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#374151" }}>
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition-all"
                  style={{ borderColor: "#E2E8F0", color: "#0F172A" }}
                  onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
                />
                {email !== user.email && (
                  <p className="text-xs mt-1" style={{ color: "#D97706" }}>
                    ⚠️ Você receberá um e-mail de confirmação no novo endereço.
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

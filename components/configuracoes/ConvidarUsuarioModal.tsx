"use client";

import { useState } from "react";
import { X, Mail, Loader2, CheckCircle2 } from "lucide-react";

const PERFIS = [
  { value: "gestor",      label: "Gestor",      desc: "Acesso total — configurações, usuários, exclusão",   color: "#00246D", bg: "#EEF2FF" },
  { value: "faturamento", label: "Faturamento",  desc: "Aprova custos internos e qualquer documento",        color: "#7C3AED", bg: "#F5F3FF" },
  { value: "midia",       label: "Mídia",        desc: "Aprova documentos de fornecedores de mídia",         color: "#2E60FF", bg: "#EEF2FF" },
  { value: "producao",    label: "Produção",     desc: "Aprova documentos de fornecedores de produção",      color: "#059669", bg: "#ECFDF5" },
];

export function ConvidarUsuarioModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail]         = useState("");
  const [role, setRole]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);

  function resetAndClose() {
    setEmail("");
    setRole("");
    setError("");
    setSuccess(false);
    setLoading(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !role) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Erro ao enviar convite.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    onInvited();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#E2E8F0" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#0F172A" }}>Convidar usuário</h2>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              O usuário receberá um e-mail para definir a senha
            </p>
          </div>
          <button onClick={resetAndClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: "#64748B" }} />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12" style={{ color: "#059669" }} />
            <p className="text-base font-semibold" style={{ color: "#0F172A" }}>Convite enviado!</p>
            <p className="text-sm" style={{ color: "#64748B" }}>
              <strong>{email}</strong> receberá um link para acessar o sistema.
            </p>
            <button
              onClick={resetAndClose}
              className="mt-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: "#2E60FF" }}
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-5 space-y-5">

              {/* Email */}
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#374151" }}>
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@disrupy.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border outline-none"
                    style={{ borderColor: "#E2E8F0", color: "#0F172A" }}
                  />
                </div>
              </div>

              {/* Perfil */}
              <div>
                <label className="text-xs font-semibold block mb-2" style={{ color: "#374151" }}>
                  Perfil de acesso
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PERFIS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setRole(p.value)}
                      className="text-left p-3 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: role === p.value ? p.color : "#E2E8F0",
                        backgroundColor: role === p.value ? p.bg : "white",
                      }}
                    >
                      <p className="text-xs font-bold mb-0.5" style={{ color: p.color }}>{p.label}</p>
                      <p className="text-xs leading-tight" style={{ color: "#94A3B8" }}>{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#FEF2F2", color: "#991B1B" }}>
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={resetAndClose}
                className="px-4 py-2.5 rounded-lg border text-sm font-medium"
                style={{ borderColor: "#E2E8F0", color: "#64748B" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!email.trim() || !role || loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: "#2E60FF", opacity: (!email.trim() || !role) ? 0.5 : 1 }}
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : "Enviar convite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

const PERFIS = [
  { value: "gestor",      label: "Gestor",      desc: "Acesso total — configurações, usuários, exclusão",   color: "#00246D", bg: "#EEF2FF" },
  { value: "faturamento", label: "Faturamento",  desc: "Aprova custos internos e qualquer documento",        color: "#7C3AED", bg: "#F5F3FF" },
  { value: "midia",       label: "Mídia",        desc: "Aprova documentos de fornecedores de mídia",         color: "#2E60FF", bg: "#EEF2FF" },
  { value: "producao",    label: "Produção",     desc: "Aprova documentos de fornecedores de produção",      color: "#059669", bg: "#ECFDF5" },
];

type User = { id: string; email: string; nome: string; role: string };

export function EditarPerfilModal({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole]       = useState(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const changed = role !== user.role;

  async function handleSave() {
    if (!changed) { onClose(); return; }
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, role }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Erro ao atualizar perfil.");
      setLoading(false);
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#E2E8F0" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#0F172A" }}>Editar perfil</h2>
            <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: "#94A3B8" }}>
              {user.nome || user.email}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" style={{ color: "#64748B" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
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
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border text-sm font-medium"
            style={{ borderColor: "#E2E8F0", color: "#64748B" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: "#2E60FF", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

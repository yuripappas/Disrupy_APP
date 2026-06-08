"use client";

import { useState } from "react";
import { X, Trash2, Loader2, AlertTriangle } from "lucide-react";

type User = { id: string; email: string; nome: string };

export function DeletarUsuarioModal({
  user,
  onClose,
  onDeleted,
}: {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const confirmed = confirmInput.trim().toLowerCase() === user.email.trim().toLowerCase();

  async function handleDelete() {
    if (!confirmed) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "Erro ao excluir usuário.");
      setLoading(false);
      return;
    }

    onDeleted();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: "#FEE2E2", backgroundColor: "#FFF5F5", borderRadius: "16px 16px 0 0" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FEE2E2" }}>
            <Trash2 className="w-5 h-5" style={{ color: "#DC2626" }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "#991B1B" }}>Excluir usuário</h2>
            <p className="text-xs mt-0.5" style={{ color: "#DC2626" }}>Esta ação não pode ser desfeita</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-red-100">
            <X className="w-4 h-4" style={{ color: "#DC2626" }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: "#FFF5F5", border: "1px solid #FEE2E2" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
            <div className="text-sm" style={{ color: "#991B1B" }}>
              <p className="font-semibold mb-1">
                {user.nome ? `${user.nome} perderá` : "Este usuário perderá"} acesso imediatamente
              </p>
              <p className="text-xs" style={{ color: "#B91C1C" }}>
                A conta e todos os dados de autenticação serão removidos permanentemente.
              </p>
            </div>
          </div>

          {/* Confirm by email */}
          <div>
            <p className="text-sm mb-2" style={{ color: "#374151" }}>
              Para confirmar, digite o e-mail do usuário:
            </p>
            <div
              className="px-3 py-2 rounded-lg text-sm font-mono font-bold mb-3 select-all"
              style={{ backgroundColor: "#F1F5F9", color: "#0F172A", border: "1px solid #E2E8F0" }}
            >
              {user.email}
            </div>
            <input
              type="email"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Digite o e-mail para confirmar..."
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
              style={{
                borderColor: confirmInput && !confirmed ? "#EF4444" : confirmed ? "#059669" : "#E2E8F0",
                color: "#0F172A",
              }}
            />
            {confirmInput && !confirmed && (
              <p className="text-xs mt-1" style={{ color: "#EF4444" }}>E-mail não confere.</p>
            )}
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "#FEF2F2", color: "#991B1B" }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium"
            style={{ borderColor: "#E2E8F0", color: "#64748B" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!confirmed || loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{
              backgroundColor: "#DC2626",
              opacity: !confirmed || loading ? 0.4 : 1,
              cursor: !confirmed || loading ? "not-allowed" : "pointer",
            }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</>
              : <><Trash2 className="w-4 h-4" /> Excluir usuário</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

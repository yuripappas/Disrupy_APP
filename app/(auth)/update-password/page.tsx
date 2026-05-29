"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("Erro ao atualizar senha. Tente novamente.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "#00246D" }}>
            <Image src="/logo-disrupy-branca.svg" alt="Disrupy" width={32} height={32} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#0F172A" }}>Definir nova senha</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>Digite sua nova senha de acesso</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: "#E2E8F0" }}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>Nova senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>Confirmar senha</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none"
                style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
              />
            </div>

            {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: "#2E60FF", opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Salvando..." : "Salvar senha"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

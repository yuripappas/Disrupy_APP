"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle2 } from "lucide-react";

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type"); // "invite" | "recovery"
  const isInvite = type === "invite";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    if (password.length < 6)  { setError("A senha deve ter pelo menos 6 caracteres."); return; }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("Erro ao salvar senha. O link pode ter expirado — solicite um novo.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "#00246D" }}>
            <Image src="/logo-disrupy-branca.svg" alt="Disrupy" width={32} height={32} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#0F172A" }}>
            {isInvite ? "Bem-vindo à Disrupy!" : "Redefinir senha"}
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: "#64748B" }}>
            {isInvite
              ? "Crie sua senha para acessar o sistema"
              : "Digite sua nova senha de acesso"}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: "#E2E8F0" }}>
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-12 h-12" style={{ color: "#059669" }} />
              <p className="text-base font-semibold" style={{ color: "#0F172A" }}>Senha salva!</p>
              <p className="text-sm" style={{ color: "#64748B" }}>Redirecionando para o sistema...</p>
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>
                  {isInvite ? "Criar senha" : "Nova senha"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all"
                  style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                  onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                  onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all"
                  style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                  onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                  onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                />
              </div>

              {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
                style={{ backgroundColor: "#2E60FF", opacity: loading ? 0.7 : 1 }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Salvando..." : isInvite ? "Criar senha e entrar" : "Salvar nova senha"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#94A3B8" }}>
          v0.1.0 · Disrupy Comunicação
        </p>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  );
}

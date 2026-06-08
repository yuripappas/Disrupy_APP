"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle2, ArrowLeft, Mail } from "lucide-react";

export default function EsqueciSenhaPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });

    if (error) {
      setError("Erro ao enviar o e-mail. Verifique o endereço e tente novamente.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "#00246D" }}>
            <Image src="/logo-disrupy-branca.svg" alt="Disrupy" width={32} height={32} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#0F172A" }}>Recuperar acesso</h1>
          <p className="text-sm mt-1 text-center" style={{ color: "#64748B" }}>
            Enviaremos um link para redefinir sua senha
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: "#E2E8F0" }}>
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <CheckCircle2 className="w-12 h-12" style={{ color: "#059669" }} />
              <p className="text-base font-semibold" style={{ color: "#0F172A" }}>E-mail enviado!</p>
              <p className="text-sm" style={{ color: "#64748B" }}>
                Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para criar uma nova senha.
              </p>
              <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
                Não recebeu? Verifique a pasta de spam.
              </p>
              <Link
                href="/login"
                className="mt-3 text-sm font-medium flex items-center gap-1"
                style={{ color: "#2E60FF" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#334155" }}>
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94A3B8" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoFocus
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all"
                    style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                    onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                    onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
                  />
                </div>
              </div>

              {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
                style={{ backgroundColor: "#2E60FF", opacity: (loading || !email.trim()) ? 0.7 : 1 }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1 text-sm mt-2"
                style={{ color: "#64748B" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
              </Link>
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

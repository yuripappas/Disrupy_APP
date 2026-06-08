"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#F8FAFC" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: "#00246D" }}
          >
            <Image
              src="/logo-disrupy-branca.svg"
              alt="Disrupy"
              width={32}
              height={32}
            />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#0F172A" }}>
            Disrupy Faturamento
          </h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>
            Entre com sua conta
          </p>
        </div>

        {/* Form */}
        <div
          className="bg-white rounded-2xl p-8 shadow-sm border"
          style={{ borderColor: "#E2E8F0" }}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "#334155" }}
              >
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all"
                style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium" style={{ color: "#334155" }}>
                  Senha
                </label>
                <Link
                  href="/esqueci-senha"
                  className="text-xs font-medium"
                  style={{ color: "#2E60FF" }}
                >
                  Esqueci a senha
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all"
                style={{ borderColor: "#CBD5E1", color: "#0F172A" }}
                onFocus={(e) => (e.target.style.borderColor = "#2E60FF")}
                onBlur={(e) => (e.target.style.borderColor = "#CBD5E1")}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "#EF4444" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: "#2E60FF", opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#94A3B8" }}>
          v0.1.0 · MVP · Disrupy Comunicação
        </p>
      </div>
    </div>
  );
}

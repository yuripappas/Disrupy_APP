"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type CustoInterno = {
  id: string;
  codigo?: string;
  servico: string;
  qtde: number;
  valor_unitario: number;
  valor_total: number;
};

export function CustosInternosSection({ itens }: { itens: CustoInterno[] }) {
  const [aberto, setAberto] = useState(false);

  const total = itens.reduce((s, c) => s + c.valor_total, 0);

  return (
    <div className="rounded-xl border bg-white mb-6 overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      {/* Header — sempre visível, clicável */}
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50"
        style={{ borderBottom: aberto ? "1px solid #E2E8F0" : "none" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: "#0F172A" }}>
            Custos Internos (Tabela de Preços)
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: "#EEF2FF", color: "#2E60FF" }}>
            {itens.length} {itens.length === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: "#0F172A" }}>
            {formatCurrency(total)}
          </span>
          {aberto
            ? <ChevronUp  className="w-4 h-4" style={{ color: "#94A3B8" }} />
            : <ChevronDown className="w-4 h-4" style={{ color: "#94A3B8" }} />}
        </div>
      </button>

      {/* Tabela — só aparece quando aberto */}
      {aberto && (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F8FAFC" }}>
              <th className="text-left px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Código</th>
              <th className="text-left px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Serviço</th>
              <th className="text-right px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Qtde</th>
              <th className="text-right px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Unit.</th>
              <th className="text-right px-6 py-3 text-xs font-medium" style={{ color: "#64748B" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((ci, i) => (
              <tr key={ci.id ?? i} style={{ borderTop: "1px solid #F1F5F9" }}>
                <td className="px-6 py-3 font-mono text-xs" style={{ color: "#64748B" }}>{ci.codigo ?? "—"}</td>
                <td className="px-6 py-3" style={{ color: "#334155" }}>{ci.servico}</td>
                <td className="px-6 py-3 text-right" style={{ color: "#334155" }}>{ci.qtde}</td>
                <td className="px-6 py-3 text-right" style={{ color: "#334155" }}>{formatCurrency(ci.valor_unitario)}</td>
                <td className="px-6 py-3 text-right font-semibold" style={{ color: "#0F172A" }}>{formatCurrency(ci.valor_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DeletarFaturamentoModal({
  faturamento,
  onClose,
}: {
  faturamento: { id: string; nome_campanha: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const confirmed = confirmInput.trim().toUpperCase() === faturamento.nome_campanha.trim().toUpperCase();

  async function handleDelete() {
    if (!confirmed) return;
    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      // 1. Busca IDs dos faturamento_fornecedores
      const { data: ffs } = await supabase
        .from("faturamento_fornecedores")
        .select("id")
        .eq("faturamento_id", faturamento.id);

      const ffIds = (ffs ?? []).map((r: { id: string }) => r.id);

      // 2. Deleta documentos dos fornecedores
      if (ffIds.length > 0) {
        const { error: e1 } = await supabase
          .from("documentos")
          .delete()
          .in("faturamento_fornecedor_id", ffIds);
        if (e1) throw e1;
      }

      // 3. Deleta faturamento_fornecedores
      const { error: e2 } = await supabase
        .from("faturamento_fornecedores")
        .delete()
        .eq("faturamento_id", faturamento.id);
      if (e2) throw e2;

      // 4. Deleta custos internos
      const { error: e3 } = await supabase
        .from("faturamento_custos_internos")
        .delete()
        .eq("faturamento_id", faturamento.id);
      if (e3) throw e3;

      // 5. Deleta etapas
      const { error: e4 } = await supabase
        .from("faturamento_etapas")
        .delete()
        .eq("faturamento_id", faturamento.id);
      if (e4) throw e4;

      // 6. Deleta o faturamento
      const { error: e5 } = await supabase
        .from("faturamentos")
        .delete()
        .eq("id", faturamento.id);
      if (e5) throw e5;

      router.push("/faturamentos");
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir. Você tem permissão de gestor?";
      setError(msg);
      setLoading(false);
    }
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
            <h2 className="text-base font-bold" style={{ color: "#991B1B" }}>Excluir Faturamento</h2>
            <p className="text-xs mt-0.5" style={{ color: "#DC2626" }}>Esta ação não pode ser desfeita</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: "#FFF5F5", border: "1px solid #FEE2E2" }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
            <div className="text-sm" style={{ color: "#991B1B" }}>
              <p className="font-semibold mb-1">Você está prestes a excluir permanentemente:</p>
              <ul className="text-xs space-y-0.5 list-disc ml-4" style={{ color: "#B91C1C" }}>
                <li>O faturamento e todas as etapas</li>
                <li>Todos os fornecedores vinculados</li>
                <li>Todos os documentos e uploads</li>
                <li>Todos os custos internos</li>
              </ul>
            </div>
          </div>

          {/* Campaign name display */}
          <div>
            <p className="text-sm mb-2" style={{ color: "#374151" }}>
              Para confirmar, digite o nome da campanha abaixo:
            </p>
            <div
              className="px-3 py-2 rounded-lg text-sm font-mono font-bold mb-3 select-all"
              style={{ backgroundColor: "#F1F5F9", color: "#0F172A", border: "1px solid #E2E8F0" }}
            >
              {faturamento.nome_campanha}
            </div>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Digite o nome da campanha..."
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
              style={{
                borderColor: confirmInput && !confirmed ? "#EF4444" : confirmed ? "#059669" : "#E2E8F0",
                backgroundColor: "white",
                color: "#0F172A",
              }}
            />
            {confirmInput && !confirmed && (
              <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
                O nome não confere. Verifique maiúsculas/minúsculas.
              </p>
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
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Excluir Permanentemente</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

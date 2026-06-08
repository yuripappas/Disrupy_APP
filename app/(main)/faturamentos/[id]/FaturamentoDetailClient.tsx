"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AdicionarFornecedorModal } from "@/components/faturamentos/AdicionarFornecedorModal";

export function FaturamentoDetailClient({
  faturamentoId,
  fornecedoresJaAdicionados,
}: {
  faturamentoId: string;
  fornecedoresJaAdicionados: string[];
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setAddOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#2E60FF" }}
      >
        <Plus className="w-4 h-4" /> Adicionar Fornecedor
      </button>

      <AdicionarFornecedorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        faturamentoId={faturamentoId}
        fornecedoresJaAdicionados={fornecedoresJaAdicionados}
      />
    </>
  );
}

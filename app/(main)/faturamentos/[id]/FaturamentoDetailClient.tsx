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
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#2E60FF" }}
      >
        <Plus className="w-4 h-4" /> Adicionar Fornecedor
      </button>
      <AdicionarFornecedorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        faturamentoId={faturamentoId}
        fornecedoresJaAdicionados={fornecedoresJaAdicionados}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AdicionarFornecedorModal } from "@/components/faturamentos/AdicionarFornecedorModal";
import { DeletarFaturamentoModal } from "@/components/faturamentos/DeletarFaturamentoModal";

export function FaturamentoDetailClient({
  faturamentoId,
  nomeCampanha,
  fornecedoresJaAdicionados,
  isGestor,
}: {
  faturamentoId: string;
  nomeCampanha: string;
  fornecedoresJaAdicionados: string[];
  isGestor: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        {isGestor && (
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-red-50"
            style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
            title="Excluir faturamento (apenas gestores)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </button>
        )}
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#2E60FF" }}
        >
          <Plus className="w-4 h-4" /> Adicionar Fornecedor
        </button>
      </div>

      <AdicionarFornecedorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        faturamentoId={faturamentoId}
        fornecedoresJaAdicionados={fornecedoresJaAdicionados}
      />

      {deleteOpen && (
        <DeletarFaturamentoModal
          faturamento={{ id: faturamentoId, nome_campanha: nomeCampanha }}
          onClose={() => setDeleteOpen(false)}
        />
      )}
    </>
  );
}

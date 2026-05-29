"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, FormField, Input, Select } from "@/components/ui/Modal";

const DOCS_MIDIA = [
  { tipo: "nf", label: "Nota Fiscal" },
  { tipo: "pi", label: "PI – Pedido de Inserção" },
  { tipo: "comprovacao", label: "Comprovação de Veiculação" },
  { tipo: "tabela_orcamento", label: "Tabela de Preços / Orçamento" },
];

const DOCS_PRODUCAO = [
  { tipo: "nf", label: "Nota Fiscal" },
  { tipo: "evidencia", label: "Evidência de Produção" },
  { tipo: "orcamento_1", label: "Orçamento 1" },
  { tipo: "orcamento_2", label: "Orçamento 2" },
  { tipo: "orcamento_3", label: "Orçamento 3" },
];

type Fornecedor = { id: string; razao_social: string; cnpj: string; tipo: string };

export function AdicionarFornecedorModal({
  open, onClose, faturamentoId, fornecedoresJaAdicionados,
}: {
  open: boolean; onClose: () => void;
  faturamentoId: string; fornecedoresJaAdicionados: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [form, setForm] = useState({
    fornecedor_id: "", valor: "", honorarios: "", prazo_dias: "5",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase.from("fornecedores").select("id, razao_social, cnpj, tipo")
      .eq("ativo", true).order("razao_social")
      .then(({ data }) => {
        setFornecedores((data ?? []).filter((f) => !fornecedoresJaAdicionados.includes(f.id)));
      });
  }, [open, fornecedoresJaAdicionados]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fornecedor_id) return;
    setLoading(true);

    const supabase = createClient();
    const fornecedor = fornecedores.find((f) => f.id === form.fornecedor_id);
    const valor = parseFloat(form.valor.replace(",", ".")) || 0;
    const honorarios = parseFloat(form.honorarios.replace(",", ".")) || 0;

    const { data: ff, error } = await supabase
      .from("faturamento_fornecedores")
      .insert({
        faturamento_id: faturamentoId,
        fornecedor_id: form.fornecedor_id,
        valor,
        honorarios,
        valor_total: valor + honorarios,
        prazo_dias: parseInt(form.prazo_dias) || 5,
        status: "aguardando",
      })
      .select().single();

    if (error || !ff) { setLoading(false); return; }

    const docs = fornecedor?.tipo === "midia" ? DOCS_MIDIA : DOCS_PRODUCAO;
    await supabase.from("documentos").insert(
      docs.map((d) => ({ faturamento_fornecedor_id: ff.id, tipo: d.tipo, label: d.label, status: "pendente" }))
    );

    router.refresh();
    onClose();
    setForm({ fornecedor_id: "", valor: "", honorarios: "", prazo_dias: "5" });
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Fornecedor">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Fornecedor" required>
          <Select value={form.fornecedor_id} onChange={(e) => set("fornecedor_id", e.target.value)} required>
            <option value="">Selecione...</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.razao_social} ({f.tipo === "midia" ? "Mídia" : "Produção"})
              </option>
            ))}
          </Select>
        </FormField>
        {fornecedores.length === 0 && open && (
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            Todos os fornecedores já foram adicionados ou não há fornecedores cadastrados.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Valor (R$)">
            <Input value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
          </FormField>
          <FormField label="Honorários (R$)">
            <Input value={form.honorarios} onChange={(e) => set("honorarios", e.target.value)} placeholder="0,00" />
          </FormField>
        </div>
        <FormField label="Prazo (dias úteis)">
          <Input type="number" min="1" max="30" value={form.prazo_dias} onChange={(e) => set("prazo_dias", e.target.value)} />
        </FormField>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border text-sm font-medium" style={{ borderColor: "#E2E8F0", color: "#64748B" }}>Cancelar</button>
          <button type="submit" disabled={loading || !form.fornecedor_id} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: "#2E60FF", opacity: (loading || !form.fornecedor_id) ? 0.6 : 1 }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

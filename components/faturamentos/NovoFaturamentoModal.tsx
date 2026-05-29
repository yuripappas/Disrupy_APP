"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, FormField, Input, Select } from "@/components/ui/Modal";

const ETAPAS_NOMES = [
  "Iniciar Faturamento",
  "Documentação Fornecedores",
  "Revisão de Documentação",
  "Documentação Agência",
  "Revisão do Processo",
  "Publicação",
  "Aguardando Validação",
  "Conclusão",
];

export function NovoFaturamentoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nome_campanha: "",
    cliente_nome: "",
    cliente_tipo: "governo_al",
    iclips_job_id: "",
    secretaria: "",
    empenho: "",
    valor_total: "",
    prazo_dias_uteis: "5",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();

    // Criar faturamento
    const { data: fat, error: fatErr } = await supabase
      .from("faturamentos")
      .insert({
        nome_campanha: form.nome_campanha.toUpperCase(),
        cliente_nome: form.cliente_nome,
        cliente_tipo: form.cliente_tipo,
        iclips_job_id: form.iclips_job_id || null,
        secretaria: form.secretaria || null,
        empenho: form.empenho || null,
        valor_total: parseFloat(form.valor_total.replace(/\D/g, "").replace(",", ".")) || 0,
        prazo_dias_uteis: parseInt(form.prazo_dias_uteis) || 5,
        status: "aguardando_inicio",
        etapa_atual: 1,
      })
      .select()
      .single();

    if (fatErr || !fat) {
      setError("Erro ao criar faturamento. Tente novamente.");
      setLoading(false);
      return;
    }

    // Criar 8 etapas automaticamente
    const etapas = ETAPAS_NOMES.map((nome, i) => ({
      faturamento_id: fat.id,
      numero: i + 1,
      nome,
      status: i === 0 ? "em_andamento" : "pendente",
      iniciada_em: i === 0 ? new Date().toISOString() : null,
    }));

    await supabase.from("faturamento_etapas").insert(etapas);

    router.push(`/faturamentos/${fat.id}`);
    router.refresh();
    onClose();
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Faturamento">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nome da Campanha" required>
          <Input value={form.nome_campanha} onChange={(e) => set("nome_campanha", e.target.value)} placeholder="TRANSFERÊNCIA DIGITAL" required />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cliente" required>
            <Input value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} placeholder="DETRAN ALAGOAS" required />
          </FormField>
          <FormField label="Tipo de Cliente" required>
            <Select value={form.cliente_tipo} onChange={(e) => set("cliente_tipo", e.target.value)}>
              <option value="governo_al">Governo AL</option>
              <option value="sebrae">SEBRAE</option>
              <option value="prefeitura">Prefeitura</option>
              <option value="brk">BRK</option>
              <option value="outro">Outro</option>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Job iClips">
            <Input value={form.iclips_job_id} onChange={(e) => set("iclips_job_id", e.target.value)} placeholder="#4350" />
          </FormField>
          <FormField label="Empenho">
            <Input value={form.empenho} onChange={(e) => set("empenho", e.target.value)} placeholder="2026NE00913" />
          </FormField>
        </div>

        <FormField label="Secretaria / Emissor">
          <Input value={form.secretaria} onChange={(e) => set("secretaria", e.target.value)} placeholder="Departamento Estadual de Trânsito" />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Valor Total (R$)">
            <Input value={form.valor_total} onChange={(e) => set("valor_total", e.target.value)} placeholder="0,00" />
          </FormField>
          <FormField label="Prazo (dias úteis)">
            <Input type="number" min="1" max="30" value={form.prazo_dias_uteis} onChange={(e) => set("prazo_dias_uteis", e.target.value)} />
          </FormField>
        </div>

        {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border text-sm font-medium" style={{ borderColor: "#E2E8F0", color: "#64748B" }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: "#2E60FF", opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Criando..." : "Criar Faturamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

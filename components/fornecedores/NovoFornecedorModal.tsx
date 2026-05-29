"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, FormField, Input, Select } from "@/components/ui/Modal";

export function NovoFornecedorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tipo: "midia",
    razao_social: "",
    cnpj: "",
    contato_nome: "",
    contato_whatsapp: "",
    contato_email: "",
    telefone: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.from("fornecedores").insert({
      tipo: form.tipo,
      razao_social: form.razao_social.toUpperCase(),
      cnpj: form.cnpj,
      contato_nome: form.contato_nome || null,
      contato_whatsapp: form.contato_whatsapp.replace(/\D/g, "") || null,
      contato_email: form.contato_email || null,
      telefone: form.telefone || null,
      ativo: true,
    });

    if (error) {
      setError(error.message.includes("unique") ? "CNPJ já cadastrado." : "Erro ao salvar. Tente novamente.");
      setLoading(false);
      return;
    }

    router.refresh();
    onClose();
    setForm({ tipo: "midia", razao_social: "", cnpj: "", contato_nome: "", contato_whatsapp: "", contato_email: "", telefone: "" });
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Fornecedor">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Tipo" required>
          <Select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
            <option value="midia">Mídia</option>
            <option value="producao">Produção</option>
          </Select>
        </FormField>

        <FormField label="Razão Social" required>
          <Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} placeholder="EMPRESA LTDA" required />
        </FormField>

        <FormField label="CNPJ" required>
          <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" required />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nome do Contato">
            <Input value={form.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} placeholder="João Silva" />
          </FormField>
          <FormField label="WhatsApp">
            <Input value={form.contato_whatsapp} onChange={(e) => set("contato_whatsapp", e.target.value)} placeholder="82 99999-0000" />
          </FormField>
        </div>

        <FormField label="E-mail">
          <Input type="email" value={form.contato_email} onChange={(e) => set("contato_email", e.target.value)} placeholder="financeiro@empresa.com" />
        </FormField>

        {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border text-sm font-medium" style={{ borderColor: "#E2E8F0", color: "#64748B" }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: "#2E60FF", opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

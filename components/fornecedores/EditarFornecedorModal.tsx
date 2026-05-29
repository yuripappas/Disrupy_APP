"use client";

import { useState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, FormField, Input, Select } from "@/components/ui/Modal";

type Fornecedor = {
  id: string; razao_social: string; cnpj?: string; tipo: "midia" | "producao";
  contato_nome?: string; contato_whatsapp?: string; contato_email?: string;
  telefone?: string; email?: string; endereco?: string; cidade?: string; uf?: string;
  site?: string; ativo: boolean;
};

export function EditarFornecedorModal({
  fornecedor,
  onClose,
  onSaved,
}: {
  fornecedor: Fornecedor | null;
  onClose: () => void;
  onSaved: (updated: Fornecedor) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    tipo: "midia",
    razao_social: "",
    cnpj: "",
    contato_nome: "",
    contato_whatsapp: "",
    contato_email: "",
    telefone: "",
    email: "",
    cidade: "",
    uf: "",
    site: "",
  });

  useEffect(() => {
    if (fornecedor) {
      setForm({
        tipo: fornecedor.tipo,
        razao_social: fornecedor.razao_social,
        cnpj: fornecedor.cnpj ?? "",
        contato_nome: fornecedor.contato_nome ?? "",
        contato_whatsapp: fornecedor.contato_whatsapp ?? "",
        contato_email: fornecedor.contato_email ?? "",
        telefone: fornecedor.telefone ?? "",
        email: fornecedor.email ?? "",
        cidade: fornecedor.cidade ?? "",
        uf: fornecedor.uf ?? "",
        site: fornecedor.site ?? "",
      });
      setError("");
      setConfirmDelete(false);
    }
  }, [fornecedor]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fornecedor) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("fornecedores")
      .update({
        tipo: form.tipo,
        razao_social: form.razao_social.toUpperCase(),
        cnpj: form.cnpj || null,
        contato_nome: form.contato_nome || null,
        contato_whatsapp: form.contato_whatsapp.replace(/\D/g, "") || null,
        contato_email: form.contato_email || null,
        telefone: form.telefone || null,
        email: form.email || null,
        cidade: form.cidade || null,
        uf: form.uf || null,
        site: form.site || null,
      })
      .eq("id", fornecedor.id)
      .select()
      .single();

    if (err || !data) {
      setError("Erro ao salvar. Tente novamente.");
      setLoading(false);
      return;
    }

    onSaved(data as Fornecedor);
    setLoading(false);
  }

  async function handleDelete() {
    if (!fornecedor) return;
    setDeleting(true);
    const supabase = createClient();
    // Soft delete: set ativo = false
    await supabase.from("fornecedores").update({ ativo: false }).eq("id", fornecedor.id);
    onSaved({ ...fornecedor, ativo: false });
    setDeleting(false);
  }

  return (
    <Modal open={!!fornecedor} onClose={onClose} title="Editar Fornecedor">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tipo" required>
            <Select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
              <option value="midia">Mídia</option>
              <option value="producao">Produção</option>
            </Select>
          </FormField>
          <FormField label="CNPJ">
            <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
          </FormField>
        </div>

        <FormField label="Razão Social" required>
          <Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} placeholder="EMPRESA LTDA" required />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nome do Contato">
            <Input value={form.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} placeholder="João Silva" />
          </FormField>
          <FormField label="WhatsApp">
            <Input value={form.contato_whatsapp} onChange={(e) => set("contato_whatsapp", e.target.value)} placeholder="82 99999-0000" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="E-mail do Contato">
            <Input type="email" value={form.contato_email} onChange={(e) => set("contato_email", e.target.value)} placeholder="contato@empresa.com" />
          </FormField>
          <FormField label="E-mail Geral">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="financeiro@empresa.com" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Telefone">
            <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(82) 3333-0000" />
          </FormField>
          <FormField label="Site">
            <Input value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="www.empresa.com.br" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cidade">
            <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Maceió" />
          </FormField>
          <FormField label="UF">
            <Input value={form.uf} onChange={(e) => set("uf", e.target.value)} placeholder="AL" maxLength={2} />
          </FormField>
        </div>

        {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}

        {/* Confirm delete */}
        {confirmDelete && (
          <div className="rounded-lg p-3 border" style={{ backgroundColor: "#FFF5F5", borderColor: "#FCA5A5" }}>
            <p className="text-sm font-medium mb-2" style={{ color: "#991B1B" }}>
              Desativar este fornecedor? Ele não aparecerá mais na lista.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded text-xs border"
                style={{ borderColor: "#E2E8F0", color: "#64748B" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded text-xs font-semibold text-white flex items-center gap-1"
                style={{ backgroundColor: "#DC2626" }}
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Confirmar desativação
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center gap-1.5"
            style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Desativar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border text-sm font-medium"
            style={{ borderColor: "#E2E8F0", color: "#64748B" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: "#2E60FF", opacity: loading ? 0.7 : 1 }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

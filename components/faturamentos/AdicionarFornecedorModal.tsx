"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, ChevronDown, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, FormField, Input } from "@/components/ui/Modal";

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

type Fornecedor = { id: string; razao_social: string; cnpj?: string; tipo: "midia" | "producao" };

export function AdicionarFornecedorModal({
  open, onClose, faturamentoId, fornecedoresJaAdicionados,
}: {
  open: boolean; onClose: () => void;
  faturamentoId: string; fornecedoresJaAdicionados: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // Combobox state
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Fornecedor | null>(null);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({ valor: "", honorarios: "", prazo_dias: "5" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Load suppliers when modal opens
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("fornecedores")
      .select("id, razao_social, cnpj, tipo")
      .eq("ativo", true)
      .order("razao_social")
      .then(({ data }) => {
        setFornecedores(
          (data ?? []).filter((f) => !fornecedoresJaAdicionados.includes(f.id)) as Fornecedor[]
        );
      });
  }, [open, fornecedoresJaAdicionados]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelecionado(null);
      setBusca("");
      setDropdownAberto(false);
      setForm({ valor: "", honorarios: "", prazo_dias: "5" });
    }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Filter + group
  const filtrados = fornecedores.filter((f) =>
    f.razao_social.toLowerCase().includes(busca.toLowerCase()) ||
    (f.cnpj ?? "").includes(busca)
  );
  const midia = filtrados.filter((f) => f.tipo === "midia");
  const producao = filtrados.filter((f) => f.tipo === "producao");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selecionado) return;
    setLoading(true);

    const supabase = createClient();
    const valor = parseFloat(form.valor.replace(/\./g, "").replace(",", ".")) || 0;
    const honorarios = parseFloat(form.honorarios.replace(/\./g, "").replace(",", ".")) || 0;

    const { data: ff, error } = await supabase
      .from("faturamento_fornecedores")
      .insert({
        faturamento_id: faturamentoId,
        fornecedor_id: selecionado.id,
        valor,
        honorarios,
        valor_total: valor + honorarios,
        prazo_dias: parseInt(form.prazo_dias) || 5,
        status: "aguardando",
      })
      .select()
      .single();

    if (error || !ff) { setLoading(false); return; }

    const docs = selecionado.tipo === "midia" ? DOCS_MIDIA : DOCS_PRODUCAO;
    await supabase.from("documentos").insert(
      docs.map((d) => ({
        faturamento_fornecedor_id: ff.id,
        tipo: d.tipo,
        label: d.label,
        status: "pendente",
      }))
    );

    router.refresh();
    onClose();
    setLoading(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Fornecedor">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Combobox fornecedor */}
        <FormField label="Fornecedor" required>
          <div ref={dropdownRef} className="relative">
            {selecionado ? (
              /* Selected state */
              <div
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "#2E60FF", backgroundColor: "#EEF2FF" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 text-white"
                    style={{ backgroundColor: selecionado.tipo === "midia" ? "#00246D" : "#7C3AED" }}
                  >
                    {selecionado.tipo === "midia" ? "Mídia" : "Prod."}
                  </span>
                  <span className="font-medium truncate" style={{ color: "#0F172A" }}>
                    {selecionado.razao_social}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelecionado(null); setBusca(""); }}
                  className="ml-2 flex-shrink-0 hover:opacity-70"
                  style={{ color: "#64748B" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                {/* Search input */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "#94A3B8" }}
                  />
                  <input
                    type="text"
                    placeholder="Buscar fornecedor..."
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setDropdownAberto(true); }}
                    onFocus={() => setDropdownAberto(true)}
                    className="w-full pl-8 pr-8 py-2 rounded-lg border text-sm outline-none"
                    style={{
                      borderColor: dropdownAberto ? "#2E60FF" : "#E2E8F0",
                      backgroundColor: "white",
                      color: "#334155",
                    }}
                  />
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-transform"
                    style={{
                      color: "#94A3B8",
                      transform: dropdownAberto ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </div>

                {/* Dropdown */}
                {dropdownAberto && (
                  <div
                    className="absolute z-50 w-full mt-1 rounded-lg border shadow-xl overflow-y-auto"
                    style={{ borderColor: "#E2E8F0", backgroundColor: "white", maxHeight: "260px" }}
                  >
                    {filtrados.length === 0 ? (
                      <div className="px-3 py-3 text-xs" style={{ color: "#94A3B8" }}>
                        {fornecedores.length === 0
                          ? "Todos os fornecedores já foram adicionados."
                          : "Nenhum fornecedor encontrado."}
                      </div>
                    ) : (
                      <>
                        {midia.length > 0 && (
                          <div>
                            <div
                              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider sticky top-0 flex items-center gap-2"
                              style={{ backgroundColor: "#EEF2FF", color: "#00246D", borderBottom: "1px solid #E2E8F0" }}
                            >
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#00246D" }} />
                              Mídia · {midia.length}
                            </div>
                            {midia.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => { setSelecionado(f); setBusca(""); setDropdownAberto(false); }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
                                style={{ color: "#0F172A" }}
                              >
                                <span className="font-medium">{f.razao_social}</span>
                                {f.cnpj && (
                                  <span className="ml-2 text-xs font-mono" style={{ color: "#94A3B8" }}>
                                    {f.cnpj}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        {producao.length > 0 && (
                          <div>
                            <div
                              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider sticky top-0 flex items-center gap-2"
                              style={{ backgroundColor: "#F5F3FF", color: "#7C3AED", borderBottom: "1px solid #E2E8F0", borderTop: midia.length > 0 ? "1px solid #E2E8F0" : undefined }}
                            >
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#7C3AED" }} />
                              Produção · {producao.length}
                            </div>
                            {producao.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => { setSelecionado(f); setBusca(""); setDropdownAberto(false); }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 transition-colors"
                                style={{ color: "#0F172A" }}
                              >
                                <span className="font-medium">{f.razao_social}</span>
                                {f.cnpj && (
                                  <span className="ml-2 text-xs font-mono" style={{ color: "#94A3B8" }}>
                                    {f.cnpj}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Valor (R$)">
            <Input value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
          </FormField>
          <FormField label="Honorários (R$)">
            <Input value={form.honorarios} onChange={(e) => set("honorarios", e.target.value)} placeholder="0,00" />
          </FormField>
        </div>

        <FormField label="Prazo (dias úteis)">
          <Input
            type="number"
            min="1"
            max="30"
            value={form.prazo_dias}
            onChange={(e) => set("prazo_dias", e.target.value)}
          />
        </FormField>

        <div className="flex gap-3 pt-2">
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
            disabled={loading || !selecionado}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: "#2E60FF", opacity: loading || !selecionado ? 0.6 : 1 }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

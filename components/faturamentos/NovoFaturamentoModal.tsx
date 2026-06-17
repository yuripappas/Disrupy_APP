"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, ChevronDown, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal, FormField, Input, Select } from "@/components/ui/Modal";

const ETAPAS_NOMES = [
  "Enviar Faturamento",
  "Documentação Fornecedores",
  "Documentação Agência",
  "Revisão do Processo",
  "Publicação",
  "Concluído",
];

type Cliente = {
  id: string;
  nome: string;
  tipo: string;
  grupo?: string;
};

export function NovoFaturamentoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Cliente selector state
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    nome_campanha: "",
    cliente_tipo: "governo_al",
    iclips_job_id: "",
    secretaria: "",
    empenho: "",
    valor_total: "",
    prazo_dias_uteis: "5",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Load clients when modal opens
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("clientes")
      .select("id, nome, tipo, grupo")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setClientes(data ?? []));
  }, [open]);

  function resetForm() {
    setClienteSelecionado(null);
    setClienteBusca("");
    setDropdownAberto(false);
    setError("");
    setForm({
      nome_campanha: "",
      cliente_tipo: "governo_al",
      iclips_job_id: "",
      secretaria: "",
      empenho: "",
      valor_total: "",
      prazo_dias_uteis: "5",
    });
  }

  function handleClose() {
    resetForm();
    onClose();
  }

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

  const clientesFiltrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(clienteBusca.toLowerCase())
  );

  // Group filtered clients by grupo
  const clientesAgrupados = clientesFiltrados.reduce<Record<string, Cliente[]>>((acc, c) => {
    const grupo = c.grupo || "Outros";
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(c);
    return acc;
  }, {});
  const grupos = Object.keys(clientesAgrupados).sort();

  function selecionarCliente(c: Cliente) {
    setClienteSelecionado(c);
    setClienteBusca("");
    setDropdownAberto(false);
    set("cliente_tipo", c.tipo || "outro");
  }

  function limparCliente() {
    setClienteSelecionado(null);
    setClienteBusca("");
    set("cliente_tipo", "governo_al");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteSelecionado) {
      setError("Selecione um cliente.");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient();

    const { data: fat, error: fatErr } = await supabase
      .from("faturamentos")
      .insert({
        nome_campanha: form.nome_campanha.toUpperCase(),
        cliente_id: clienteSelecionado.id,
        cliente_nome: clienteSelecionado.nome,
        cliente_tipo: form.cliente_tipo,
        iclips_job_id: form.iclips_job_id || null,
        secretaria: form.secretaria || null,
        empenho: form.empenho || null,
        valor_total: parseFloat(form.valor_total.replace(/\./g, "").replace(",", ".")) || 0,
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
    <Modal open={open} onClose={handleClose} title="Novo Faturamento">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nome da Campanha" required>
          <Input
            value={form.nome_campanha}
            onChange={(e) => set("nome_campanha", e.target.value)}
            placeholder="TRANSFERÊNCIA DIGITAL"
            required
          />
        </FormField>

        {/* Cliente Selector */}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cliente" required>
            <div ref={dropdownRef} className="relative">
              {clienteSelecionado ? (
                <div
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "#2E60FF", backgroundColor: "#EEF2FF", color: "#0F172A" }}
                >
                  <span className="font-medium truncate">{clienteSelecionado.nome}</span>
                  <button
                    type="button"
                    onClick={limparCliente}
                    className="ml-2 flex-shrink-0 hover:opacity-70"
                    style={{ color: "#64748B" }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
                    <input
                      type="text"
                      placeholder="Selecione um cliente..."
                      value={clienteBusca}
                      onChange={(e) => { setClienteBusca(e.target.value); setDropdownAberto(true); }}
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
                      style={{ color: "#94A3B8", transform: dropdownAberto ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </div>
                  {dropdownAberto && (
                    <div
                      className="absolute z-50 w-full mt-1 rounded-lg border shadow-xl overflow-y-auto"
                      style={{ borderColor: "#E2E8F0", backgroundColor: "white", maxHeight: "240px" }}
                    >
                      {grupos.length === 0 ? (
                        <div className="px-3 py-3 text-xs" style={{ color: "#94A3B8" }}>
                          Nenhum cliente encontrado
                        </div>
                      ) : (
                        grupos.map((grupo) => (
                          <div key={grupo}>
                            <div
                              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider sticky top-0"
                              style={{ backgroundColor: "#F8FAFC", color: "#64748B", borderBottom: "1px solid #F1F5F9" }}
                            >
                              {grupo}
                            </div>
                            {clientesAgrupados[grupo].map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => selecionarCliente(c)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
                                style={{ color: "#0F172A" }}
                              >
                                {c.nome}
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
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
          <Input
            value={form.secretaria}
            onChange={(e) => set("secretaria", e.target.value)}
            placeholder="Departamento Estadual de Trânsito"
          />
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
          <button
            type="button"
            onClick={handleClose}
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
            {loading ? "Criando..." : "Criar Faturamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

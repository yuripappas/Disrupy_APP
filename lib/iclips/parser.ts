import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DadosGerais = {
  proposta_id: number;
  job_id: string;         // "2955"
  nome_campanha: string;  // "MAIO AMARELO 2024"
  cliente_nome: string;   // "DETRAN ALAGOAS"
  status: string;
};

export type CustoInterno = {
  codigo: string;
  descricao: string;  // Produto/Serviço
  servico: string;    // Serviço (descrição do item)
  qtde: number;
  valor_unitario: number;
  valor_total: number;
};

export type OrcamentoGrupo = {
  nome_fornecedor: string;
  itens: string[];        // lista de peças
  valor: number;          // soma Valor Cobrado
  honorarios: number;     // soma Honorário (vem da planilha)
  valor_total: number;
};

export type MidiaGrupo = {
  nome_veiculo: string;
  tipo_midia: string;
  codigo?: string;        // PI — coluna Código da aba Mídias
  valor: number;          // soma Valor da Mídia
  honorarios: number;     // 20% default (editável)
  valor_total: number;
};

export type IClipsProposta = {
  dados_gerais: DadosGerais;
  custos_internos: CustoInterno[];
  orcamentos: OrcamentoGrupo[];
  midias: MidiaGrupo[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v.replace(",", ".")) || 0;
  return 0;
}

function s(v: unknown): string {
  return String(v ?? "").trim();
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parseIClipsXlsx(buffer: ArrayBuffer): IClipsProposta {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  // ── Aba 1: Dados Gerais ──────────────────────────────────────────────────
  const wsDG = wb.Sheets["Dados Gerais"];
  if (!wsDG) throw new Error("Aba 'Dados Gerais' não encontrada.");
  const dgRows = XLSX.utils.sheet_to_json<unknown[]>(wsDG, { header: 1 });
  const dgData = (dgRows[1] ?? []) as unknown[];

  const projetoRaw = s(dgData[1]);
  const projetoMatch = projetoRaw.match(/^#?(\d+)\s*[-–]\s*(.+)$/);
  const job_id = projetoMatch ? projetoMatch[1] : "";
  const nome_campanha = projetoMatch
    ? projetoMatch[2].trim().toUpperCase()
    : projetoRaw.toUpperCase();

  const dados_gerais: DadosGerais = {
    proposta_id: n(dgData[0]),
    job_id,
    nome_campanha,
    cliente_nome: s(dgData[2]).toUpperCase(),
    status: s(dgData[3]),
  };

  // ── Aba 2: Custos Internos (opcional) ───────────────────────────────────
  const wsCI = wb.Sheets["Custos Internos"];
  const ciRows = wsCI ? XLSX.utils.sheet_to_json<unknown[]>(wsCI, { header: 1 }) : [];

  const custos_internos: CustoInterno[] = [];
  for (let i = 1; i < ciRows.length; i++) {
    const row = ciRows[i] as unknown[];
    if (!row || !row[0]) continue;
    const codigo  = s(row[0]);
    const produto = s(row[1]);
    const servico = s(row[3]);
    const qtde    = n(row[9]);
    const valorCobrado = n(row[11]);
    const total   = n(row[13]) || valorCobrado;

    if (!produto) continue;

    // valor_unitario = total / qtde
    const qtdeReal = qtde > 0 ? qtde : 1;
    custos_internos.push({
      codigo,
      descricao: produto,
      servico,
      qtde: qtdeReal,
      valor_unitario: Math.round((total / qtdeReal) * 100) / 100,
      valor_total: total,
    });
  }

  // ── Aba 3: Orçamentos (opcional) — agrupar por Fornecedor ────────────────
  const wsOrc = wb.Sheets["Orçamentos"];
  const orcRows = wsOrc ? XLSX.utils.sheet_to_json<unknown[]>(wsOrc, { header: 1 }) : [];

  const orcMap = new Map<string, OrcamentoGrupo>();
  for (let i = 1; i < orcRows.length; i++) {
    const row = orcRows[i] as unknown[];
    if (!row || !row[0]) continue;
    const nomeForn = s(row[0]);
    if (!nomeForn) continue;

    const peca       = s(row[1]);
    const valorCobrado = n(row[6]);
    const honorario  = n(row[7]);
    const total      = n(row[10]) || valorCobrado + honorario;

    if (!orcMap.has(nomeForn)) {
      orcMap.set(nomeForn, { nome_fornecedor: nomeForn, itens: [], valor: 0, honorarios: 0, valor_total: 0 });
    }
    const entry = orcMap.get(nomeForn)!;
    if (peca) entry.itens.push(peca);
    entry.valor       = Math.round((entry.valor       + valorCobrado) * 100) / 100;
    entry.honorarios  = Math.round((entry.honorarios  + honorario) * 100) / 100;
    entry.valor_total = Math.round((entry.valor_total + total) * 100) / 100;
  }
  const orcamentos = Array.from(orcMap.values());

  // ── Aba 4: Mídias (opcional) — agrupar por Veículo ──────────────────────
  const wsMid = wb.Sheets["Mídias"];
  const midRows = wsMid ? XLSX.utils.sheet_to_json<unknown[]>(wsMid, { header: 1 }) : [];

  const midMap = new Map<string, MidiaGrupo>();
  for (let i = 1; i < midRows.length; i++) {
    const row = midRows[i] as unknown[];
    if (!row || !row[2]) continue;
    const codigo      = s(row[0]);  // PI — coluna Código (col A)
    const tipo_midia  = s(row[1]);
    const nomeVeiculo = s(row[2]);
    const valorMidia  = n(row[5]);
    if (!nomeVeiculo) continue;

    if (!midMap.has(nomeVeiculo)) {
      midMap.set(nomeVeiculo, {
        nome_veiculo: nomeVeiculo, tipo_midia,
        codigo: codigo || undefined,
        valor: 0, honorarios: 0, valor_total: 0,
      });
    }
    const entry = midMap.get(nomeVeiculo)!;
    entry.valor = Math.round((entry.valor + valorMidia) * 100) / 100;
  }

  // Calcula honorários (20% default) para mídias
  const HON_RATE = 0.20;
  const midias: MidiaGrupo[] = Array.from(midMap.values()).map((m) => ({
    ...m,
    honorarios: Math.round(m.valor * HON_RATE * 100) / 100,
    valor_total: Math.round(m.valor * (1 + HON_RATE) * 100) / 100,
  }));

  return { dados_gerais, custos_internos, orcamentos, midias };
}

// ── Name normalization for fuzzy matching ─────────────────────────────────────

export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove accents
    .replace(/[^\w\s]/g, " ")         // remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

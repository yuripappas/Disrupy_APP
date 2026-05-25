export type EtapaStatus =
  | "pendente"
  | "em_andamento"
  | "concluida"
  | "inconformidade";

export type FaturamentoStatus =
  | "aguardando_inicio"
  | "docs_fornecedores"
  | "revisao_docs"
  | "docs_agencia"
  | "revisao_processo"
  | "publicacao"
  | "aguardando_validacao"
  | "concluido"
  | "cancelado";

export type TipoCliente = "governo_al" | "sebrae" | "prefeitura" | "brk" | "outro";

export type TipoFornecedor = "midia" | "producao";

export type DocumentoStatus = "pendente" | "enviado" | "aprovado" | "rejeitado";

export interface Fornecedor {
  id: string;
  razao_social: string;
  cnpj: string;
  tipo: TipoFornecedor;
  contato_nome: string;
  contato_whatsapp: string;
  contato_email: string;
  telefone?: string;
  ativo: boolean;
}

export interface DocumentoFornecedor {
  tipo: "nf" | "pi" | "comprovacao" | "tabela_orcamento" | "orcamento_1" | "orcamento_2" | "orcamento_3" | "evidencia";
  label: string;
  status: DocumentoStatus;
  arquivo_url?: string;
  enviado_em?: string;
}

export interface FornecedorNoProjeto {
  id: string;
  fornecedor: Fornecedor;
  valor: number;
  honorarios?: number;
  valor_total: number;
  nf_numero?: string;
  link_token: string;
  documentos: DocumentoFornecedor[];
  prazo_dias: number;
  dias_cobrados: number;
  status: "aguardando" | "parcial" | "completo";
}

export interface CustoInterno {
  codigo: string;
  servico: string;
  qtde: number;
  valor_unitario: number;
  valor_total: number;
}

export interface Etapa {
  numero: number;
  nome: string;
  status: EtapaStatus;
  iniciada_em?: string;
  concluida_em?: string;
  inconformidade_motivo?: string;
  retornos: number;
}

export interface Faturamento {
  id: string;
  iclips_job_id: string;
  iclips_proposta_id: string;
  nome_campanha: string;
  cliente_nome: string;
  cliente_tipo: TipoCliente;
  secretaria?: string;
  empenho?: string;
  status: FaturamentoStatus;
  etapa_atual: number;
  etapas: Etapa[];
  custos_internos: CustoInterno[];
  fornecedores: FornecedorNoProjeto[];
  valor_total: number;
  criado_em: string;
  atualizado_em: string;
  responsavel_midia?: string;
  responsavel_producao?: string;
  responsavel_faturamento?: string;
}

export interface Certidao {
  id: string;
  tipo: "federal" | "estadual" | "municipal" | "fgts" | "trabalhista" | "falencia";
  label: string;
  validade: string;
  status: "valida" | "vencendo" | "vencida";
  arquivo_url?: string;
}

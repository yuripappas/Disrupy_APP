-- ============================================================
-- DISRUPY FATURAMENTO — Schema do Banco de Dados
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ============================================================
-- PERFIS DE USUÁRIO
-- ============================================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  email text not null,
  perfil text not null default 'faturamento'
    check (perfil in ('gestor', 'midia', 'producao', 'faturamento')),
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Trigger: cria perfil automaticamente ao criar usuário
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'perfil', 'faturamento')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- FORNECEDORES (cadastro geral)
-- ============================================================
create table if not exists fornecedores (
  id uuid default uuid_generate_v4() primary key,
  razao_social text not null,
  cnpj text not null unique,
  tipo text not null check (tipo in ('midia', 'producao')),
  contato_nome text,
  contato_whatsapp text,
  contato_email text,
  telefone text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CERTIDÕES
-- ============================================================
create table if not exists certidoes (
  id uuid default uuid_generate_v4() primary key,
  tipo text not null check (tipo in ('federal', 'estadual', 'municipal', 'fgts', 'trabalhista', 'falencia')),
  label text not null,
  validade date not null,
  arquivo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- FATURAMENTOS
-- ============================================================
create table if not exists faturamentos (
  id uuid default uuid_generate_v4() primary key,
  iclips_job_id text,
  iclips_proposta_id text,
  nome_campanha text not null,
  cliente_nome text not null,
  cliente_tipo text not null check (cliente_tipo in ('governo_al', 'sebrae', 'prefeitura', 'brk', 'outro')),
  secretaria text,
  empenho text,
  status text not null default 'aguardando_inicio'
    check (status in ('aguardando_inicio','docs_fornecedores','revisao_docs','docs_agencia','revisao_processo','publicacao','aguardando_validacao','concluido','cancelado')),
  etapa_atual integer default 1,
  valor_total numeric(12,2) default 0,
  prazo_dias_uteis integer default 5,
  prazo_inicio date,
  responsavel_midia_id uuid references profiles(id),
  responsavel_faturamento_id uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ETAPAS DO FATURAMENTO
-- ============================================================
create table if not exists faturamento_etapas (
  id uuid default uuid_generate_v4() primary key,
  faturamento_id uuid references faturamentos(id) on delete cascade not null,
  numero integer not null,
  nome text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluida', 'retornada')),
  iniciada_em timestamptz,
  concluida_em timestamptz,
  retornos integer default 0,
  inconformidade_motivo text,
  created_at timestamptz default now()
);

-- ============================================================
-- CUSTOS INTERNOS
-- ============================================================
create table if not exists faturamento_custos_internos (
  id uuid default uuid_generate_v4() primary key,
  faturamento_id uuid references faturamentos(id) on delete cascade not null,
  codigo text not null,
  servico text not null,
  qtde numeric(10,2) not null,
  valor_unitario numeric(12,2) not null,
  valor_total numeric(12,2) not null,
  ordem integer default 0,
  created_at timestamptz default now()
);

-- Documentos dos custos internos (peças de criação)
create table if not exists custo_interno_documentos (
  id uuid default uuid_generate_v4() primary key,
  custo_interno_id uuid references faturamento_custos_internos(id) on delete cascade not null,
  label text not null default 'Peça em PDF',
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'aprovado', 'reprovado')),
  arquivo_url text,
  arquivo_nome text,
  reprovacao_motivo text,
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- FATURAMENTO × FORNECEDORES (vínculo por campanha)
-- ============================================================
create table if not exists faturamento_fornecedores (
  id uuid default uuid_generate_v4() primary key,
  faturamento_id uuid references faturamentos(id) on delete cascade not null,
  fornecedor_id uuid references fornecedores(id) not null,
  valor numeric(12,2) default 0,
  honorarios numeric(12,2) default 0,
  valor_total numeric(12,2) default 0,
  nf_numero text,
  link_token uuid default uuid_generate_v4() unique not null,
  prazo_dias integer default 5,
  status text not null default 'aguardando'
    check (status in ('aguardando', 'parcial', 'completo', 'aprovado', 'reprovado')),
  mensagens_enviadas integer default 0,
  ultima_mensagem_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DOCUMENTOS DOS FORNECEDORES
-- ============================================================
create table if not exists documentos (
  id uuid default uuid_generate_v4() primary key,
  faturamento_fornecedor_id uuid references faturamento_fornecedores(id) on delete cascade not null,
  tipo text not null,
  label text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'aprovado', 'reprovado')),
  arquivo_url text,
  arquivo_nome text,
  reprovacao_motivo text,
  aprovado_por uuid references profiles(id),
  aprovado_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- HISTÓRICO DE MENSAGENS
-- ============================================================
create table if not exists mensagens (
  id uuid default uuid_generate_v4() primary key,
  faturamento_fornecedor_id uuid references faturamento_fornecedores(id) on delete cascade not null,
  canal text not null check (canal in ('email', 'whatsapp', 'sms', 'ligacao_ia')),
  template_usado text,
  conteudo text,
  status text not null default 'enviada'
    check (status in ('enviada', 'entregue', 'lida', 'falhou')),
  enviada_em timestamptz default now(),
  created_at timestamptz default now()
);

-- ============================================================
-- SEQUÊNCIAS DE AUTOMAÇÃO
-- ============================================================
create table if not exists automacao_sequencias (
  id uuid default uuid_generate_v4() primary key,
  faturamento_id uuid references faturamentos(id) on delete cascade,
  nome text not null,
  passos jsonb not null default '[]',
  ativa boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table fornecedores enable row level security;
alter table certidoes enable row level security;
alter table faturamentos enable row level security;
alter table faturamento_etapas enable row level security;
alter table faturamento_custos_internos enable row level security;
alter table custo_interno_documentos enable row level security;
alter table faturamento_fornecedores enable row level security;
alter table documentos enable row level security;
alter table mensagens enable row level security;
alter table automacao_sequencias enable row level security;

-- Usuários autenticados: acesso total (MVP — refinamos por perfil depois)
create policy "auth_all" on profiles for all to authenticated using (true) with check (true);
create policy "auth_all" on fornecedores for all to authenticated using (true) with check (true);
create policy "auth_all" on certidoes for all to authenticated using (true) with check (true);
create policy "auth_all" on faturamentos for all to authenticated using (true) with check (true);
create policy "auth_all" on faturamento_etapas for all to authenticated using (true) with check (true);
create policy "auth_all" on faturamento_custos_internos for all to authenticated using (true) with check (true);
create policy "auth_all" on custo_interno_documentos for all to authenticated using (true) with check (true);
create policy "auth_all" on faturamento_fornecedores for all to authenticated using (true) with check (true);
create policy "auth_all" on documentos for all to authenticated using (true) with check (true);
create policy "auth_all" on mensagens for all to authenticated using (true) with check (true);
create policy "auth_all" on automacao_sequencias for all to authenticated using (true) with check (true);

-- Portal do fornecedor: acesso anônimo por token (somente leitura + upload)
create policy "portal_select" on faturamento_fornecedores for select to anon using (true);
create policy "portal_select" on documentos for select to anon using (true);
create policy "portal_update" on documentos for update to anon using (true) with check (true);
create policy "portal_insert" on documentos for insert to anon with check (true);
create policy "portal_select" on faturamentos for select to anon using (true);
create policy "portal_select" on fornecedores for select to anon using (true);

-- ============================================================
-- DADOS INICIAIS — Certidões da Disrupy
-- ============================================================
insert into certidoes (tipo, label, validade) values
  ('federal',      'Federal (Receita Federal + PGFN)',    '2026-07-29'),
  ('estadual',     'Estadual (SEFAZ-AL)',                 '2026-05-05'),
  ('municipal',    'Municipal (SEMFAZ Maceió)',           '2026-06-29'),
  ('fgts',         'FGTS (Caixa Econômica Federal)',      '2026-04-26'),
  ('trabalhista',  'Trabalhista (TST)',                   '2026-04-13'),
  ('falencia',     'Falência/Concordata (TJAL)',          '2026-05-06')
on conflict do nothing;

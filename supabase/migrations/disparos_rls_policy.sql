-- Garante que a tabela disparos tem RLS habilitado e política de acesso para usuários autenticados.
-- Sem essa política, o Supabase devolve array vazio para o client SSR, apagando o histórico de envios na UI.

alter table if exists disparos enable row level security;

drop policy if exists "auth_all" on disparos;
create policy "auth_all" on disparos
  for all
  to authenticated
  using (true)
  with check (true);

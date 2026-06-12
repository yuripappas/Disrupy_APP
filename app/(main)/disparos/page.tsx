import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { MonitoramentoClient } from "@/components/disparos/MonitoramentoClient";
import type { FFRow } from "@/components/disparos/MonitoramentoClient";

export const revalidate = 0; // sempre fresh

export default async function DisparosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.app_metadata?.role;
  if (!user || !["gestor", "faturamento"].includes(role)) {
    redirect("/dashboard");
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Busca todos os ffs associados com link_token, com fornecedor, documentos e disparos
  const { data, error } = await admin
    .from("faturamento_fornecedores")
    .select(`
      id, link_token, valor_total, envio_inicial_em,
      faturamento:faturamentos ( id, nome_campanha, iclips_job_id ),
      fornecedor:fornecedores  ( id, razao_social, cnpj, contato_nome, contato_whatsapp ),
      documentos               ( id, status ),
      disparos                 ( id, tipo, subtipo, status, created_at, enviado_em, agendado_para )
    `)
    .eq("associado", true)
    .not("link_token", "is", null);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: "#DC2626" }}>
          Erro ao carregar dados: {error.message}
        </p>
      </div>
    );
  }

  // Filtra apenas fornecedores com WhatsApp cadastrado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elegíveis = ((data ?? []) as any[]).filter(
    (ff) => ff.fornecedor?.contato_whatsapp,
  ) as FFRow[];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#0F172A" }}>
          Central de Disparos
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Monitore e gerencie os envios de WhatsApp para todos os fornecedores
        </p>
      </div>

      <MonitoramentoClient ffs={elegíveis} />
    </div>
  );
}

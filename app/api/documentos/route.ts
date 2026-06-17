import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { enviarMensagem, estadoConexao } from "@/lib/evolution-api";
import { sendEmail } from "@/lib/email";
import { interpolar, buildVars } from "@/lib/cadencia";

const INSTANCE_NAME = "disrupy";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://disrupy-app.vercel.app";

// PATCH /api/documentos — aprovar ou reprovar um documento
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const role = user.app_metadata?.role as string;
  if (role !== "gestor" && role !== "faturamento") {
    return NextResponse.json({ error: "Sem permissão. Apenas Gestor e Faturamento podem revisar documentos." }, { status: 403 });
  }

  const { documentoId, acao, motivo, numeroNf } = await req.json();

  if (!documentoId || !acao) {
    return NextResponse.json({ error: "documentoId e acao são obrigatórios" }, { status: 400 });
  }

  // ── Atualização manual do número de NF ──────────────────────────────────────
  if (acao === "numero_nf") {
    if (!numeroNf?.trim()) {
      return NextResponse.json({ error: "Número da NF é obrigatório" }, { status: 400 });
    }
    const { error } = await supabase
      .from("documentos")
      .update({ numero_nf: numeroNf.trim(), numero_nf_status: "manual" })
      .eq("id", documentoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (acao !== "aprovar" && acao !== "reprovar") {
    return NextResponse.json({ error: "acao deve ser 'aprovar', 'reprovar' ou 'numero_nf'" }, { status: 400 });
  }
  if (acao === "reprovar" && !motivo?.trim()) {
    return NextResponse.json({ error: "Motivo é obrigatório para reprovar" }, { status: 400 });
  }

  const updates =
    acao === "aprovar"
      ? {
          status: "aprovado",
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
          reprovacao_motivo: null,
        }
      : {
          status: "reprovado",
          reprovacao_motivo: motivo.trim(),
          aprovado_por: null,
          aprovado_em: null,
        };

  const { error } = await supabase
    .from("documentos")
    .update(updates)
    .eq("id", documentoId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Dispara notificações em background (não bloqueia resposta)
  if (acao === "reprovar") {
    void dispararDivergencia(documentoId).catch((e) =>
      console.error("[documentos] Erro ao disparar divergência:", e),
    );
  } else if (acao === "aprovar") {
    void dispararConfirmacaoSeCompleto(documentoId).catch((e) =>
      console.error("[documentos] Erro ao verificar confirmação:", e),
    );
  }

  return NextResponse.json({ success: true });
}

// ── Notificação de divergência ────────────────────────────────────────────────

async function dispararDivergencia(documentoId: string) {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Busca template de divergência
  const { data: tmpl } = await admin
    .from("cadencia_templates")
    .select("ativo, canal_whatsapp, canal_email, mensagem_whatsapp, assunto_email, corpo_email")
    .eq("step", "divergencia")
    .single();

  if (!tmpl?.ativo) return;

  // Busca dados do ff/fornecedor via documento
  const { data: doc } = await admin
    .from("documentos")
    .select(`
      faturamento_fornecedor_id,
      faturamento_fornecedor:faturamento_fornecedores (
        id, link_token,
        faturamento:faturamentos ( nome_campanha ),
        fornecedor:fornecedores ( razao_social, contato_nome, contato_whatsapp, contato_email )
      )
    `)
    .eq("id", documentoId)
    .single();

  if (!doc) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ff   = (doc.faturamento_fornecedor as any);
  if (!ff?.link_token) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forn = (ff.fornecedor as any) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fat  = (ff.faturamento as any) ?? {};
  const portalUrl = `${APP_URL}/portal/${ff.link_token}`;

  const vars = buildVars({
    contatoNome:  forn.contato_nome,
    razaoSocial:  forn.razao_social ?? "",
    nomeCampanha: fat.nome_campanha ?? "",
    portalUrl,
  });

  const agora = new Date().toISOString();

  // WhatsApp
  if (tmpl.canal_whatsapp && forn.contato_whatsapp && tmpl.mensagem_whatsapp) {
    const msg = interpolar(tmpl.mensagem_whatsapp, vars);
    try {
      const estado = await estadoConexao(INSTANCE_NAME);
      if (estado === "open") {
        await enviarMensagem(INSTANCE_NAME, forn.contato_whatsapp, msg);
        await admin.from("disparos").insert({
          faturamento_fornecedor_id: ff.id,
          tipo: "whatsapp", subtipo: "divergencia",
          numero_destino: forn.contato_whatsapp,
          mensagem: msg, status: "enviado", enviado_em: agora,
        });
      }
    } catch (e) { console.error("[divergência WA]", e); }
  }

  // Email
  if (tmpl.canal_email && forn.contato_email && tmpl.corpo_email && tmpl.assunto_email) {
    const html    = interpolar(tmpl.corpo_email,   vars);
    const subject = interpolar(tmpl.assunto_email, vars);
    try {
      const res = await sendEmail({ to: forn.contato_email, subject, html });
      await admin.from("disparos").insert({
        faturamento_fornecedor_id: ff.id,
        tipo: "email", subtipo: "divergencia",
        email_destino: forn.contato_email,
        assunto: subject, mensagem: html,
        status: res.ok ? "enviado" : "falhou",
        enviado_em: res.ok ? agora : null,
        erro: res.ok ? null : res.error,
      });
    } catch (e) { console.error("[divergência email]", e); }
  }
}

// ── Notificação de confirmação (todos os documentos aprovados) ────────────────

async function dispararConfirmacaoSeCompleto(documentoId: string) {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Busca o ff_id do documento aprovado
  const { data: doc } = await admin
    .from("documentos")
    .select("faturamento_fornecedor_id")
    .eq("id", documentoId)
    .single();

  if (!doc) return;

  // Verifica se todos os documentos do ff estão aprovados
  const { data: todos } = await admin
    .from("documentos")
    .select("status")
    .eq("faturamento_fornecedor_id", doc.faturamento_fornecedor_id);

  if (!todos?.length || !todos.every((d) => d.status === "aprovado")) return;

  // Busca template de confirmação
  const { data: tmpl } = await admin
    .from("cadencia_templates")
    .select("ativo, canal_whatsapp, canal_email, mensagem_whatsapp, assunto_email, corpo_email")
    .eq("step", "confirmacao")
    .single();

  if (!tmpl?.ativo) return;

  // Busca dados do ff/fornecedor
  const { data: ff } = await admin
    .from("faturamento_fornecedores")
    .select(`
      id, link_token,
      faturamento:faturamentos ( nome_campanha ),
      fornecedor:fornecedores ( razao_social, contato_nome, contato_whatsapp, contato_email )
    `)
    .eq("id", doc.faturamento_fornecedor_id)
    .single();

  if (!ff?.link_token) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forn = (ff.fornecedor as any) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fat  = (ff.faturamento as any) ?? {};
  const portalUrl = `${APP_URL}/portal/${ff.link_token}`;

  const vars = buildVars({
    contatoNome:  forn.contato_nome,
    razaoSocial:  forn.razao_social ?? "",
    nomeCampanha: fat.nome_campanha ?? "",
    portalUrl,
  });

  const agora = new Date().toISOString();

  // WhatsApp
  if (tmpl.canal_whatsapp && forn.contato_whatsapp && tmpl.mensagem_whatsapp) {
    const msg = interpolar(tmpl.mensagem_whatsapp, vars);
    try {
      const estado = await estadoConexao(INSTANCE_NAME);
      if (estado === "open") {
        await enviarMensagem(INSTANCE_NAME, forn.contato_whatsapp, msg);
        await admin.from("disparos").insert({
          faturamento_fornecedor_id: ff.id,
          tipo: "whatsapp", subtipo: "confirmacao",
          numero_destino: forn.contato_whatsapp,
          mensagem: msg, status: "enviado", enviado_em: agora,
        });
      }
    } catch (e) { console.error("[confirmação WA]", e); }
  }

  // Email
  if (tmpl.canal_email && forn.contato_email && tmpl.corpo_email && tmpl.assunto_email) {
    const html    = interpolar(tmpl.corpo_email,   vars);
    const subject = interpolar(tmpl.assunto_email, vars);
    try {
      const res = await sendEmail({ to: forn.contato_email, subject, html });
      await admin.from("disparos").insert({
        faturamento_fornecedor_id: ff.id,
        tipo: "email", subtipo: "confirmacao",
        email_destino: forn.contato_email,
        assunto: subject, mensagem: html,
        status: res.ok ? "enviado" : "falhou",
        enviado_em: res.ok ? agora : null,
        erro: res.ok ? null : res.error,
      });
    } catch (e) { console.error("[confirmação email]", e); }
  }
}

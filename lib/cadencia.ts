/**
 * lib/cadencia.ts
 * Utilitário de interpolação de variáveis nos templates de mensagem.
 *
 * Variáveis suportadas: {{nome}}, {{empresa}}, {{campanha}}, {{link}}
 */

export function interpolar(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export function buildVars({
  contatoNome,
  razaoSocial,
  nomeCampanha,
  portalUrl,
}: {
  contatoNome?: string | null;
  razaoSocial: string;
  nomeCampanha: string;
  portalUrl: string;
}): Record<string, string> {
  return {
    nome:     contatoNome?.trim() || razaoSocial,
    empresa:  razaoSocial,
    campanha: nomeCampanha,
    link:     portalUrl,
  };
}

/** Retorna em quantos dias completos transcorreram desde `desde` até agora */
export function diasDesde(desde: string | Date): number {
  const ms = Date.now() - new Date(desde).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

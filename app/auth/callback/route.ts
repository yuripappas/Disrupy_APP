import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as "invite" | "recovery" | "email" | null;
  const next       = searchParams.get("next") ?? "/dashboard";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // ── Flow 1: PKCE (code) — used by magic links and some OAuth ──────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/update-password?type=recovery`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // ── Flow 2: token_hash — used by invite and password reset emails ─────────
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      // Both invite and recovery need the user to set/update their password
      if (type === "invite" || type === "recovery") {
        return NextResponse.redirect(`${origin}/update-password?type=${type}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // ── Fallback: something went wrong ────────────────────────────────────────
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

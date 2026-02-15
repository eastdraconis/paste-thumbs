import { createClient } from "@supabase/supabase-js";

let serverClient: ReturnType<typeof createClient> | null = null;

function normalizeSupabaseSecret(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  // Vercel UI/CLI 입력 과정에서 인용부호 또는 줄바꿈이 섞이는 경우를 방지
  const dequoted = trimmed.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  const collapsed = dequoted.replace(/\r?\n/g, "").replace(/\\r|\\n/g, "").trim();

  if (!collapsed || collapsed === "your-service-role-key") {
    return null;
  }

  return collapsed;
}

export function getSupabaseServerClient() {
  const url = normalizeSupabaseSecret(process.env.SUPABASE_URL);
  const serviceRoleKey = normalizeSupabaseSecret(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_MISCONFIGURED");
  }

  if (!serverClient) {
    serverClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverClient;
}

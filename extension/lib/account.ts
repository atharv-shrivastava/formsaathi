const SUPABASE_URL = "https://jsurlqzbpmianyvmteto.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mhQpx1mfXkp1J6Nrpy2JdA_kx_GThap";
const SESSION_STORAGE_KEY = "formsaathi.supabase.session.v1";

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthPayload {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: AuthUser;
}

export interface ExtensionSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  user: AuthUser;
}

export interface ExtensionAccount {
  id: string;
  email: string | null;
}

export interface VerifiedProfileFact {
  id: string;
  fact_key: string;
  fact_label: string | null;
  fact_value: string;
  source_document_id: string | null;
  confidence: number | null;
  updated_at: string;
}

function normalizeSession(payload: AuthPayload): ExtensionSession {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at ?? now + (payload.expires_in ?? 3600),
    token_type: payload.token_type || "bearer",
    user: payload.user
  };
}

async function responseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({})) as {
    msg?: string;
    message?: string;
    error_description?: string;
    error?: string;
  };
  return new Error(
    body.msg ||
    body.message ||
    body.error_description ||
    body.error ||
    `FormSaathi account request failed (${response.status}).`
  );
}

async function storeSession(session: ExtensionSession): Promise<void> {
  await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session });
}

async function removeSession(): Promise<void> {
  await chrome.storage.local.remove(SESSION_STORAGE_KEY);
}

async function readStoredSession(): Promise<ExtensionSession | null> {
  const stored = await chrome.storage.local.get(SESSION_STORAGE_KEY);
  const value = stored[SESSION_STORAGE_KEY] as ExtensionSession | undefined;
  if (!value?.access_token || !value.refresh_token || !value.user?.id) return null;
  return value;
}

export async function signInExtensionAccount(email: string, password: string): Promise<ExtensionAccount> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: email.trim(), password })
  });
  if (!response.ok) throw await responseError(response);
  const payload = await response.json() as AuthPayload;
  const session = normalizeSession(payload);
  await storeSession(session);
  return { id: session.user.id, email: session.user.email || null };
}

export async function getExtensionSession(): Promise<ExtensionSession | null> {
  const session = await readStoredSession();
  if (!session) return null;
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });

  if (!response.ok) {
    await removeSession();
    return null;
  }

  const payload = await response.json() as AuthPayload;
  const refreshed = normalizeSession({
    ...payload,
    user: payload.user || session.user
  });
  await storeSession(refreshed);
  return refreshed;
}

export async function getExtensionAccount(): Promise<ExtensionAccount | null> {
  const session = await getExtensionSession();
  return session ? { id: session.user.id, email: session.user.email || null } : null;
}

export async function disconnectExtensionAccount(): Promise<void> {
  const session = await readStoredSession();
  try {
    if (session?.access_token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`
        }
      });
    }
  } finally {
    await removeSession();
  }
}

export async function getVerifiedProfileFacts(keys?: string[]): Promise<VerifiedProfileFact[]> {
  const uniqueKeys = keys
    ? Array.from(new Set(keys)).filter((key) => /^[a-z0-9_]+$/.test(key))
    : [];
  if (keys && uniqueKeys.length === 0) return [];

  const session = await getExtensionSession();
  if (!session) throw new Error("Connect your FormSaathi account to retrieve reviewed profile values.");

  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session.access_token}`
  };

  async function readTable(table: "profile_facts" | "document_profile_facts"): Promise<VerifiedProfileFact[]> {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set(
      "select",
      table === "profile_facts"
        ? "id,fact_key,fact_label,fact_value,source_document_id,confidence,updated_at"
        : "id,fact_key,fact_label,fact_value,document_id,confidence,updated_at"
    );
    url.searchParams.set("verified", "eq.true");
    url.searchParams.set("order", "updated_at.desc");
    url.searchParams.set("limit", "240");
    if (uniqueKeys.length > 0) {
      url.searchParams.set("fact_key", `in.(${uniqueKeys.join(",")})`);
    }

    const response = await fetch(url, { headers });
    if (!response.ok) throw await responseError(response);
    const rows = await response.json() as Array<VerifiedProfileFact & { document_id?: string }>;
    return rows.map((row) => ({
      ...row,
      source_document_id: row.source_document_id ?? row.document_id ?? null
    }));
  }

  const [generalFacts, documentFacts] = await Promise.all([
    readTable("profile_facts"),
    readTable("document_profile_facts")
  ]);

  return [...generalFacts, ...documentFacts].sort((a, b) =>
    String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
  );
}

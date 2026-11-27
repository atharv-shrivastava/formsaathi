import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, ocrApiUrl, supabase } from "./lib/supabase";
import type {
  DocumentCategory,
  ExtractedFact,
  ProfileFact,
  TrackedApplication,
  UserDocument
} from "./lib/types";

type Page = "overview" | "documents" | "profile" | "applications" | "paper-scan" | "extension" | "privacy";
type AuthMode = "signin" | "signup";

const categoryOptions: Array<{ value: DocumentCategory; label: string }> = [
  { value: "identity", label: "Identity" },
  { value: "address", label: "Address" },
  { value: "income", label: "Income" },
  { value: "education", label: "Education" },
  { value: "bank", label: "Bank" },
  { value: "photo", label: "Photograph" },
  { value: "signature", label: "Signature" },
  { value: "other", label: "Other" }
];

const factLabels: Record<string, string> = {
  applicant_name: "Applicant name",
  father_name: "Father / guardian name",
  date_of_birth: "Date of birth",
  annual_income: "Annual income",
  percentage: "Marks percentage",
  bank_account_number: "Bank account number",
  ifsc_code: "IFSC code"
};

const pageTitles: Record<Page, { title: string; subtitle: string }> = {
  overview: { title: "Overview", subtitle: "Your documents and information, in one place." },
  documents: { title: "My documents", subtitle: "Upload, organise and process the documents you choose." },
  profile: { title: "Information profile", subtitle: "Review extracted information before it is saved as verified." },
  applications: { title: "Applications", subtitle: "Keep track of the forms you are working on." },
  "paper-scan": { title: "Scan a paper form", subtitle: "Use your phone camera or gallery to create a filled copy of a paper form." },
  extension: { title: "Browser extension", subtitle: "Install FormSaathi in Chrome and connect it to your reviewed profile." },
  privacy: { title: "Privacy centre", subtitle: "See how your information is stored and control your data." }
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function displayFactKey(key: string) {
  return factLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isSafeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setBooting(false);
      return;
    }

    let alive = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) console.error("Session restore failed:", error.message);
      setSession(data.session);
      setBooting(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setBooting(false);
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured || !supabase) return <SetupScreen />;
  const authClient = supabase;
  if (booting) {
    return <div className="loading-screen"><div className="brand-mark">F</div><span>Opening your workspace…</span></div>;
  }
  if (!session) return <AuthScreen />;
  return <Workspace user={session.user} onSignOut={() => void authClient.auth.signOut()} />;
}

function SetupScreen() {
  return (
    <main className="setup-screen">
      <div className="setup-card">
        <div className="brand-mark large">F</div>
        <p className="eyebrow">FORMsaathi · FIRST-TIME SETUP</p>
        <h1>Connect your Supabase project.</h1>
        <p className="muted">The web app is ready, but it needs your project URL and publishable key before accounts and private storage can work.</p>
        <ol className="setup-steps">
          <li>Create a Supabase project.</li>
          <li>Copy <strong>Project URL</strong> and <strong>Publishable key</strong> from Project Settings → API Keys.</li>
          <li>Copy <code>web/.env.example</code> to <code>web/.env.local</code> and fill in those two values.</li>
          <li>Run the SQL migration in <code>supabase/migrations</code> using the Supabase SQL Editor.</li>
          <li>Add <code>http://localhost:5173/**</code> and <code>http://127.0.0.1:5173/**</code> to Auth → URL Configuration.</li>
        </ol>
        <div className="security-callout"><strong>Keep the service-role key private.</strong> The browser app must use only the publishable key. Never put a Supabase secret or service-role key in a Vite environment variable.</div>
      </div>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const client = supabase!;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin
          }
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Account created. Check your email to confirm the address, then sign in.");
        } else {
          setNotice("Your account is ready.");
        }
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (signInError) throw signInError;
      }
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <div className="brand-lockup"><div className="brand-mark">F</div><span>FormSaathi</span></div>
        <div className="story-copy">
          <p className="eyebrow light">LESS PAPERWORK. MORE CLARITY.</p>
          <h1>Government forms shouldn't feel like a maze.</h1>
          <p>Keep your documents organised, understand what a form needs and stay in control of every field you fill.</p>
          <div className="story-points">
            <div><span className="point-check">✓</span><span>Your documents stay under your account.</span></div>
            <div><span className="point-check">✓</span><span>Review extracted details before saving.</span></div>
            <div><span className="point-check">✓</span><span>You decide what gets autofilled.</span></div>
          </div>
        </div>
        <div className="story-footer">A clearer way to complete applications.</div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{mode === "signup" ? "GET STARTED" : "WELCOME BACK"}</p>
          <h2>{mode === "signup" ? "Create your account" : "Sign in to FormSaathi"}</h2>
          <p className="muted">{mode === "signup" ? "Your personal workspace starts here." : "Pick up where you left off."}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === "signup" && (
              <label>Full name <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter your name" autoComplete="name" required /></label>
            )}
            <label>Email address <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            <label>Password <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            {notice && <p className="form-success" role="status">{notice}</p>}
            <button className="button primary full" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"} <span>→</span></button>
          </form>
          <p className="auth-switch">
            {mode === "signup" ? "Already have an account?" : "New to FormSaathi?"}
            <button onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setNotice(""); setError(""); }}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="auth-footnote"><span className="tiny-lock">⌑</span> Private account access. Never share your password or verification codes.</div>
        </div>
      </section>
    </main>
  );
}

interface WorkspaceProps {
  user: User;
  onSignOut: () => void;
}

function Workspace({ user, onSignOut }: WorkspaceProps) {
  const client = supabase!;
  const [page, setPage] = useState<Page>("overview");
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [facts, setFacts] = useState<ExtractedFact[]>([]);
  const [profileFacts, setProfileFacts] = useState<ProfileFact[]>([]);
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyDocument, setBusyDocument] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("identity");
  const [cloudConsent, setCloudConsent] = useState(false);
  const [applicationTitle, setApplicationTitle] = useState("");
  const [applicationUrl, setApplicationUrl] = useState("");

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [documentResult, factResult, profileResult, applicationResult] = await Promise.all([
      client.from("documents").select("*").order("created_at", { ascending: false }),
      client.from("extracted_facts").select("*").order("created_at", { ascending: false }).limit(300),
      client.from("profile_facts").select("*").order("fact_key", { ascending: true }),
      client.from("applications").select("*").order("created_at", { ascending: false })
    ]);
    const firstError = documentResult.error || factResult.error || profileResult.error || applicationResult.error;
    if (firstError) setError(firstError.message);
    setDocuments((documentResult.data || []) as UserDocument[]);
    setFacts((factResult.data || []) as ExtractedFact[]);
    setProfileFacts((profileResult.data || []) as ProfileFact[]);
    setApplications((applicationResult.data || []) as TrackedApplication[]);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
    if (fullName) {
      void client.from("profiles").upsert({ id: user.id, full_name: fullName }, { onConflict: "id" });
    } else {
      void client.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    }
    void refreshData();
  }, [client, refreshData, user.id]);

  const pendingFacts = useMemo(() => facts.filter((fact) => fact.review_status === "pending"), [facts]);
  const verifiedFacts = useMemo(() => profileFacts.filter((fact) => fact.verified), [profileFacts]);
  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";
  const pageInfo = pageTitles[page];

  function clearNotice() {
    setMessage("");
    setError("");
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    clearNotice();
    if (!cloudConsent) {
      setError("Confirm the private cloud storage notice before uploading a document.");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Choose a PDF, JPG, PNG or WebP file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("The MVP upload limit is 10 MB per file.");
      return;
    }
    setBusy(true);
    const id = crypto.randomUUID();
    const cleanName = file.name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
    const storagePath = user.id + "/" + id + "/" + cleanName;
    try {
      const { error: uploadError } = await client.storage.from("formsaathi-documents").upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { error: insertError } = await client.from("documents").insert({
        id,
        user_id: user.id,
        filename: file.name,
        category: uploadCategory,
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: storagePath,
        status: "uploaded"
      });
      if (insertError) {
        await client.storage.from("formsaathi-documents").remove([storagePath]);
        throw insertError;
      }
      setMessage(file.name + " uploaded to your private document vault.");
      await refreshData();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setBusy(false);
    }
  }

  async function updateCategory(document: UserDocument, category: DocumentCategory) {
    clearNotice();
    const { error: updateError } = await client.from("documents").update({ category }).eq("id", document.id);
    if (updateError) setError(updateError.message);
    else {
      setMessage("Document category updated.");
      await refreshData();
    }
  }

  async function deleteDocument(document: UserDocument) {
    if (!window.confirm("Delete " + document.filename + " and its extracted facts?")) return;
    clearNotice();
    setBusyDocument(document.id);
    try {
      const { error: storageError } = await client.storage.from("formsaathi-documents").remove([document.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await client.from("documents").delete().eq("id", document.id);
      if (deleteError) throw deleteError;
      setMessage("Document and its extracted facts were deleted.");
      await refreshData();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setBusyDocument(null);
    }
  }

  async function runOcr(document: UserDocument) {
    const consent = window.confirm(
      "FormSaathi will send this document to its hosted OCR processor. Its extracted text may then be sent to Google Gemini for broad field detection, including personal or sensitive information. The detected values will remain pending until you choose which ones to save. Continue?"
    );
    if (!consent) return;
    clearNotice();
    setBusyDocument(document.id);
    try {
      const { data: fileData, error: downloadError } = await client.storage.from("formsaathi-documents").download(document.storage_path);
      if (downloadError || !fileData) throw downloadError || new Error("Could not download this document from private storage.");
      const form = new FormData();
      form.append("file", fileData, document.filename);
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Your sign-in session has expired. Sign in again and retry.");
      }
      const response = await fetch(ocrApiUrl + "/api/ocr", {
        method: "POST",
        headers: { Authorization: "Bearer " + sessionData.session.access_token },
        body: form
      });
      const payload = await response.json().catch(() => ({})) as {
        facts?: Array<{ key: string; label?: string; value: string; confidence?: number; evidence?: string }>;
        documentType?: string | null;
        aiExtractionUsed?: boolean;
        note?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || ("OCR service returned HTTP " + response.status + ". Check the backend route and Render logs."));
      const extracted = Array.isArray(payload.facts) ? payload.facts : [];
      const { error: clearError } = await client.from("extracted_facts").delete().eq("document_id", document.id);
      if (clearError) throw clearError;
      if (extracted.length) {
        const rows = extracted.map((fact: { key: string; label?: string; value: string; confidence?: number; evidence?: string }) => ({
          user_id: user.id,
          document_id: document.id,
          fact_key: fact.key,
          fact_label: fact.label || fact.key.replace(/_/g, " "),
          fact_value: fact.value,
          confidence: Number.isFinite(fact.confidence) ? fact.confidence : null,
          evidence: fact.evidence || null,
          review_status: "pending"
        }));
        const { error: insertError } = await client.from("extracted_facts").insert(rows);
        if (insertError) throw insertError;
      }
      const { error: statusError } = await client.from("documents").update({
        status: "extracted",
        document_type: payload.documentType || document.document_type || null
      }).eq("id", document.id);
      if (statusError) throw statusError;
      setMessage(extracted.length
        ? (payload.aiExtractionUsed ? "AI detected " : "OCR detected ") + extracted.length + " field(s)" +
          (payload.documentType ? " in this " + payload.documentType : " in this document") +
          ". Select the values you want to save to your profile."
        : (payload.note || "OCR completed, but no fields were confidently detected. Review the original document or enter the information manually."));
      await refreshData();
    } catch (reason) {
      const detail = messageFor(reason);
      setError(detail.includes("Failed to fetch")
        ? "Could not reach the OCR service. It may be starting up; check your connection and retry."
        : detail);
      await client.from("documents").update({ status: "failed" }).eq("id", document.id);
    } finally {
      setBusyDocument(null);
    }
  }

  async function approveFact(fact: ExtractedFact) {
    const current = profileFacts.find((item) => item.fact_key === fact.fact_key);
    if (current && current.fact_value !== fact.fact_value) {
      const confirmed = window.confirm(
        "Your profile currently stores \"" + current.fact_value + "\" for " + displayFactKey(fact.fact_key) +
        ". Replace it with \"" + fact.fact_value + "\" from this document?"
      );
      if (!confirmed) return;
    }
    clearNotice();
    setBusy(true);
    try {
      const { error: saveError } = await client.from("profile_facts").upsert({
        user_id: user.id,
        fact_key: fact.fact_key,
        fact_label: fact.fact_label || displayFactKey(fact.fact_key),
        fact_value: fact.fact_value,
        source_document_id: fact.document_id,
        confidence: fact.confidence,
        verified: true
      }, { onConflict: "user_id,fact_key" });
      if (saveError) throw saveError;
      const { error: reviewError } = await client.from("extracted_facts").update({ review_status: "approved" }).eq("id", fact.id);
      if (reviewError) throw reviewError;
      setMessage("Saved " + displayFactKey(fact.fact_key) + " to your reviewed profile.");
      await refreshData();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setBusy(false);
    }
  }

  async function approveSelectedFacts(selectedFacts: ExtractedFact[]) {
    if (selectedFacts.length === 0) return;
    const uniqueByKey = new Map<string, ExtractedFact>();
    const conflictingKeys = new Set<string>();
    for (const fact of selectedFacts) {
      const existing = uniqueByKey.get(fact.fact_key);
      if (existing && existing.fact_value !== fact.fact_value) conflictingKeys.add(fact.fact_key);
      else if (!existing) uniqueByKey.set(fact.fact_key, fact);
    }
    if (conflictingKeys.size > 0) {
      setError(
        "You selected different values for the same profile field: " +
        Array.from(conflictingKeys).map(displayFactKey).join(", ") +
        ". Choose one value for each field, then save the selection again."
      );
      return;
    }

    const replacements = Array.from(uniqueByKey.values()).filter((fact) => {
      const current = profileFacts.find((item) => item.fact_key === fact.fact_key);
      return current && current.fact_value !== fact.fact_value;
    });
    if (replacements.length > 0) {
      const summary = replacements.slice(0, 6).map((fact) =>
        displayFactKey(fact.fact_key) + ": " + fact.fact_value
      ).join("\\n");
      const more = replacements.length > 6 ? "\\n…and " + (replacements.length - 6) + " more" : "";
      if (!window.confirm(
        "These selected values will replace existing profile values:\\n\\n" + summary + more + "\\n\\nContinue?"
      )) return;
    }

    clearNotice();
    setBusy(true);
    try {
      const profileRows = Array.from(uniqueByKey.values()).map((fact) => ({
        user_id: user.id,
        fact_key: fact.fact_key,
        fact_label: fact.fact_label || displayFactKey(fact.fact_key),
        fact_value: fact.fact_value,
        source_document_id: fact.document_id,
        confidence: fact.confidence,
        verified: true
      }));
      const { error: saveError } = await client.from("profile_facts").upsert(profileRows, { onConflict: "user_id,fact_key" });
      if (saveError) throw saveError;

      const selectedIds = selectedFacts.map((fact) => fact.id);
      const { error: reviewError } = await client
        .from("extracted_facts")
        .update({ review_status: "approved" })
        .in("id", selectedIds)
        .eq("review_status", "pending");
      if (reviewError) {
        throw new Error("Profile values were saved, but their review status could not be updated. Refresh and check the profile before retrying.");
      }

      setMessage("Saved " + uniqueByKey.size + " selected value(s) to your reviewed profile. The extension can now search these saved facts without re-reading the documents.");
      await refreshData();
    } catch (reason) {
      setError(messageFor(reason));
      await refreshData();
    } finally {
      setBusy(false);
    }
  }

  async function saveManualFact(factKey: string, value: string) {
    const cleanValue = value.trim().replace(/\\s{2,}/g, " ");
    if (!cleanValue) throw new Error("Enter a value before saving.");
    const current = profileFacts.find((item) => item.fact_key === factKey);
    if (current && current.fact_value !== cleanValue) {
      const confirmed = window.confirm(
        "Replace the saved " + displayFactKey(factKey) + " value with the new value?"
      );
      if (!confirmed) return;
    }
    clearNotice();
    setBusy(true);
    try {
      const { error: saveError } = await client.from("profile_facts").upsert({
        user_id: user.id,
        fact_key: factKey,
        fact_label: displayFactKey(factKey),
        fact_value: cleanValue,
        source_document_id: null,
        confidence: 1,
        verified: true
      }, { onConflict: "user_id,fact_key" });
      if (saveError) throw saveError;
      setMessage(displayFactKey(factKey) + " saved to your verified profile.");
      await refreshData();
    } catch (reason) {
      setError(messageFor(reason));
      throw reason;
    } finally {
      setBusy(false);
    }
  }

  async function updateFactValue(fact: ExtractedFact, value: string) {
    const cleanValue = value.trim().replace(/\s{2,}/g, " ");
    if (!cleanValue) {
      setError("A field cannot be saved as an empty value.");
      return;
    }
    if (cleanValue === fact.fact_value) return;

    clearNotice();
    setBusy(true);
    try {
      const { data, error: updateError } = await client
        .from("extracted_facts")
        .update({ fact_value: cleanValue })
        .eq("id", fact.id)
        .eq("review_status", "pending")
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("This candidate is no longer pending. Refresh the page and try again.");
      setMessage((fact.fact_label || displayFactKey(fact.fact_key)) + " updated. Review it before approving.");
      await refreshData();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setBusy(false);
    }
  }

  async function rejectFact(fact: ExtractedFact) {
    const { error: updateError } = await client.from("extracted_facts").update({ review_status: "rejected" }).eq("id", fact.id);
    if (updateError) setError(updateError.message);
    else {
      setMessage("Candidate value dismissed.");
      await refreshData();
    }
  }

  async function addApplication(event: FormEvent) {
    event.preventDefault();
    if (!applicationTitle.trim()) return;
    clearNotice();
    const cleanUrl = applicationUrl.trim();
    if (cleanUrl && !isSafeHttpUrl(cleanUrl)) {
      setError("Use a regular HTTP or HTTPS portal URL.");
      return;
    }
    const { error: insertError } = await client.from("applications").insert({
      user_id: user.id,
      title: applicationTitle.trim(),
      portal_url: cleanUrl || null,
      status: "not_started"
    });
    if (insertError) setError(insertError.message);
    else {
      setApplicationTitle("");
      setApplicationUrl("");
      setMessage("Application added to your tracker.");
      await refreshData();
    }
  }

  async function updateApplicationStatus(application: TrackedApplication, status: TrackedApplication["status"]) {
    const { error: updateError } = await client.from("applications").update({ status }).eq("id", application.id);
    if (updateError) setError(updateError.message);
    else await refreshData();
  }

  async function clearPersonalData() {
    const confirmed = window.confirm("This permanently removes your uploaded documents, extracted facts, saved profile values and application tracker entries from the active database and private storage. Your login account remains. Continue?");
    if (!confirmed) return;
    clearNotice();
    setBusy(true);
    try {
      const paths = documents.map((document) => document.storage_path);
      if (paths.length) {
        const { error: storageError } = await client.storage.from("formsaathi-documents").remove(paths);
        if (storageError) throw storageError;
      }
      const operations = await Promise.all([
        client.from("documents").delete().eq("user_id", user.id),
        client.from("profile_facts").delete().eq("user_id", user.id),
        client.from("applications").delete().eq("user_id", user.id)
      ]);
      const failure = operations.find((result) => result.error)?.error;
      if (failure) throw failure;
      setMessage("Your FormSaathi documents, extracted values and application entries have been cleared. Your login remains active.");
      await refreshData();
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setBusy(false);
    }
  }

  const nav: Array<{ id: Page; label: string; icon: string }> = [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "documents", label: "My documents", icon: "▤" },
    { id: "profile", label: "Information profile", icon: "◈" },
    { id: "applications", label: "Applications", icon: "▣" },
    { id: "paper-scan", label: "Scan paper form", icon: "▧" },
    { id: "extension", label: "Browser extension", icon: "⌘" },
    { id: "privacy", label: "Privacy centre", icon: "◉" }
  ];

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark">F</div><span>FormSaathi</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {nav.map((item) => (
            <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => { setPage(item.id); clearNotice(); }}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === "profile" && pendingFacts.length > 0 && <span className="nav-count">{pendingFacts.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-symbol">?</div>
            <strong>Need a hand?</strong>
            <p>FormSaathi guides you. You stay in control.</p>
          </div>
          <div className="user-card">
            <div className="avatar">{(user.user_metadata?.full_name || user.email || "F").slice(0, 1).toUpperCase()}</div>
            <div className="user-meta"><strong>{displayName}</strong><span>{user.email}</span></div>
            <button className="icon-button signout" onClick={onSignOut} title="Sign out" aria-label="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{pageInfo.title}</strong></div>
          <div className="topbar-right"><span className="secure-indicator"><i /> Account connected</span><div className="avatar small">{(user.user_metadata?.full_name || user.email || "F").slice(0, 1).toUpperCase()}</div></div>
        </header>
        <div className="page-wrap">
          <div className="page-heading">
            <div><p className="eyebrow">YOUR SPACE</p><h1>{pageInfo.title}</h1><p>{pageInfo.subtitle}</p></div>
          </div>

          {message && <div className="notice success-notice" role="status"><span>✓</span>{message}<button onClick={() => setMessage("")} aria-label="Dismiss">×</button></div>}
          {error && <div className="notice error-notice" role="alert"><span>!</span>{error}<button onClick={() => setError("")} aria-label="Dismiss">×</button></div>}

          {loading ? <div className="content-loading">Loading your workspace…</div> : (
            <>
              {page === "overview" && (
                <OverviewPage
                  name={String(displayName)}
                  documents={documents}
                  verifiedFacts={verifiedFacts}
                  pendingFacts={pendingFacts}
                  applications={applications}
                  onNavigate={setPage}
                />
              )}
              {page === "documents" && (
                <DocumentsPage
                  documents={documents}
                  category={uploadCategory}
                  cloudConsent={cloudConsent}
                  onCloudConsentChange={setCloudConsent}
                  onCategoryChange={setUploadCategory}
                  onUpload={handleUpload}
                  onRunOcr={runOcr}
                  onDelete={deleteDocument}
                  onUpdateCategory={updateCategory}
                  busyDocument={busyDocument}
                  busy={busy}
                />
              )}
              {page === "profile" && (
                <ProfilePage
                  verifiedFacts={verifiedFacts}
                  pendingFacts={pendingFacts}
                  documents={documents}
                  onApprove={approveFact}
                  onApproveSelected={approveSelectedFacts}
                  onReject={rejectFact}
                  onUpdate={updateFactValue}
                  onManualSave={saveManualFact}
                  busy={busy}
                />
              )}
              {page === "paper-scan" && (
                <PaperFormPage verifiedFacts={verifiedFacts} />
              )}
              {page === "applications" && (
                <ApplicationsPage
                  applications={applications}
                  title={applicationTitle}
                  url={applicationUrl}
                  onTitleChange={setApplicationTitle}
                  onUrlChange={setApplicationUrl}
                  onAdd={addApplication}
                  onStatusChange={updateApplicationStatus}
                />
              )}
              {page === "extension" && (
                <ExtensionPage userEmail={user.email || ""} verifiedFactCount={verifiedFacts.length} />
              )}
              {page === "privacy" && (
                <PrivacyPage
                  userEmail={user.email || ""}
                  documentCount={documents.length}
                  factCount={verifiedFacts.length}
                  onClear={clearPersonalData}
                  busy={busy}
                />
              )}
            </>
          )}
          <footer className="page-footer"><span>FormSaathi · MVP preview</span><span>Review every value. Submit forms yourself.</span></footer>
        </div>
      </main>
    </div>
  );
}

interface OverviewPageProps {
  name: string;
  documents: UserDocument[];
  verifiedFacts: ProfileFact[];
  pendingFacts: ExtractedFact[];
  applications: TrackedApplication[];
  onNavigate: (page: Page) => void;
}

function OverviewPage({ name, documents, verifiedFacts, pendingFacts, applications, onNavigate }: OverviewPageProps) {
  const extractedCount = documents.filter((document) => document.status === "extracted").length;
  const inProgress = applications.filter((application) => application.status !== "submitted").length;
  return (
    <div className="page-content">
      <section className="welcome-banner">
        <div><p className="eyebrow light">YOUR FORM COMPANION</p><h2>Good to see you, {name}.</h2><p>Get your documents in order now. FormSaathi will use only the information relevant to the form you are working on.</p><button className="button white-button" onClick={() => onNavigate("documents")}>Open document vault <span>→</span></button></div>
        <div className="welcome-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-paper"><div className="paper-pin" /><span /><span /><span /><b>✓</b></div><div className="art-check">✓</div></div>
      </section>
      <section className="stat-grid">
        <StatCard label="Documents stored" value={documents.length} detail={extractedCount + " processed"} icon="▤" />
        <StatCard label="Reviewed profile fields" value={verifiedFacts.length} detail="Ready for form matching" icon="◈" />
        <StatCard label="Needs your review" value={pendingFacts.length} detail="Extracted candidates" icon="⌁" accent={pendingFacts.length > 0} />
        <StatCard label="Active applications" value={inProgress} detail={applications.length + " tracked in total"} icon="▣" />
      </section>
      <div className="section-grid">
        <section className="surface-card setup-card-main">
          <div className="section-head"><div><p className="eyebrow">GETTING STARTED</p><h3>Your setup checklist</h3></div><span className="soft-badge">MVP</span></div>
          <div className="checklist">
            <ChecklistItem complete={documents.length > 0} title="Add your documents" description="Upload a PDF or a clear image." onClick={() => onNavigate("documents")} />
            <ChecklistItem complete={extractedCount > 0} title="Extract information" description="Run OCR on a document you choose." onClick={() => onNavigate("documents")} />
            <ChecklistItem complete={verifiedFacts.length > 0} title="Review your profile" description="Approve the values you want to keep." onClick={() => onNavigate("profile")} />
            <ChecklistItem complete={false} title="Connect your browser extension" description="Use your FormSaathi account to scan supported online forms." onClick={() => onNavigate("extension")} />
          </div>
        </section>
        <section className="surface-card recent-card">
          <div className="section-head"><div><p className="eyebrow">DOCUMENT VAULT</p><h3>Recently added</h3></div><button className="text-button" onClick={() => onNavigate("documents")}>View all →</button></div>
          {documents.length === 0 ? <EmptyState title="Your vault is empty" text="Add your first document to begin building your profile." /> : (
            <div className="recent-list">{documents.slice(0, 4).map((document) => <DocumentLine key={document.id} document={document} />)}</div>
          )}
        </section>
      </div>
      <section className="extension-strip"><div className="extension-icon">↗</div><div><strong>Works with your browser</strong><p>The extension will use the reviewed profile from this account after secure account pairing is added.</p></div><span className="coming-pill">PAIRING NEXT</span></section>
    </div>
  );
}

function StatCard({ label, value, detail, icon, accent = false }: { label: string; value: number; detail: string; icon: string; accent?: boolean }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><b className={accent ? "stat-icon warm" : "stat-icon"}>{icon}</b></div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>;
}

function ChecklistItem({ complete, title, description, onClick }: { complete: boolean; title: string; description: string; onClick: () => void }) {
  return <button className="checklist-item" onClick={onClick}><span className={complete ? "check-circle complete" : "check-circle"}>{complete ? "✓" : ""}</span><span className="checklist-copy"><strong>{title}</strong><small>{description}</small></span><span className="check-arrow">→</span></button>;
}

function DocumentsPage({
  documents, category, cloudConsent, onCloudConsentChange, onCategoryChange, onUpload, onRunOcr, onDelete, onUpdateCategory, busyDocument, busy
}: {
  documents: UserDocument[];
  category: DocumentCategory;
  cloudConsent: boolean;
  onCloudConsentChange: (value: boolean) => void;
  onCategoryChange: (category: DocumentCategory) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRunOcr: (document: UserDocument) => void;
  onDelete: (document: UserDocument) => void;
  onUpdateCategory: (document: UserDocument, category: DocumentCategory) => void;
  busyDocument: string | null;
  busy: boolean;
}) {
  return (
    <div className="page-content">
      <section className="surface-card upload-card">
        <div className="upload-main"><div className="upload-copy"><div className="upload-symbol">＋</div><div><h3>Add a document</h3><p>PDF, JPG, PNG or WebP · Up to 10 MB per file</p></div></div><label className="cloud-consent"><input type="checkbox" checked={cloudConsent} onChange={(event) => onCloudConsentChange(event.target.checked)} /><span>I understand this uploads a copy to my private FormSaathi cloud vault. I will use synthetic documents for this MVP demo.</span></label></div>
        <div className="upload-controls"><label className="category-picker"><span>Document type</span><select value={category} onChange={(event) => onCategoryChange(event.target.value as DocumentCategory)}>{categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className={!cloudConsent || busy ? "button primary disabled" : "button primary"}>Choose file<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={onUpload} disabled={!cloudConsent || busy} hidden /></label></div>
      </section>
      <div className="section-head document-list-head"><div><p className="eyebrow">YOUR PRIVATE STORAGE</p><h3>Uploaded documents <span className="inline-count">{documents.length}</span></h3></div><span className="vault-label">⌑ Private vault</span></div>
      {documents.length === 0 ? <section className="surface-card empty-large"><div className="empty-illustration">▤</div><h3>No documents yet</h3><p>Upload a document and choose the closest category. You can change it later.</p></section> : (
        <div className="document-table surface-card">
          <div className="table-heading"><span>DOCUMENT</span><span>CATEGORY</span><span>ADDED</span><span>STATUS</span><span>ACTIONS</span></div>
          {documents.map((document) => (
            <div className="document-row" key={document.id}>
              <div className="document-name"><div className="file-icon">{document.mime_type === "application/pdf" ? "PDF" : "IMG"}</div><div><strong>{document.filename}</strong><small>{document.document_type ? "Detected: " + document.document_type : formatBytes(document.size_bytes)}</small></div></div>
              <div><select className="table-select" value={document.category} onChange={(event) => onUpdateCategory(document, event.target.value as DocumentCategory)}>{categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <span className="table-date">{formatDate(document.created_at)}</span>
              <span className={"status-chip status-" + document.status}>{document.status === "extracted" ? "Extracted" : document.status === "failed" ? "Retry needed" : "Uploaded"}</span>
              <div className="row-actions"><button className="mini-button" onClick={() => onRunOcr(document)} disabled={busyDocument === document.id}>{busyDocument === document.id ? "Working…" : document.status === "extracted" ? "Re-run OCR" : "Run OCR"}</button><button className="delete-button" onClick={() => onDelete(document)} disabled={busyDocument === document.id} title="Delete document" aria-label={"Delete " + document.filename}>×</button></div>
            </div>
          ))}
        </div>
      )}
      <p className="inline-note"><span>ⓘ</span> Uploading stores the original file in your private vault. When you click Run OCR, FormSaathi asks separately before sending the file to its hosted OCR processor and using Gemini to detect labelled fields. Extracted candidates are linked to this document and are not available to the extension until you select and approve them.</p>
    </div>
  );
}

function ProfilePage({ verifiedFacts, pendingFacts, documents, onApprove, onApproveSelected, onReject, onUpdate, onManualSave, busy }: {
  verifiedFacts: ProfileFact[];
  pendingFacts: ExtractedFact[];
  documents: UserDocument[];
  onApprove: (fact: ExtractedFact) => void;
  onApproveSelected: (facts: ExtractedFact[]) => void;
  onReject: (fact: ExtractedFact) => void;
  onUpdate: (fact: ExtractedFact, value: string) => void;
  onManualSave: (factKey: string, value: string) => Promise<void>;
  busy: boolean;
}) {
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [manualError, setManualError] = useState("");
  const [selectedFactIds, setSelectedFactIds] = useState<string[]>([]);
  const docFor = (id: string) => documents.find((document) => document.id === id);
  const docName = (id: string) => docFor(id)?.filename || "Source document";
  const pendingGroups = pendingFacts.reduce<Record<string, ExtractedFact[]>>((groups, fact) => {
    (groups[fact.document_id] ||= []).push(fact);
    return groups;
  }, {});
  function toggleFact(id: string, checked: boolean) {
    setSelectedFactIds((current) => checked
      ? Array.from(new Set([...current, id]))
      : current.filter((item) => item !== id));
  }
  function toggleDocumentGroup(facts: ExtractedFact[], checked: boolean) {
    const ids = facts.map((fact) => fact.id);
    setSelectedFactIds((current) => checked
      ? Array.from(new Set([...current, ...ids]))
      : current.filter((id) => !ids.includes(id)));
  }
  const manualFields = [
    { key: "applicant_name", label: "Applicant name", type: "text" },
    { key: "father_name", label: "Father's name", type: "text" },
    { key: "mother_name", label: "Mother's name", type: "text" },
    { key: "guardian_name", label: "Guardian's name", type: "text" },
    { key: "date_of_birth", label: "Date of birth", type: "text" },
    { key: "mobile_number", label: "Mobile number", type: "tel" },
    { key: "email", label: "Email address", type: "email" },
    { key: "address", label: "Residential address", type: "text" },
    { key: "postal_code", label: "PIN / postal code", type: "text" },
    { key: "district", label: "District", type: "text" },
    { key: "state", label: "State", type: "text" },
    { key: "gender", label: "Gender", type: "text" },
    { key: "annual_income", label: "Annual family income", type: "text" },
    { key: "percentage", label: "Marks percentage", type: "text" },
    { key: "caste_category", label: "Category", type: "text" },
    { key: "bank_account_number", label: "Bank account number", type: "text" },
    { key: "ifsc_code", label: "IFSC code", type: "text" }
  ] as const;
  function valueFor(key: string) {
    return manualValues[key] ?? verifiedFacts.find((fact) => fact.fact_key === key)?.fact_value ?? "";
  }
  async function saveManual(key: string) {
    setManualError("");
    try {
      await onManualSave(key, valueFor(key));
    } catch (reason) {
      setManualError(messageFor(reason));
    }
  }
  return (
    <div className="page-content">
      <section className="surface-card manual-profile-card">
        <div className="section-head"><div><p className="eyebrow">ENTER INFORMATION YOURSELF</p><h3>Manual profile entry</h3><p className="muted">No document upload or OCR required. Save each value to make it available to the extension.</p></div><span className="soft-badge">You control the data</span></div>
        <div className="manual-profile-grid">
          {manualFields.map((field) => (
            <label className="manual-profile-field" key={field.key}>
              <span>{field.label}</span>
              <div className="manual-profile-control">
                <input
                  type={field.type}
                  value={valueFor(field.key)}
                  onChange={(event) => setManualValues((current) => ({ ...current, [field.key]: event.target.value }))}
                  placeholder={"Enter " + field.label.toLowerCase()}
                  autoComplete="off"
                />
                <button className="mini-button" type="button" disabled={busy || !valueFor(field.key).trim()} onClick={() => void saveManual(field.key)}>
                  {verifiedFacts.some((fact) => fact.fact_key === field.key) ? "Update" : "Save"}
                </button>
              </div>
            </label>
          ))}
        </div>
        {manualError && <p className="form-error" role="alert">{manualError}</p>}
        <p className="inline-note"><span>ⓘ</span> Manually entered values are marked as user-verified after you save them. Check spelling and numbers carefully. You can update them here at any time.</p>
      </section>
      <div className="profile-intro"><div><div className="profile-shield">◈</div><div><strong>Your information profile</strong><p>Only values you approve are marked as reviewed and made available for future form matching.</p></div></div><span className="reviewed-count">{verifiedFacts.length} reviewed</span></div>
      <section className="surface-card profile-section">
        <div className="section-head"><div><p className="eyebrow">SAVED INFORMATION</p><h3>Reviewed profile</h3></div><span className="soft-badge">{verifiedFacts.length} fields</span></div>
        {verifiedFacts.length === 0 ? <EmptyState title="Nothing verified yet" text="Enter information manually above or run OCR on a document and approve the values you want to save here." /> : (
          <div className="fact-grid">{verifiedFacts.map((fact) => (
            <div className="fact-card" key={fact.id}><div className="fact-label">{fact.fact_label || displayFactKey(fact.fact_key)} <span className="verified-dot">✓ Reviewed</span></div><strong>{fact.fact_value}</strong><small>Source: {fact.source_document_id ? docName(fact.source_document_id) : "Manually added"}</small></div>
          ))}</div>
        )}
      </section>
      <section className="surface-card review-section">
        <div className="section-head"><div><p className="eyebrow">NEEDS YOUR DECISION</p><h3>Extracted candidates</h3><p className="muted">Fields stay attached to their source document until you choose which values belong in your reusable profile.</p></div><span className={pendingFacts.length ? "review-count active" : "review-count"}>{pendingFacts.length} pending</span></div>
        {pendingFacts.length === 0 ? <EmptyState title="You're all caught up" text="New OCR results will appear here for your review." /> : (
          <>
            <div className="review-bulk-toolbar">
              <label className="candidate-select-all"><input
                type="checkbox"
                checked={pendingFacts.length > 0 && pendingFacts.every((fact) => selectedFactIds.includes(fact.id))}
                onChange={(event) => setSelectedFactIds(event.target.checked ? pendingFacts.map((fact) => fact.id) : [])}
                disabled={busy}
              /><span>Select all detected fields</span></label>
              <button className="button primary candidate-bulk-save" disabled={busy || selectedFactIds.length === 0} onClick={() => onApproveSelected(pendingFacts.filter((fact) => selectedFactIds.includes(fact.id)))}>
                Save {selectedFactIds.length ? selectedFactIds.length + " selected" : "selected"} to profile
              </button>
            </div>
            <div className="candidate-document-groups">
              {Object.entries(pendingGroups).map(([documentId, groupFacts]) => {
                const source = docFor(documentId);
                const selectedCount = groupFacts.filter((fact) => selectedFactIds.includes(fact.id)).length;
                const allSelected = selectedCount === groupFacts.length;
                return (
                  <section className="candidate-document-group" key={documentId}>
                    <div className="candidate-document-heading">
                      <div><strong>{source?.document_type || source?.filename || "Source document"}</strong><small>{source?.filename || "Document"} · {groupFacts.length} detected field(s)</small></div>
                      <label className="candidate-select-all"><input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(event) => toggleDocumentGroup(groupFacts, event.target.checked)}
                        disabled={busy}
                      /><span>{allSelected ? "Selected" : "Select document"}</span></label>
                    </div>
                    <div className="candidate-list">
                      {groupFacts.map((fact) => {
                        const isEditing = editingFactId === fact.id;
                        const draft = draftValues[fact.id] ?? fact.fact_value;
                        const fieldLabel = fact.fact_label || displayFactKey(fact.fact_key);
                        return (
                          <article className="candidate-row" key={fact.id}>
                            <label className="candidate-select">
                              <input type="checkbox" checked={selectedFactIds.includes(fact.id)} onChange={(event) => toggleFact(fact.id, event.target.checked)} disabled={busy} />
                              <span>Select</span>
                            </label>
                            <div className="candidate-main">
                              <div className="candidate-label">{fieldLabel}</div>
                              {isEditing ? (
                                <input
                                  className="candidate-edit-input"
                                  aria-label={"Edit " + fieldLabel}
                                  value={draft}
                                  onChange={(event) => setDraftValues((current) => ({ ...current, [fact.id]: event.target.value }))}
                                  autoFocus
                                />
                              ) : <strong>{fact.fact_value}</strong>}
                              <small>{fact.confidence !== null ? "Extraction confidence " + Math.round(fact.confidence * 100) + "%" : "Confidence unavailable"}</small>
                              {fact.evidence && <p className="evidence">“{fact.evidence}”</p>}
                            </div>
                            <div className="candidate-actions">
                              {isEditing ? (
                                <>
                                  <button className="button primary candidate-save" disabled={busy || !draft.trim()} onClick={() => { onUpdate(fact, draft); setEditingFactId(null); }}>Save edit</button>
                                  <button className="text-button reject-button" disabled={busy} onClick={() => setEditingFactId(null)}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button className="text-button edit-button" disabled={busy} onClick={() => { setDraftValues((current) => ({ ...current, [fact.id]: fact.fact_value })); setEditingFactId(fact.id); }}>Edit</button>
                                  <button className="button approve-button" disabled={busy} onClick={() => onApprove(fact)}>Use this value</button>
                                  <button className="text-button reject-button" disabled={busy} onClick={() => { toggleFact(fact.id, false); onReject(fact); }}>Dismiss</button>
                                </>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </section>
      <p className="inline-note"><span>ⓘ</span> You can edit OCR candidates before approving them. OCR confidence is a technical estimate, not proof that a value is correct. Always compare it with the original document.</p>
    </div>
  );
}

function ApplicationsPage({ applications, title, url, onTitleChange, onUrlChange, onAdd, onStatusChange }: {
  applications: TrackedApplication[];
  title: string;
  url: string;
  onTitleChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onAdd: (event: FormEvent) => void;
  onStatusChange: (application: TrackedApplication, status: TrackedApplication["status"]) => void;
}) {
  return (
    <div className="page-content">
      <form className="surface-card application-form" onSubmit={onAdd}>
        <div><p className="eyebrow">NEW TRACKER</p><h3>Add an application</h3><p>Keep a simple record of forms you're preparing.</p></div>
        <div className="application-fields"><label>Application name<input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="e.g. Post-matric scholarship" required /></label><label>Official portal URL <span className="optional">(optional)</span><input type="url" value={url} onChange={(event) => onUrlChange(event.target.value)} placeholder="https://official-portal.gov.in" /></label><button className="button primary" type="submit">Add to tracker <span>→</span></button></div>
      </form>
      <div className="section-head document-list-head"><div><p className="eyebrow">YOUR TRACKER</p><h3>Applications <span className="inline-count">{applications.length}</span></h3></div></div>
      {applications.length === 0 ? <section className="surface-card empty-large"><div className="empty-illustration">▣</div><h3>No applications tracked</h3><p>Add a scholarship, certificate or other application to keep its progress in one place.</p></section> : (
        <div className="application-list">{applications.map((application) => (
          <article className="surface-card application-row" key={application.id}>
            <div className="application-icon">▣</div><div className="application-info"><strong>{application.title}</strong><small>{application.portal_url || "No portal link added"} · Added {formatDate(application.created_at)}</small></div>
            {application.portal_url && isSafeHttpUrl(application.portal_url) && <a className="text-button" href={application.portal_url} target="_blank" rel="noreferrer">Open portal ↗</a>}
            <select className="table-select status-select" value={application.status} onChange={(event) => onStatusChange(application, event.target.value as TrackedApplication["status"])}>
              <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="ready_to_submit">Ready to review</option><option value="submitted">Submitted</option>
            </select>
          </article>
        ))}</div>
      )}
      <p className="inline-note"><span>ⓘ</span> This tracker is a personal note. FormSaathi does not verify application status with government portals.</p>
    </div>
  );
}


interface PaperPlacement {
  label: string;
  factKey: string;
  value: string;
  confidence: number;
}

function PaperFormPage({ verifiedFacts }: { verifiedFacts: ProfileFact[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [filledUrl, setFilledUrl] = useState("");
  const [placements, setPlacements] = useState<PaperPlacement[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const previewUrls = useRef<string[]>([]);
  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
  }, []);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null;
    event.target.value = "";
    if (!nextFile) return;
    setError("");
    setMessage("");
    setPlacements([]);
    setConsent(false);
    setFile(null);
    if (originalUrl) {
      URL.revokeObjectURL(originalUrl);
      previewUrls.current = previewUrls.current.filter((url) => url !== originalUrl);
      setOriginalUrl("");
    }
    setFilledUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
        previewUrls.current = previewUrls.current.filter((url) => url !== current);
      }
      return "";
    });

    if (!["image/jpeg", "image/png", "image/webp"].includes(nextFile.type)) {
      setError("Choose a JPG, PNG or WebP photo. HEIC conversion is not enabled in this prototype.");
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError("The photo must be 10 MB or smaller.");
      return;
    }
    setFile(nextFile);
    const nextUrl = URL.createObjectURL(nextFile);
    previewUrls.current.push(nextUrl);
    setOriginalUrl(nextUrl);
  }

  async function scanAndFill() {
    if (!file) {
      setError("Take a photo or choose an image first.");
      return;
    }
    if (!consent) {
      setError("Confirm the AI photo-processing notice before scanning.");
      return;
    }
    if (verifiedFacts.length === 0) {
      setError("Your information profile has no approved values yet. Review and approve profile facts first.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("Reading printed labels and locating safe writing areas…");
    setPlacements([]);
    setFilledUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
        previewUrls.current = previewUrls.current.filter((url) => url !== current);
      }
      return "";
    });

    try {
      const { data: sessionData, error: sessionError } = await supabase!.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Your sign-in session has expired. Sign in again and retry.");
      }

      const form = new FormData();
      form.append("file", file, file.name);
      form.append("consent", "true");
      const response = await fetch(ocrApiUrl + "/api/forms/fill-image", {
        method: "POST",
        headers: { Authorization: "Bearer " + sessionData.session.access_token },
        body: form
      });
      const payload = await response.json().catch(() => ({})) as {
        image?: string;
        mimeType?: string;
        placements?: PaperPlacement[];
        note?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "FormSaathi could not fill this paper form.");
      if (!payload.image) throw new Error("The backend did not return a filled image.");

      const binary = atob(payload.image);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const resultBlob = new Blob([bytes], { type: payload.mimeType || "image/jpeg" });
      const resultUrl = URL.createObjectURL(resultBlob);
      previewUrls.current.push(resultUrl);
      setFilledUrl(resultUrl);
      setPlacements(payload.placements || []);
      setMessage(payload.note || "Filled image created. Verify every value before using it.");
    } catch (reason) {
      setError(messageFor(reason));
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content">
      <section className="surface-card paper-scan-intro">
        <div className="paper-scan-symbol">▧</div>
        <div>
          <p className="eyebrow">PAPER FORM ASSISTANT</p>
          <h3>Photograph a paper form. Get a filled copy.</h3>
          <p>Use your phone camera or select a photo from your gallery. FormSaathi reads the printed labels, matches them to your approved profile and places the values into clear writing spaces.</p>
          <div className="paper-profile-count">{verifiedFacts.length} reviewed profile value(s) available</div>
        </div>
      </section>

      <section className="surface-card paper-upload-card">
        <div className="section-head"><div><p className="eyebrow">1 · ADD YOUR FORM</p><h3>Take a photo or choose an image</h3></div><span className="soft-badge">JPG · PNG · WebP</span></div>
        <div className="paper-action-row">
          <label className="button primary paper-choice">
            <span>▣ Open camera</span>
            <input type="file" accept="image/*" capture="environment" onChange={chooseImage} />
          </label>
          <label className="button paper-gallery paper-choice">
            <span>▤ Choose from gallery</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
          </label>
        </div>
        <p className="paper-guidance">Keep the entire page inside the frame. Photograph it from directly above, in good light, without shadows or blur.</p>
        {originalUrl && (
          <div className="paper-preview-block">
            <div className="paper-preview-head"><strong>Original photo</strong><span>{file?.name}</span></div>
            <img className="paper-preview-image" src={originalUrl} alt="Original paper form photo" />
          </div>
        )}
        <label className="paper-consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>I agree to send this photo and relevant approved profile values to Google Gemini through FormSaathi for form analysis. The processing route does not save the photo to my document vault.</span>
        </label>
        <button className="button primary paper-scan-button" disabled={!file || !consent || busy || verifiedFacts.length === 0} onClick={() => void scanAndFill()}>
          {busy ? "Scanning and filling…" : "Scan and fill this image →"}
        </button>
        {error && <p className="paper-error" role="alert">{error}</p>}
        {message && <p className="paper-message" role="status">{message}</p>}
      </section>

      {filledUrl && (
        <section className="surface-card paper-result-card">
          <div className="section-head"><div><p className="eyebrow">2 · REVIEW THE RESULT</p><h3>Your filled image</h3></div><span className="soft-badge">{placements.length} field(s) placed</span></div>
          <img className="paper-result-image" src={filledUrl} alt="Filled paper form preview" />
          <div className="paper-result-actions">
            <a className="button primary" href={filledUrl} download={(file?.name || "form").replace(/\.[^.]+$/, "") + "-filled.jpg"}>Download filled image ↓</a>
            <span>Original photo remains unchanged.</span>
          </div>
          <div className="paper-placement-list">
            {placements.map((placement, index) => (
              <div className="paper-placement-row" key={placement.factKey + "-" + index}>
                <div><strong>{displayFactKey(placement.factKey)}</strong><small>{placement.label}</small></div>
                <b>{placement.value}</b>
                <span>{Math.round(placement.confidence * 100)}% model confidence</span>
              </div>
            ))}
          </div>
          <p className="inline-note"><span>ⓘ</span> Image placement is AI-assisted and can be imperfect. Check alignment, spelling and every value on the downloaded copy before printing, signing or submitting it.</p>
        </section>
      )}
      <div className="security-callout"><strong>Important:</strong> The feature creates a new image, not an official digitally submitted form. It does not add signatures, certify documents or submit applications. Do not rely on automatic placement without reviewing the result.</div>
    </div>
  );
}

function PrivacyPage({ userEmail, documentCount, factCount, onClear, busy }: {
  userEmail: string;
  documentCount: number;
  factCount: number;
  onClear: () => void;
  busy: boolean;
}) {
  return (
    <div className="page-content">
      <section className="privacy-hero"><div className="privacy-symbol">⌑</div><div><p className="eyebrow light">YOUR DATA. YOUR CALL.</p><h2>Privacy should be part of the product.</h2><p>FormSaathi is designed to process only what you choose and keep you in control of every suggested value.</p></div></section>
      <div className="privacy-grid">
        <section className="surface-card privacy-card"><div className="privacy-card-icon">▣</div><h3>Private document storage</h3><p>Files are stored in a non-public Supabase Storage bucket. Row-level security policies restrict access to the authenticated owner.</p><span className="privacy-status">Configured in database migration</span></section>
        <section className="surface-card privacy-card"><div className="privacy-card-icon">⌁</div><h3>On-demand OCR</h3><p>Uploading a document does not automatically run OCR. When you choose Run OCR, that file is sent over HTTPS to our hosted OCR processor for in-memory processing. Candidate values need your approval.</p><span className="privacy-status">User initiated</span></section>
        <section className="surface-card privacy-card"><div className="privacy-card-icon">◈</div><h3>Limited profile data</h3><p>The extension and paper-form scanner use only approved profile facts relevant to the current task, not the entire document vault.</p><span className="privacy-status">Reviewed profile facts only</span></section>
        <section className="surface-card privacy-card"><div className="privacy-card-icon">▧</div><h3>Paper-form photo scan</h3><p>The selected photo is sent to the FormSaathi backend and Google Gemini after your consent. The processing route does not save the photo to your document vault.</p><span className="privacy-status">User initiated · in-memory API processing</span></section>
        <section className="surface-card privacy-card"><div className="privacy-card-icon">↺</div><h3>Delete your data</h3><p>Remove uploaded files, extracted candidates, reviewed profile values and application tracker entries while keeping your login account.</p><span className="privacy-status">{documentCount} documents · {factCount} reviewed fields</span></section>
      </div>
      <section className="surface-card data-controls"><div><p className="eyebrow">ACCOUNT DATA</p><h3>{userEmail}</h3><p>Clear your FormSaathi content from the active database and private storage. This does not delete your Supabase login account or copies retained in backups according to your provider's retention settings.</p></div><button className="button danger-button" onClick={onClear} disabled={busy}>{busy ? "Clearing…" : "Delete my FormSaathi data"}</button></section>
      <div className="security-callout"><strong>Prototype warning:</strong> this is an MVP foundation, not an independently audited production vault. Use synthetic documents in demos until the hosted project, access policies, backup retention and security controls have been reviewed.</div>
    </div>
  );
}

function DocumentLine({ document }: { document: UserDocument }) {
  return <div className="recent-line"><div className="file-icon small-file">{document.mime_type === "application/pdf" ? "PDF" : "IMG"}</div><div><strong>{document.filename}</strong><small>{categoryOptions.find((item) => item.value === document.category)?.label || "Other"} · {formatDate(document.created_at)}</small></div><span className={"status-dot-label " + document.status}>{document.status === "extracted" ? "Processed" : document.status === "failed" ? "Retry" : "Stored"}</span></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div className="empty-mark">◇</div><strong>{title}</strong><p>{text}</p></div>;
}

export default App;


const extensionPackageUrl = "https://github.com/atharv-shrivastava/formsaathi/releases/download/extension-v0.1.0/FormSaathi-Chrome-Extension.zip";

function ExtensionPage({ userEmail, verifiedFactCount }: { userEmail: string; verifiedFactCount: number }) {
  return (
    <div className="page-content">
      <section className="surface-card extension-hero">
        <div className="extension-mark">FS</div>
        <div className="extension-hero-copy">
          <p className="eyebrow">FORMsaathi FOR CHROME</p>
          <h2>Take your reviewed profile to the form.</h2>
          <p>FormSaathi can read the fields on the active page, match them against your approved information profile and let you review each suggested value before filling.</p>
          <a className="button primary extension-download" href={extensionPackageUrl}>Download Chrome extension <span>↓</span></a>
          <a className="text-button extension-release-link" href="https://github.com/atharv-shrivastava/formsaathi/releases" target="_blank" rel="noreferrer">View release notes ↗</a>
        </div>
      </section>

      <section className="surface-card extension-steps-card">
        <div className="section-head"><div><p className="eyebrow">ONE-TIME SETUP</p><h3>Install the development build</h3></div><span className="soft-badge">Chrome / Chromium</span></div>
        <ol className="extension-steps">
          <li><strong>Download and extract</strong><span>Download the ZIP above and extract it to a folder on your computer.</span></li>
          <li><strong>Open Chrome extensions</strong><span>Enter <code>chrome://extensions</code> in the browser address bar.</span></li>
          <li><strong>Enable Developer mode</strong><span>Turn on Developer mode using the switch near the top-right corner.</span></li>
          <li><strong>Load the extension</strong><span>Click Load unpacked and select the extracted folder that contains <code>manifest.json</code>.</span></li>
          <li><strong>Open FormSaathi</strong><span>Pin the extension if desired, then open its side panel from the Chrome toolbar.</span></li>
        </ol>
      </section>

      <section className="surface-card extension-connect-card">
        <p className="eyebrow">YOUR FORMsaathi ACCOUNT</p>
        <h3>Connect using the same account</h3>
        <p>Sign in inside the extension with the same email address and password you use on this website. The extension keeps its own protected browser-extension session; it does not copy credentials from the website.</p>
        <div className="extension-account-summary"><div><span>Website account</span><strong>{userEmail}</strong></div><div><span>Reviewed profile fields</span><strong>{verifiedFactCount}</strong></div></div>
        <p className="inline-note"><span>ⓘ</span> When a form is scanned, the extension requests only verified profile fields that match detected form labels. Database row-level security determines which user's values can be returned.</p>
      </section>

      <div className="security-callout"><strong>Distribution note:</strong> This is a development ZIP for manual installation. It is not yet published in the Chrome Web Store, so Chrome requires Developer mode and Load unpacked. The extension only fills fields after you approve them; it never submits the form.</div>
    </div>
  );
}

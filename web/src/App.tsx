import { useCallback, useEffect, useMemo, useState } from "react";
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

type Page = "overview" | "documents" | "profile" | "applications" | "privacy";
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
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "OCR service could not process this document.");
      const extracted = Array.isArray(payload.facts) ? payload.facts : [];
      const { error: clearError } = await client.from("extracted_facts").delete().eq("document_id", document.id);
      if (clearError) throw clearError;
      if (extracted.length) {
        const rows = extracted.map((fact: { key: string; value: string; confidence?: number; evidence?: string }) => ({
          user_id: user.id,
          document_id: document.id,
          fact_key: fact.key,
          fact_value: fact.value,
          confidence: Number.isFinite(fact.confidence) ? fact.confidence : null,
          evidence: fact.evidence || null,
          review_status: "pending"
        }));
        const { error: insertError } = await client.from("extracted_facts").insert(rows);
        if (insertError) throw insertError;
      }
      const { error: statusError } = await client.from("documents").update({ status: "extracted" }).eq("id", document.id);
      if (statusError) throw statusError;
      setMessage(extracted.length
        ? "OCR found " + extracted.length + " candidate value(s). Review them before adding anything to your profile."
        : "OCR completed, but no recognised fields matched the current extraction rules. The original document is unchanged.");
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
                  onReject={rejectFact}
                  busy={busy}
                />
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
            <ChecklistItem complete={false} title="Connect your browser extension" description="Extension account pairing is the next integration step." onClick={() => onNavigate("privacy")} />
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
              <div className="document-name"><div className="file-icon">{document.mime_type === "application/pdf" ? "PDF" : "IMG"}</div><div><strong>{document.filename}</strong><small>{formatBytes(document.size_bytes)}</small></div></div>
              <div><select className="table-select" value={document.category} onChange={(event) => onUpdateCategory(document, event.target.value as DocumentCategory)}>{categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <span className="table-date">{formatDate(document.created_at)}</span>
              <span className={"status-chip status-" + document.status}>{document.status === "extracted" ? "Extracted" : document.status === "failed" ? "Retry needed" : "Uploaded"}</span>
              <div className="row-actions"><button className="mini-button" onClick={() => onRunOcr(document)} disabled={busyDocument === document.id}>{busyDocument === document.id ? "Working…" : document.status === "extracted" ? "Re-run OCR" : "Run OCR"}</button><button className="delete-button" onClick={() => onDelete(document)} disabled={busyDocument === document.id} title="Delete document" aria-label={"Delete " + document.filename}>×</button></div>
            </div>
          ))}
        </div>
      )}
      <p className="inline-note"><span>ⓘ</span> Uploading stores the original file. OCR runs only when you select Run OCR. Extracted values remain unverified until you approve them in your profile.</p>
    </div>
  );
}

function ProfilePage({ verifiedFacts, pendingFacts, documents, onApprove, onReject, busy }: {
  verifiedFacts: ProfileFact[];
  pendingFacts: ExtractedFact[];
  documents: UserDocument[];
  onApprove: (fact: ExtractedFact) => void;
  onReject: (fact: ExtractedFact) => void;
  busy: boolean;
}) {
  const docName = (id: string) => documents.find((document) => document.id === id)?.filename || "Source document";
  return (
    <div className="page-content">
      <div className="profile-intro"><div><div className="profile-shield">◈</div><div><strong>Your information profile</strong><p>Only values you approve are marked as reviewed and made available for future form matching.</p></div></div><span className="reviewed-count">{verifiedFacts.length} reviewed</span></div>
      <section className="surface-card profile-section">
        <div className="section-head"><div><p className="eyebrow">SAVED INFORMATION</p><h3>Reviewed profile</h3></div><span className="soft-badge">{verifiedFacts.length} fields</span></div>
        {verifiedFacts.length === 0 ? <EmptyState title="Nothing verified yet" text="Run OCR on a document, then approve the values you want to save here." /> : (
          <div className="fact-grid">{verifiedFacts.map((fact) => (
            <div className="fact-card" key={fact.id}><div className="fact-label">{displayFactKey(fact.fact_key)} <span className="verified-dot">✓ Reviewed</span></div><strong>{fact.fact_value}</strong><small>Source: {fact.source_document_id ? docName(fact.source_document_id) : "Manually added"}</small></div>
          ))}</div>
        )}
      </section>
      <section className="surface-card review-section">
        <div className="section-head"><div><p className="eyebrow">NEEDS YOUR DECISION</p><h3>Extracted candidates</h3></div><span className={pendingFacts.length ? "review-count active" : "review-count"}>{pendingFacts.length} pending</span></div>
        {pendingFacts.length === 0 ? <EmptyState title="You're all caught up" text="New OCR results will appear here for your review." /> : (
          <div className="candidate-list">{pendingFacts.map((fact) => (
            <article className="candidate-row" key={fact.id}>
              <div className="candidate-main"><div className="candidate-label">{displayFactKey(fact.fact_key)}</div><strong>{fact.fact_value}</strong><small>{docName(fact.document_id)}{fact.confidence !== null ? " · extraction heuristic " + Math.round(fact.confidence * 100) + "%" : ""}</small>{fact.evidence && <p className="evidence">“{fact.evidence}”</p>}</div>
              <div className="candidate-actions"><button className="button approve-button" disabled={busy} onClick={() => onApprove(fact)}>✓ Use this value</button><button className="text-button reject-button" disabled={busy} onClick={() => onReject(fact)}>Dismiss</button></div>
            </article>
          ))}</div>
        )}
      </section>
      <p className="inline-note"><span>ⓘ</span> OCR confidence is a technical estimate, not proof that a value is correct. Always compare it with the original document.</p>
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
        <section className="surface-card privacy-card"><div className="privacy-card-icon">⌁</div><h3>On-demand OCR</h3><p>Uploading a document does not automatically run OCR. You choose when to process a file, and candidate values need your approval.</p><span className="privacy-status">User initiated</span></section>
        <section className="surface-card privacy-card"><div className="privacy-card-icon">◈</div><h3>Limited profile data</h3><p>The extension integration is designed to retrieve only reviewed fields needed for the current form, not your entire document vault.</p><span className="privacy-status">Extension pairing is next</span></section>
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

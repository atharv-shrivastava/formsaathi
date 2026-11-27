import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { disconnectExtensionAccount, getExtensionAccount, getExtensionSession, getVerifiedProfileFacts, signInExtensionAccount, type ExtensionAccount } from "../../lib/account";
import { checkApi, extractDocument, prepareImage as requestImagePreparation, requestFormAnalysis } from "../../lib/api";
import { deleteDocument, listDocuments, saveDocument } from "../../lib/db";
import { canonicalFieldKey, categoryForKey, createReviewRows, inferDocumentCategory, retrieveRelevantDocuments } from "../../lib/mapping";
import type { CandidateFact, DocumentCategory, ReviewRow, ScanResult, StoredDocument } from "../../lib/types";
import "./styles.css";

const categories: Array<{ value: DocumentCategory; label: string }> = [
  { value: "identity", label: "Identity" },
  { value: "address", label: "Address" },
  { value: "income", label: "Income" },
  { value: "education", label: "Education" },
  { value: "bank", label: "Bank" },
  { value: "photo", label: "Photograph" },
  { value: "signature", label: "Signature" },
  { value: "other", label: "Other" }
];

const emptyScan: ScanResult = { title: "", url: "", fields: [] };

function mergeAiMappings(
  rows: ReviewRow[],
  mappings: Array<{ fieldId: string; factId: string; factKey: string; value: string; confidence: number }>
): ReviewRow[] {
  const byField = new Map(mappings.map((mapping) => [mapping.fieldId, mapping]));
  return rows.map((row) => {
    const suggestion = byField.get(row.field.id);
    if (!suggestion || row.status === "conflict" || row.status === "filled" || row.value.trim()) return row;
    return {
      ...row,
      canonicalKey: suggestion.factKey,
      value: suggestion.value,
      sourceName: "Verified FormSaathi profile",
      sourceId: suggestion.factId,
      confidence: suggestion.confidence,
      evidence: "AI matched this field to the approved profile fact '" + suggestion.factKey + "'. The original stored value is shown; verify it before filling.",
      status: "needs-review"
    };
  });
}


export default function App() {
  const [account, setAccount] = useState<ExtensionAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [category, setCategory] = useState<DocumentCategory>("identity");
  const [scan, setScan] = useState<ScanResult>(emptyScan);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [apiReady, setApiReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Add documents, then scan the form you are working on.");
  const [tab, setTab] = useState<"documents" | "form">("documents");
  const [maxKb, setMaxKb] = useState(50);
  const [maxWidth, setMaxWidth] = useState(300);
  const [maxHeight, setMaxHeight] = useState(300);
  const [preparingId, setPreparingId] = useState<string | null>(null);

  const reloadDocuments = async () => setDocuments(await listDocuments());

  useEffect(() => {
    void reloadDocuments();
    void getExtensionAccount()
      .then(setAccount)
      .catch((error) => setAuthError(error instanceof Error ? error.message : "Could not restore account connection."))
      .finally(() => setAccountLoading(false));
    void checkApi().then(setApiReady);
    const timer = window.setInterval(() => void checkApi().then(setApiReady), 8000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const connected = await signInExtensionAccount(authEmail, authPassword);
      setAccount(connected);
      setAuthPassword("");
      setStatus("Connected to your FormSaathi account. Reviewed profile facts are ready for matching.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not connect your FormSaathi account.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleDisconnect() {
    setAuthBusy(true);
    setAuthError("");
    try {
      await disconnectExtensionAccount();
      setAccount(null);
      setRows([]);
      setStatus("FormSaathi account disconnected from this extension.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not disconnect the account.");
    } finally {
      setAuthBusy(false);
    }
  }

  const groupedCount = useMemo(() => categories.map((item) => ({
    ...item,
    count: documents.filter((document) => document.category === item.value).length
  })), [documents]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setStatus("Use a PDF, JPEG, PNG or WebP file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus("This prototype accepts files up to 10 MB.");
      return;
    }
    const suggestedCategory = inferDocumentCategory(file.name, category);
    const record: StoredDocument = {
      id: crypto.randomUUID(),
      name: file.name,
      category: suggestedCategory,
      mimeType: file.type,
      size: file.size,
      addedAt: Date.now(),
      file
    };
    await saveDocument(record);
    await reloadDocuments();
    setStatus(file.name + " was added as " + suggestedCategory + ". Check or change its category if the filename was unclear. OCR has not run yet.");
  }

  async function handleDelete(id: string) {
    await deleteDocument(id);
    await reloadDocuments();
    setStatus("Document removed from this browser's local vault.");
  }

  async function changeDocumentCategory(document: StoredDocument, nextCategory: DocumentCategory) {
    await saveDocument({ ...document, category: nextCategory });
    await reloadDocuments();
    setStatus("Document category updated. Future form scans will use the new category.");
  }

  async function prepareDocumentImage(document: StoredDocument) {
    if (!document.mimeType.startsWith("image/")) {
      setStatus("Image preparation currently supports image files only. PDF conversion is not included yet.");
      return;
    }
    if (!apiReady) {
      setStatus("The hosted FormSaathi service is unavailable. Check your connection and retry.");
      return;
    }
    setPreparingId(document.id);
    setStatus("Preparing a JPEG copy. Your original vault document will remain unchanged.");
    try {
      const session = await getExtensionSession();
      if (!session) throw new Error("Connect your FormSaathi account before preparing an image.");
      const result = await requestImagePreparation(document, maxKb, maxWidth, maxHeight, session.access_token);
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.name.replace(/\.[^.]+$/, "") + "-prepared.jpg";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus("Prepared JPEG: " + result.width + " × " + result.height + ", " + (result.bytes / 1024).toFixed(1) + " KB. Attach the downloaded copy manually on the portal.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not prepare this image.");
    } finally {
      setPreparingId(null);
    }
  }

  async function getActiveTabId(): Promise<number> {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!activeTab?.id) throw new Error("Could not identify the active browser tab.");
    return activeTab.id;
  }

  async function scanCurrentPage() {
    setBusy(true);
    setTab("form");
    setStatus("Inspecting visible form controls…");
    try {
      const tabId = await getActiveTabId();
      const response = await chrome.tabs.sendMessage(tabId, { type: "FS_SCAN" }) as {
        ok?: boolean;
        result?: ScanResult;
      };
      if (!response?.ok || !response.result) {
        throw new Error("FormSaathi could not inspect this page. It may be a restricted browser page or the content script may not be available.");
      }
      const nextScan = response.result;
      setScan(nextScan);
      if (nextScan.fields.length === 0) {
        setRows([]);
        setStatus("No visible form fields were found on this page.");
        return;
      }

      const relevantDocuments = retrieveRelevantDocuments(nextScan.fields, documents);
      const fieldKeys = Array.from(new Set(
        nextScan.fields.map(canonicalFieldKey).filter((key): key is string => Boolean(key))
      ));
      const relevantCategories = Array.from(new Set(
        nextScan.fields.map(canonicalFieldKey).map(categoryForKey).filter(Boolean)
      ));

      const facts: Array<CandidateFact & { sourceId: string; sourceName: string }> = [];
      let cloudFactCount = 0;
      if (account && fieldKeys.length > 0) {
        const cloudFacts = await getVerifiedProfileFacts(fieldKeys);
        cloudFactCount = cloudFacts.length;
        for (const fact of cloudFacts) {
          facts.push({
            key: fact.fact_key,
            value: fact.fact_value,
            confidence: fact.confidence ?? 0.92,
            evidence: "Reviewed and approved in your FormSaathi information profile.",
            sourceId: fact.id,
            sourceName: "FormSaathi verified profile"
          });
        }
      }

      let localDocumentCount = 0;
      let documentOcrMessage = "";
      if (relevantDocuments.length > 0) {
        if (!apiReady) {
          documentOcrMessage = " Hosted document OCR is unavailable; no document was uploaded.";
        } else if (!account) {
          documentOcrMessage = " Connect your FormSaathi account to process selected browser-local documents.";
        } else {
          const cachedCount = relevantDocuments.filter((document) => Boolean(document.cachedAt)).length;
          const uploadCount = relevantDocuments.length - cachedCount;
          const approvedUpload = uploadCount === 0 || window.confirm(
            "FormSaathi will send " + uploadCount + " relevant document(s) from this browser's local vault to its hosted OCR processor on Render. Files are processed in memory and are not saved to the server's disk. Extracted values remain unverified until you review them. Continue?"
          );

          if (!approvedUpload) {
            documentOcrMessage = " Document OCR was skipped because you declined this upload.";
          } else {
            const session = await getExtensionSession();
            if (!session) throw new Error("Your FormSaathi session expired. Connect your account again.");
            setStatus("Processing " + relevantDocuments.length + " relevant document(s) through hosted FormSaathi OCR: " + relevantCategories.join(", ") + ".");
            for (const document of relevantDocuments) {
              let documentFacts = document.cachedFacts || [];
              if (!document.cachedAt) {
                const extracted = await extractDocument(document, session.access_token);
                documentFacts = extracted.facts;
                await saveDocument({ ...document, cachedText: extracted.text, cachedFacts: documentFacts, cachedAt: Date.now() });
              }
              for (const fact of documentFacts) facts.push({ ...fact, sourceId: document.id, sourceName: document.name });
            }
            localDocumentCount = relevantDocuments.length;
            setDocuments(await listDocuments());
          }
        }
      }

      const baseRows = createReviewRows(nextScan.fields, facts);
      let finalRows = baseRows;
      let aiMessage = "";

      if (account) {
        const consent = window.confirm(
          "For AI form analysis, FormSaathi sends every detected visible field descriptor from this scan (labels, names, placeholders, types and dropdown choices, up to 120 fields) to its backend. The backend retrieves a few likely approved profile facts per field using regex hints and text similarity, then sends the complete field list and those candidates to Google Gemini to choose matches. Values already typed into the form, cookies and original document files are not sent. Continue with this one-time AI analysis?"
        );

        if (consent) {
          try {
            setStatus("Sending field descriptions to the FormSaathi backend for AI matching…");
            const session = await getExtensionSession();
            if (!session) throw new Error("Your FormSaathi session expired. Connect your account again.");
            const analysis = await requestFormAnalysis(nextScan, session.access_token);
            finalRows = mergeAiMappings(baseRows, analysis.mappings);
            aiMessage = analysis.note || (analysis.aiUsed ? "AI matching completed." : "No AI matches were found.");
            if (analysis.aiUsed) {
              aiMessage = analysis.matchedCount + " AI suggestion(s) returned by " + (analysis.model || "Gemini") + ". Review each value before filling.";
            }
          } catch (error) {
            aiMessage = "AI analysis unavailable: " + (error instanceof Error ? error.message : "Please retry.");
          }
        } else {
          aiMessage = "AI analysis was skipped. Deterministic matches are still available for review.";
        }
      } else {
        aiMessage = "Connect your FormSaathi account to send this scan to the hosted backend and use AI matching.";
      }

      setRows(finalRows);
      const aiMatchedCount = finalRows.filter((row) => row.evidence?.startsWith("AI matched")).length;
      const localOffline = documentOcrMessage;
      setStatus(
        "Detected " + nextScan.fields.length + " fields; " +
        cloudFactCount + " direct verified-profile match(es), " +
        localDocumentCount + " browser-local document(s) processed by hosted OCR, and " +
        aiMatchedCount + " AI match(es). " + aiMessage + localOffline
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not scan this page.");
    } finally {
      setBusy(false);
    }
  }

  async function highlight(row: ReviewRow) {
    try {
      const tabId = await getActiveTabId();
      await chrome.tabs.sendMessage(tabId, { type: "FS_HIGHLIGHT", fieldId: row.field.id, label: row.field.label });
    } catch {
      setStatus("Could not highlight this field. Scan the page again.");
    }
  }

  async function approveFill(index: number) {
    const row = rows[index];
    if (!row) {
      setStatus("This field review is no longer available. Scan the page again.");
      return;
    }
    if (!row.value.trim()) {
      setStatus("Enter a value before approving this field.");
      return;
    }
    if (row.field.isFile) {
      setStatus("Browsers do not allow extensions to set a file input's contents. Attach the document manually.");
      return;
    }
    try {
      const tabId = await getActiveTabId();
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "FS_FILL",
        fieldId: row.field.id,
        value: row.value
      }) as { ok?: boolean; message?: string };
      if (!response?.ok) throw new Error(response?.message || "The field could not be filled.");
      setRows((current) => current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, status: "filled" } : item
      ));
      setStatus(response.message || "Field filled. Verify it on the portal.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not fill this field.");
    }
  }

  async function fillAllAvailable() {
    const pendingRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) =>
        Boolean(row.value.trim()) &&
        !row.field.isFile &&
        row.status !== "filled" &&
        row.status !== "conflict"
      );

    if (pendingRows.length === 0) {
      setStatus("There are no available extracted values to fill. Resolve conflicts or review the scan first.");
      return;
    }

    const confirmed = window.confirm(
      "FormSaathi is ready to fill " + pendingRows.length +
      " field(s) using the values shown in this panel. Check the suggestions first. " +
      "This may replace values already entered in those fields. FormSaathi will not submit the form. Continue?"
    );
    if (!confirmed) return;

    setBusy(true);
    setStatus("Filling " + pendingRows.length + " field(s). Keep this page open…");
    const filledIds = new Set<string>();
    const failures: string[] = [];

    try {
      const tabId = await getActiveTabId();
      for (const { row } of pendingRows) {
        try {
          const response = await chrome.tabs.sendMessage(tabId, {
            type: "FS_FILL",
            fieldId: row.field.id,
            value: row.value
          }) as { ok?: boolean; message?: string };

          if (response?.ok) {
            filledIds.add(row.field.id);
          } else {
            failures.push(row.field.label + ": " + (response?.message || "Could not fill this field."));
          }
        } catch (error) {
          failures.push(row.field.label + ": " + (error instanceof Error ? error.message : "Could not reach this field."));
        }
      }

      setRows((current) => current.map((row) =>
        filledIds.has(row.field.id) ? { ...row, status: "filled" } : row
      ));

      const successCount = filledIds.size;
      const failureCount = failures.length;
      setStatus(
        "Filled " + successCount + " of " + pendingRows.length + " available field(s)." +
        (failureCount ? " " + failureCount + " field(s) could not be filled; review them individually." : " Review the completed fields before submitting the portal form.") +
        " FormSaathi did not submit the application."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not fill the fields on this page.");
    } finally {
      setBusy(false);
    }
  }

  function editValue(index: number, value: string) {
    setRows((current) => current.map((row, itemIndex) =>
      itemIndex === index ? { ...row, value, status: row.status === "filled" || row.status === "conflict" ? "needs-review" : row.status } : row
    ));
  }

  async function tryAiMapping() {
    if (!scan.fields.length) {
      setStatus("Scan a form before requesting AI mapping.");
      return;
    }
    if (!account) {
      setStatus("Connect your FormSaathi account before using backend AI mapping.");
      return;
    }
    if (!window.confirm(
      "This sends every detected visible field descriptor in the current scan (up to 120 fields), plus a small set of retrieved approved profile facts per field, to the FormSaathi backend and Google Gemini. Values already typed into the form, cookies and original document files are not sent. Continue?"
    )) return;

    setBusy(true);
    setStatus("Requesting AI mapping from the hosted FormSaathi backend…");
    try {
      const session = await getExtensionSession();
      if (!session) throw new Error("Your FormSaathi session expired. Connect your account again.");
      const analysis = await requestFormAnalysis(scan, session.access_token);
      setRows((current) => mergeAiMappings(current, analysis.mappings));
      setStatus(
        analysis.aiUsed
          ? (analysis.matchedCount || analysis.mappings.length) + " AI suggestion(s) received. Review every value before filling."
          : analysis.note
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI mapping is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  const filledCount = rows.filter((row) => row.status === "filled").length;
  const fillableCount = rows.filter((row) =>
    Boolean(row.value.trim()) &&
    !row.field.isFile &&
    row.status !== "filled" &&
    row.status !== "conflict"
  ).length;

  return (
    <main className="app-shell">
      <header className="brand-row">
        <div className="brand-block">
          <div className="brand-mark">FS</div>
          <div className="brand-name">FormSaathi</div>
          <div className="brand-caption">Your form companion</div>
        </div>
        <div className={apiReady ? "service-pill online" : "service-pill offline"}>
          <span /> FormSaathi API {apiReady ? "online" : "offline"}
        </div>
      </header>

      <section className="account-card" aria-label="FormSaathi account connection">
        {accountLoading ? <p className="account-muted">Checking your FormSaathi account…</p> : account ? (
          <div className="account-connected">
            <div><strong>Account connected</strong><small>{account.email || "Signed in"}</small><small>Approved profile facts are available for form matching.</small></div>
            <button type="button" className="account-disconnect" disabled={authBusy} onClick={() => void handleDisconnect()}>{authBusy ? "Please wait…" : "Disconnect"}</button>
          </div>
        ) : (
          <form className="account-form" onSubmit={(event) => void handleConnect(event)}>
            <div><strong>Connect your FormSaathi account</strong><small>Use the same email and password as the web app.</small></div>
            <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email address" autoComplete="username" required />
            <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" autoComplete="current-password" required />
            {authError && <p className="account-error" role="alert">{authError}</p>}
            <button className="primary-button full" type="submit" disabled={authBusy}>{authBusy ? "Connecting…" : "Connect account"}</button>
            <a className="account-link" href="https://formsaathi-web.vercel.app" target="_blank" rel="noreferrer">Open FormSaathi website ↗</a>
          </form>
        )}
        {account && authError && <p className="account-error" role="alert">{authError}</p>}
      </section>

      <div className="privacy-note">
        Your approved profile facts sync from FormSaathi. Selected local documents are sent to hosted OCR only after a separate confirmation. AI analysis sends the complete detected field-descriptor list (up to 120 fields) and only the retrieved approved-fact candidates per field after your confirmation; typed form values, cookies and original files are not sent to Gemini for webpage-form matching.
      </div>

      <nav className="tabs">
        <button className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>My documents</button>
        <button className={tab === "form" ? "active" : ""} onClick={() => setTab("form")}>Current form</button>
      </nav>

      {tab === "documents" && (
        <section>
          <div className="section-heading">
            <div><h1>Document vault</h1><p>Organize once. Retrieve only what a form needs.</p></div>
          </div>
          <label className="field-label" htmlFor="category">Document category</label>
          <select id="category" value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)}>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <label className="upload-button">
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleUpload} />
            <span>＋ Add PDF or image</span>
          </label>
          <div className="prepare-settings">
            <div className="prepare-heading">Portal upload requirements</div>
            <div className="prepare-grid">
              <label>Maximum size (KB)<input type="number" min="5" max="5000" value={maxKb} onChange={(event) => setMaxKb(Math.min(5000, Math.max(5, Number(event.target.value) || 5)))} /></label>
              <label>Max width (px)<input type="number" min="32" max="4000" value={maxWidth} onChange={(event) => setMaxWidth(Math.min(4000, Math.max(32, Number(event.target.value) || 32)))} /></label>
              <label>Max height (px)<input type="number" min="32" max="4000" value={maxHeight} onChange={(event) => setMaxHeight(Math.min(4000, Math.max(32, Number(event.target.value) || 32)))} /></label>
            </div>
            <p>Prepare JPEG copies of photos or signatures. The original stays in your vault; attach the downloaded copy yourself.</p>
          </div>
          <div className="category-summary">
            {groupedCount.map((item) => (
              <div key={item.value}><span>{item.label}</span><b>{item.count}</b></div>
            ))}
          </div>
          <div className="document-list">
            {documents.length === 0 && <p className="empty-state">No documents yet. Add a synthetic test document to start.</p>}
            {documents.map((document) => (
              <article className="document-card" key={document.id}>
                <div className="file-icon">{document.mimeType === "application/pdf" ? "PDF" : "IMG"}</div>
                <div className="document-main">
                  <strong title={document.name}>{document.name}</strong>
                  <select
                    className="document-category"
                    value={document.category}
                    aria-label={"Category for " + document.name}
                    onChange={(event) => void changeDocumentCategory(document, event.target.value as DocumentCategory)}
                  >
                    {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <small>{document.cachedAt ? "OCR cached locally" : "Not processed"}</small>
                  {document.mimeType.startsWith("image/") && (
                    <button className="text-button prepare-button" disabled={!apiReady || preparingId === document.id} onClick={() => void prepareDocumentImage(document)}>
                      {preparingId === document.id ? "Preparing…" : "Prepare JPEG copy"}
                    </button>
                  )}
                </div>
                <button className="icon-button" title="Delete document" onClick={() => void handleDelete(document.id)}>×</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "form" && (
        <section>
          <div className="section-heading">
            <div><h1>Form assistant</h1><p>Inspect the active tab and review possible matches.</p></div>
          </div>
          <button className="primary-button full" disabled={busy} onClick={() => void scanCurrentPage()}>
            {busy ? "Working…" : "Scan current page"}
          </button>
          {scan.url && <div className="page-meta"><strong>{scan.title || "Untitled page"}</strong><span>{scan.url}</span></div>}
          {rows.length > 0 && (
            <>
              <div className="progress-row"><span>{filledCount} of {rows.length} fields filled</span><b>{Math.round((filledCount / rows.length) * 100)}%</b></div>
              <div className="progress-track"><div style={{ width: (filledCount / rows.length * 100) + "%" }} /></div>
              <button
                type="button"
                className="primary-button full bulk-fill-button"
                disabled={busy || fillableCount === 0}
                onClick={() => void fillAllAvailable()}
              >
                {busy ? "Working…" : fillableCount > 0 ? "Fill all available fields (" + fillableCount + ")" : "No fields ready to fill"}
              </button>
              <p className="muted small">Fills only fields with a value. File uploads, conflicts and already-filled fields are skipped. The application is never submitted.</p>
              <button className="secondary-button full" disabled={busy} onClick={() => void tryAiMapping()}>Re-run AI form analysis</button>
              <p className="muted small">Uses the hosted FormSaathi backend and Gemini. Each AI request requires your confirmation.</p>
              <div className="mapping-list">
                {rows.map((row, index) => (
                  <article className="mapping-card" key={row.field.id}>
                    <div className="mapping-top">
                      <div><strong>{row.field.label}</strong><span>{row.field.inputType}{row.field.required ? " · required" : ""}</span></div>
                      <span className={"status-tag " + row.status}>{row.status === "conflict" ? "Conflict" : row.status === "filled" ? "Filled" : row.value ? "Review" : "No match"}</span>
                    </div>
                    <button className="text-button" onClick={() => void highlight(row)}>Highlight on page ↗</button>
                    {row.field.isFile ? (
                      <p className="muted small">File upload detected. Attach it manually; browsers prevent extensions from setting file contents.</p>
                    ) : (
                      <>
                        <input className="value-input" value={row.value} placeholder="Enter or edit suggested value" onChange={(event) => editValue(index, event.target.value)} />
                        <div className="evidence">
                          {row.sourceName ? <span>Source: {row.sourceName}</span> : <span>No matched document</span>}
                          {typeof row.confidence === "number" && <span>Signal: {Math.round(row.confidence * 100)}%</span>}
                        </div>
                        {row.evidence && <p className={"evidence-quote " + (row.status === "conflict" ? "conflict-evidence" : "")}>{row.status === "conflict" ? "Conflicting values: " : "OCR evidence: "}{row.evidence.replace(/^Conflict: /, "")}</p>}
                        <button className="approve-button" disabled={!row.value.trim() || row.status === "filled"} onClick={() => void approveFill(index)}>
                          {row.status === "filled" ? "Filled · verify on page" : "Approve & fill this field"}
                        </button>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <footer className="status-bar"><span className="status-dot" />{status}</footer>
      <div className="footer-note">FormSaathi never submits an application for you.</div>
    </main>
  );
}

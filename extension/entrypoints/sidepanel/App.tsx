import { useEffect, useMemo, useState } from "react";
import { checkApi, extractDocument, prepareImage as requestImagePreparation, requestAiMappings } from "../../lib/api";
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

export default function App() {
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
    void checkApi().then(setApiReady);
    const timer = window.setInterval(() => void checkApi().then(setApiReady), 8000);
    return () => window.clearInterval(timer);
  }, []);

  const groupedCount = useMemo(() => categories.map((item) => ({
    ...item,
    count: documents.filter((document) => document.category === item.value).length
  })), [documents]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setStatus("Use a PDF or image file.");
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
      setStatus("Start the local service before preparing images: npm run dev:server.");
      return;
    }
    setPreparingId(document.id);
    setStatus("Preparing a JPEG copy. Your original vault document will remain unchanged.");
    try {
      const result = await requestImagePreparation(document, maxKb, maxWidth, maxHeight);
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

      const relevantDocuments = retrieveRelevantDocuments(nextScan.fields, documents);
      const relevantCategories = Array.from(new Set(
        nextScan.fields.map(canonicalFieldKey).map(categoryForKey).filter(Boolean)
      ));
      if (relevantDocuments.length === 0) {
        setRows(createReviewRows(nextScan.fields, []));
        setStatus("Found " + nextScan.fields.length + " visible controls. No uploaded document matched the detected requirements. Add the relevant document category.");
        return;
      }

      if (!apiReady) throw new Error("The local OCR service is offline. Start it with npm run dev:server.");
      setStatus("Retrieving " + relevantDocuments.length + " relevant document(s) from: " + relevantCategories.join(", ") + ". Unrelated documents are not sent for OCR.");
      const facts: Array<CandidateFact & { sourceId: string; sourceName: string }> = [];
      for (const document of relevantDocuments) {
        let documentFacts = document.cachedFacts || [];
        if (!document.cachedAt) {
          const extracted = await extractDocument(document);
          documentFacts = extracted.facts;
          await saveDocument({ ...document, cachedText: extracted.text, cachedFacts: documentFacts, cachedAt: Date.now() });
        }
        for (const fact of documentFacts) facts.push({ ...fact, sourceId: document.id, sourceName: document.name });
      }
      setDocuments(await listDocuments());
      setRows(createReviewRows(nextScan.fields, facts));
      setStatus("Detected " + nextScan.fields.length + " controls. OCR ran only on " + relevantDocuments.length + " document(s) in the required categories. Review every suggested value.");
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

  function editValue(index: number, value: string) {
    setRows((current) => current.map((row, itemIndex) =>
      itemIndex === index ? { ...row, value, status: row.status === "filled" ? "needs-review" : row.status } : row
    ));
  }

  async function tryAiMapping() {
    if (!window.confirm("This sends only already-extracted candidate facts and detected field labels from relevant document categories to the configured Gemini API. Original documents are not sent. Continue?")) return;
    setBusy(true);
    setStatus("Requesting optional AI mapping…");
    try {
      const relevantDocuments = retrieveRelevantDocuments(scan.fields, documents);
      const relevantIds = new Set(relevantDocuments.map((document) => document.id));
      const facts = documents
        .filter((document) => relevantIds.has(document.id))
        .flatMap((document) => (document.cachedFacts || []).map((fact) => ({
          ...fact,
          sourceId: document.id,
          sourceName: document.name
        })));
      if (!facts.length) throw new Error("No extracted facts from relevant documents are available to map.");
      const response = await requestAiMappings(scan.fields, facts);
      setRows((current) => current.map((row) => {
        const suggestion = response.mappings.find((mapping) => mapping.fieldId === row.field.id);
        if (!suggestion || row.value) return row;
        const source = facts.find((fact) => fact.key === suggestion.factKey && fact.value === suggestion.value);
        return {
          ...row,
          value: suggestion.value,
          canonicalKey: suggestion.factKey,
          sourceName: source?.sourceName,
          sourceId: source?.sourceId,
          confidence: suggestion.confidence,
          status: "needs-review"
        };
      }));
      setStatus("AI suggestions received. They are unverified; check every value before filling.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI mapping is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  const filledCount = rows.filter((row) => row.status === "filled").length;

  return (
    <main className="app-shell">
      <header className="brand-row">
        <div className="brand-block">
          <div className="brand-mark">FS</div>
          <div className="brand-name">FormSaathi</div>
          <div className="brand-caption">Your form companion</div>
        </div>
        <div className={apiReady ? "service-pill online" : "service-pill offline"}>
          <span /> OCR {apiReady ? "online" : "offline"}
        </div>
      </header>

      <div className="privacy-note">
        Files stay in this browser until a relevant form requires OCR. Only matching document categories are processed.
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
            <input type="file" accept="application/pdf,image/*" onChange={handleUpload} />
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
              <button className="secondary-button full" disabled={busy} onClick={() => void tryAiMapping()}>Ask AI for mapping suggestions</button>
              <p className="muted small">Optional. Requires a Gemini key on the local service and sends extracted facts only after your confirmation.</p>
              <div className="mapping-list">
                {rows.map((row, index) => (
                  <article className="mapping-card" key={row.field.id}>
                    <div className="mapping-top">
                      <div><strong>{row.field.label}</strong><span>{row.field.inputType}{row.field.required ? " · required" : ""}</span></div>
                      <span className={"status-tag " + row.status}>{row.status === "filled" ? "Filled" : row.value ? "Review" : "No match"}</span>
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
                        {row.evidence && <p className="evidence-quote">OCR evidence: {row.evidence}</p>}
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

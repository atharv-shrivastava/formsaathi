import type { PortalField, ScanResult } from "../lib/types";

type Message =
  | { type: "FS_SCAN" }
  | { type: "FS_HIGHLIGHT"; fieldId: string; label: string }
  | { type: "FS_FILL"; fieldId: string; value: string; canonicalKey?: string | null }
  | { type: "FS_CLEAR_HIGHLIGHT" };

type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;

const KEY_ATTRIBUTE = "data-formsaathi-key";
const BLOCKED_INPUT_TYPES = new Set(["hidden", "password", "file", "checkbox", "radio", "submit", "button", "reset", "image"]);
const CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([type='password']):not([type='checkbox']):not([type='radio']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image'])",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='textbox'][contenteditable='true']"
].join(",");
let overlayHost: HTMLDivElement | null = null;
let highlightedElement: HTMLElement | null = null;
let repositionHandler: (() => void) | null = null;

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0";
}

function getControlName(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.name || "";
  }
  return element.getAttribute("name") || "";
}

function getControlPlaceholder(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.placeholder.trim();
  return element.getAttribute("data-placeholder") || "";
}

function textForLabelledBy(element: HTMLElement): string {
  const ids = element.getAttribute("aria-labelledby");
  if (!ids) return "";
  return ids.split(/\s+/)
    .map((id) => element.getRootNode() instanceof ShadowRoot
      ? (element.getRootNode() as ShadowRoot).getElementById(id)?.textContent?.trim() || ""
      : element.ownerDocument.getElementById(id)?.textContent?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function getLabel(element: HTMLElement): string {
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledBy = textForLabelledBy(element);
  if (labelledBy) return labelledBy;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const label = element.labels ? Array.from(element.labels).map((item) => item.innerText.trim()).find(Boolean) : "";
    if (label) return label;
  }

  const wrappingLabel = element.closest("label")?.textContent?.trim().replace(/\s+/g, " ");
  if (wrappingLabel) return wrappingLabel;

  const title = element.getAttribute("title")?.trim();
  if (title) return title;

  const placeholder = getControlPlaceholder(element);
  if (placeholder) return placeholder;

  const name = getControlName(element);
  if (name) return name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.-]+/g, " ");

  if (element.id) {
    const idLabel = element.id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.-]+/g, " ");
    if (!/^fs-/.test(idLabel)) return idLabel;
  }

  const container = element.closest(
    "label,.form-group,.form-field,.field,.form-item,[class*='form-group'],[class*='field-container']"
  ) || element.parentElement;
  const parentText = container?.textContent?.trim().replace(/\s+/g, " ") || "";
  return parentText.slice(0, 140) || "Unlabelled field";
}

function isFeedbackTextarea(element: HTMLTextAreaElement): boolean {
  const context = [
    getLabel(element),
    element.name,
    element.id,
    element.placeholder,
    element.getAttribute("aria-label"),
    element.getAttribute("aria-describedby")
  ].filter(Boolean).join(" ");

  return /\b(feedback|comments?|suggestions?|reviews?|complaints?|remarks?|testimonials?|bug reports?|report a problem|how can we improve|tell us what you think|share your thoughts)\b/i.test(context);
}

function collectControls(root: Document | ShadowRoot): HTMLElement[] {
  const collected = Array.from(root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR));
  const elements = Array.from(root.querySelectorAll<HTMLElement>("*"));
  for (const element of elements) {
    if (element.shadowRoot) collected.push(...collectControls(element.shadowRoot));
  }
  return collected;
}

function isSupportedControl(element: HTMLElement): boolean {
  if (!isVisible(element)) return false;
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return false;

  if (element instanceof HTMLInputElement) {
    return !BLOCKED_INPUT_TYPES.has(element.type) && !element.readOnly;
  }
  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly && !isFeedbackTextarea(element);
  }
  if (element instanceof HTMLSelectElement) return true;

  return element.isContentEditable && element.getAttribute("contenteditable") !== "false";
}

function scanPage(): ScanResult {
  const elements = Array.from(new Set(collectControls(document)))
    .filter(isSupportedControl)
    .filter((element) => {
      const editableParent = element.parentElement?.closest("[contenteditable='true']");
      return !editableParent || editableParent === element;
    });

  const fields: PortalField[] = elements.map((element, index) => {
    const control = element as FormControl;
    const existing = element.getAttribute(KEY_ATTRIBUTE);
    const id = existing || ("fs-" + index + "-" + crypto.randomUUID().slice(0, 8));
    element.setAttribute(KEY_ATTRIBUTE, id);

    const inputType = control instanceof HTMLInputElement
      ? control.type
      : control instanceof HTMLTextAreaElement
        ? "textarea"
        : control instanceof HTMLSelectElement
          ? "select"
          : "contenteditable";

    const selectOptions = control instanceof HTMLSelectElement
      ? Array.from(control.options).filter((option) => !option.disabled).slice(0, 40)
      : [];
    const optionValues = selectOptions.map((option) => ({
      label: option.text.trim().slice(0, 100),
      value: option.value.trim().slice(0, 100)
    })).filter((option) => option.label || option.value);
    const options = optionValues.map((option) => option.label || option.value).filter(Boolean);

    const nearbyText = (element.closest("label,.form-group,.form-field,.field,[class*='field']") || element.parentElement)
      ?.textContent?.trim().replace(/\s+/g, " ").slice(0, 180) || "";

    return {
      id,
      label: getLabel(control),
      tagName: element.tagName.toLowerCase(),
      inputType,
      required: (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)
        ? control.required || element.getAttribute("aria-required") === "true"
        : element.getAttribute("aria-required") === "true",
      placeholder: getControlPlaceholder(element),
      name: getControlName(element),
      options,
      optionValues,
      autocomplete: element.getAttribute("autocomplete") || "",
      role: element.getAttribute("role") || "",
      nearbyText,
      dataLabel: element.getAttribute("data-label") || element.getAttribute("data-field") || "",
      isContentEditable: element.isContentEditable,
      isFile: inputType === "file"
    };
  });

  return { title: document.title, url: location.href, fields };
}

function findFieldByKey(root: Document | ShadowRoot, fieldId: string): HTMLElement | null {
  const direct = root.querySelector<HTMLElement>("[" + KEY_ATTRIBUTE + "=\"" + CSS.escape(fieldId) + "\"]");
  if (direct) return direct;

  for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (!element.shadowRoot) continue;
    const nested = findFieldByKey(element.shadowRoot, fieldId);
    if (nested) return nested;
  }
  return null;
}

function getFieldElement(fieldId: string): HTMLElement | null {
  return findFieldByKey(document, fieldId);
}

function getOverlay(): ShadowRoot {
  if (!overlayHost) {
    overlayHost = document.createElement("div");
    overlayHost.id = "formsaathi-visual-overlay";
    overlayHost.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    document.documentElement.appendChild(overlayHost);
  }
  return overlayHost.shadowRoot || overlayHost.attachShadow({ mode: "open" });
}

function clearHighlight(): void {
  if (repositionHandler) {
    window.removeEventListener("scroll", repositionHandler, true);
    window.removeEventListener("resize", repositionHandler);
  }
  repositionHandler = null;
  highlightedElement = null;
  if (overlayHost?.shadowRoot) overlayHost.shadowRoot.innerHTML = "";
}

function highlightField(fieldId: string, label: string): boolean {
  const element = getFieldElement(fieldId);
  if (!element || !isVisible(element)) return false;
  clearHighlight();
  highlightedElement = element;
  const shadow = getOverlay();
  const style = document.createElement("style");
  style.textContent = [
    ".box{position:fixed;border:2px solid #315b46;border-radius:8px;box-shadow:0 0 0 4px rgba(49,91,70,.15);pointer-events:none;box-sizing:border-box}",
    ".tip{position:fixed;max-width:280px;background:#243d32;color:#fff;padding:9px 12px;border-radius:8px;font:12px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);pointer-events:none}",
    ".tip strong{display:block;color:#dce9dc;font-size:10px;letter-spacing:.05em;margin-bottom:3px}",
    "svg{position:fixed;inset:0;width:100vw;height:100vh;overflow:visible;pointer-events:none}"
  ].join("");
  shadow.appendChild(style);

  const box = document.createElement("div");
  box.className = "box";
  const tip = document.createElement("div");
  tip.className = "tip";
  const strong = document.createElement("strong");
  strong.textContent = "FORMSAATHI · SELECTED FIELD";
  const text = document.createElement("span");
  text.textContent = label;
  tip.append(strong, text);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("stroke", "#315b46");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-dasharray", "5 4");
  svg.appendChild(line);
  shadow.append(box, svg, tip);

  const place = () => {
    if (!highlightedElement || !highlightedElement.isConnected) {
      clearHighlight();
      return;
    }
    const rect = highlightedElement.getBoundingClientRect();
    box.style.left = Math.max(0, rect.left - 3) + "px";
    box.style.top = Math.max(0, rect.top - 3) + "px";
    box.style.width = Math.max(8, rect.width + 6) + "px";
    box.style.height = Math.max(8, rect.height + 6) + "px";
    const tipTop = Math.max(8, rect.top - 60);
    const tipLeft = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 300));
    tip.style.top = tipTop + "px";
    tip.style.left = tipLeft + "px";
    line.setAttribute("x1", String(rect.left + rect.width / 2));
    line.setAttribute("y1", String(rect.top + rect.height / 2));
    line.setAttribute("x2", String(tipLeft + 16));
    line.setAttribute("y2", String(tipTop + 34));
  };
  repositionHandler = place;
  window.addEventListener("scroll", place, true);
  window.addEventListener("resize", place);
  place();
  return true;
}

function normalizeOption(value: string): string {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function optionEquivalent(optionText: string, optionValue: string, value: string, canonicalKey?: string | null): boolean {
  const target = normalizeOption(value);
  if (!target) return false;
  if (normalizeOption(optionText) === target || normalizeOption(optionValue) === target) return true;

  if (canonicalKey === "gender") {
    const genderAliases: Record<string, string[]> = {
      male: ["m", "man", "male"],
      female: ["f", "woman", "female"],
      other: ["o", "others", "other", "nonbinary", "nonbinaryperson"],
      prefer_not_to_say: ["prefernot", "prefernot to say", "notspecified"]
    };
    return Object.values(genderAliases).some((values) =>
      values.includes(target) && values.some((alias) =>
        normalizeOption(alias) === normalizeOption(optionText) || normalizeOption(alias) === normalizeOption(optionValue)
      )
    );
  }
  return false;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const prototype = element instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLSelectElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
}

function fillField(fieldId: string, value: string, canonicalKey?: string | null): { ok: boolean; message: string } {
  const element = getFieldElement(fieldId);
  if (!element || !isVisible(element)) return { ok: false, message: "The field is no longer available. Scan the page again." };
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") {
    return { ok: false, message: "This field is disabled on the portal." };
  }

  if (element instanceof HTMLInputElement) {
    if (BLOCKED_INPUT_TYPES.has(element.type) || element.readOnly) {
      return { ok: false, message: "This field type cannot be safely autofilled." };
    }
    element.focus();
    setNativeValue(element, value);
  } else if (element instanceof HTMLTextAreaElement) {
    if (element.readOnly) return { ok: false, message: "This field cannot be edited." };
    element.focus();
    setNativeValue(element, value);
  } else if (element instanceof HTMLSelectElement) {
    const match = Array.from(element.options).find((option) =>
      !option.disabled && optionEquivalent(option.text, option.value, value, canonicalKey)
    );
    if (!match) return { ok: false, message: "No matching dropdown option was found. Choose the option manually." };
    element.focus();
    setNativeValue(element, match.value);
  } else if (element.isContentEditable && element.getAttribute("contenteditable") !== "false") {
    element.focus();
    element.textContent = value;
  } else {
    return { ok: false, message: "This portal uses a custom control that FormSaathi cannot safely edit yet. Enter the value manually." };
  }

  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, message: "Value entered. Verify it on the portal before continuing." };
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*", "file:///*"],
  allFrames: true,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
      if (message.type === "FS_SCAN") {
        sendResponse({ ok: true, result: scanPage() });
        return false;
      }
      if (message.type === "FS_HIGHLIGHT") {
        sendResponse({ ok: highlightField(message.fieldId, message.label) });
        return false;
      }
      if (message.type === "FS_FILL") {
        sendResponse(fillField(message.fieldId, message.value, message.canonicalKey));
        return false;
      }
      if (message.type === "FS_CLEAR_HIGHLIGHT") {
        clearHighlight();
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });
  }
});

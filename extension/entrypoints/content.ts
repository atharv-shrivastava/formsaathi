import type { PortalField, ScanResult } from "../lib/types";

type Message =
  | { type: "FS_SCAN" }
  | { type: "FS_HIGHLIGHT"; fieldId: string; label: string }
  | { type: "FS_FILL"; fieldId: string; value: string }
  | { type: "FS_CLEAR_HIGHLIGHT" };

const KEY_ATTRIBUTE = "data-formsaathi-key";
let overlayHost: HTMLDivElement | null = null;
let highlightedElement: HTMLElement | null = null;
let repositionHandler: (() => void) | null = null;

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 &&
    style.display !== "none" && style.visibility !== "hidden";
}

function getLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  const ariaLabel = element.getAttribute("aria-label");
  const labelTexts = element.labels ? Array.from(element.labels).map((item) => item.innerText.trim()) : [];
  const label = labelTexts.find(Boolean);
  if (label) return label;
  if (ariaLabel) return ariaLabel.trim();
  if (labelledBy) {
    const text = labelledBy.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || "")
      .filter(Boolean).join(" ");
    if (text) return text;
  }
  if (element.placeholder) return element.placeholder.trim();
  if (element.name) return element.name.replace(/[_-]/g, " ");
  if (element.id) return element.id.replace(/[_-]/g, " ");
  const parentText = element.parentElement?.innerText?.trim().replace(/\s+/g, " ") || "";
  return parentText.slice(0, 100) || "Unlabelled field";
}

function scanPage(): ScanResult {
  const selector = "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']), textarea, select";
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .filter((element) => isVisible(element));

  const fields: PortalField[] = elements.map((element, index) => {
    const control = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const existing = element.getAttribute(KEY_ATTRIBUTE);
    const id = existing || ("fs-" + index + "-" + Math.random().toString(36).slice(2, 8));
    element.setAttribute(KEY_ATTRIBUTE, id);
    const inputType = control instanceof HTMLInputElement ? control.type : element.tagName.toLowerCase();
    const options = control instanceof HTMLSelectElement
      ? Array.from(control.options).map((option) => option.text.trim()).filter(Boolean).slice(0, 30)
      : undefined;

    return {
      id,
      label: getLabel(control),
      tagName: element.tagName.toLowerCase(),
      inputType,
      required: control.required || element.getAttribute("aria-required") === "true",
      placeholder: control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.placeholder : "",
      name: control.name || "",
      options,
      isFile: inputType === "file"
    };
  });

  return { title: document.title, url: location.href, fields };
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
  const element = document.querySelector<HTMLElement>("[" + KEY_ATTRIBUTE + "=\"" + CSS.escape(fieldId) + "\"]");
  if (!element || !isVisible(element)) return false;
  clearHighlight();
  highlightedElement = element;
  const shadow = getOverlay();
  const style = document.createElement("style");
  style.textContent = [
    ".box{position:fixed;border:3px solid #2463eb;border-radius:8px;box-shadow:0 0 0 5px rgba(37,99,235,.18);pointer-events:none;box-sizing:border-box}",
    ".tip{position:fixed;max-width:280px;background:#14213d;color:#fff;padding:10px 13px;border-radius:10px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.25);pointer-events:none}",
    ".tip strong{display:block;color:#bfdbfe;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}",
    "svg{position:fixed;inset:0;width:100vw;height:100vh;overflow:visible;pointer-events:none}"
  ].join("");
  shadow.appendChild(style);

  const box = document.createElement("div");
  box.className = "box";
  const tip = document.createElement("div");
  tip.className = "tip";
  const strong = document.createElement("strong");
  strong.textContent = "FormSaathi • selected field";
  const text = document.createElement("span");
  text.textContent = label;
  tip.append(strong, text);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("stroke", "#2463eb");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-dasharray", "6 4");
  svg.appendChild(line);
  shadow.append(box, svg, tip);

  const place = () => {
    if (!highlightedElement || !highlightedElement.isConnected) {
      clearHighlight();
      return;
    }
    const rect = highlightedElement.getBoundingClientRect();
    box.style.left = Math.max(0, rect.left - 4) + "px";
    box.style.top = Math.max(0, rect.top - 4) + "px";
    box.style.width = Math.max(8, rect.width + 8) + "px";
    box.style.height = Math.max(8, rect.height + 8) + "px";
    const tipTop = Math.max(8, rect.top - 66);
    const tipLeft = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - 300));
    tip.style.top = tipTop + "px";
    tip.style.left = tipLeft + "px";
    line.setAttribute("x1", String(rect.left + rect.width / 2));
    line.setAttribute("y1", String(rect.top + rect.height / 2));
    line.setAttribute("x2", String(tipLeft + 18));
    line.setAttribute("y2", String(tipTop + 40));
  };
  repositionHandler = place;
  window.addEventListener("scroll", place, true);
  window.addEventListener("resize", place);
  place();
  return true;
}

function fillField(fieldId: string, value: string): { ok: boolean; message: string } {
  const element = document.querySelector<HTMLElement>("[" + KEY_ATTRIBUTE + "=\"" + CSS.escape(fieldId) + "\"]");
  if (!element || !isVisible(element)) return { ok: false, message: "The field is no longer available. Scan the page again." };
  if (element instanceof HTMLInputElement) {
    if (["file", "password", "hidden", "submit", "button", "reset", "checkbox", "radio", "image"].includes(element.type) || element.disabled || element.readOnly) {
      return { ok: false, message: "This field type cannot be safely autofilled." };
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(element, value);
  } else if (element instanceof HTMLTextAreaElement) {
    if (element.disabled || element.readOnly) return { ok: false, message: "This field cannot be edited." };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(element, value);
  } else if (element instanceof HTMLSelectElement) {
    if (element.disabled) return { ok: false, message: "This dropdown is disabled." };
    const match = Array.from(element.options).find((option) =>
      option.value.trim().toLowerCase() === value.trim().toLowerCase() ||
      option.text.trim().toLowerCase() === value.trim().toLowerCase()
    );
    if (!match) return { ok: false, message: "No exact dropdown option matched. Select it manually." };
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(element, match.value);
  } else {
    return { ok: false, message: "This control is not supported for autofill." };
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, message: "Value entered. Review it on the portal before continuing." };
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*", "file:///*"],
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
        sendResponse(fillField(message.fieldId, message.value));
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

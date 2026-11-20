/**
 * Translates the original Portuguese screens to English at render time.
 *
 * Instead of rewriting every legacy page, a MutationObserver swaps any text
 * node (and placeholder/title/aria-label attribute) whose exact Portuguese text
 * is in LEGACY_EN. Only nodeValue/attributes change, never the DOM structure,
 * so React keeps working normally. New code should use t() from "@/i18n".
 * Mark an element with data-no-translate to leave its content untouched.
 */
import { LEGACY_EN } from "./legacy-en";

const ATTRS = ["placeholder", "title", "aria-label"];
const dict = new Map(Object.entries(LEGACY_EN).map(([k, v]) => [norm(k), v]));

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function skip(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (e.hasAttribute?.("data-no-translate")) return true;
    const tag = e.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "CODE" || tag === "PRE") return true;
  }
  return false;
}

function translateText(node: Text) {
  const raw = node.nodeValue;
  if (!raw || !/[A-Za-zÀ-ú]/.test(raw)) return;
  const en = dict.get(norm(raw));
  if (en === undefined || skip(node.parentElement)) return;
  const lead = raw.match(/^\s*/)?.[0] ?? "";
  const trail = raw.match(/\s*$/)?.[0] ?? "";
  const next = lead + en + trail;
  if (next !== raw) node.nodeValue = next;
}

function translateAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const en = dict.get(norm(v));
    if (en !== undefined && en !== v) el.setAttribute(a, en);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (skip(el)) return;
  translateAttrs(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = tw.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) translateText(n as Text);
    else translateAttrs(n as Element);
    n = tw.nextNode();
  }
}

let observer: MutationObserver | null = null;

export function startDomTranslation() {
  if (observer || typeof document === "undefined") return;
  walk(document.body);
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") translateText(m.target as Text);
      else if (m.type === "attributes") translateAttrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

export function stopDomTranslation() {
  observer?.disconnect();
  observer = null;
}

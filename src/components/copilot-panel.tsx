import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Send, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlant } from "@/industry/use-plant";
import { ask, greeting, suggestions, type AgentAction, type CopilotAnswer } from "@/industry/copilot";
import { RichText } from "@/industry/ui";
import { useAuth } from "@/context/auth-context";
import { FaiscaMark } from "./faisca-mark";

const EVENT = "effio:copilot";

/** Opens Faísca from anywhere; optionally asks a question right away. */
export function openCopilot(question?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { question } }));
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  links?: CopilotAnswer["links"];
  actions?: AgentAction[];
  done?: boolean; // actions already used
}

export function CopilotPanel() {
  const { empresaId, info, fmt, lang, t } = usePlant();
  const { token, usuario } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const firstName = usuario?.nome?.split(" ")[0];

  useEffect(() => {
    setMsgs([]);
  }, [empresaId, lang]);

  useEffect(() => {
    const h = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent).detail?.question as string | undefined;
      if (q) pending.current = q;
    };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);

  // Faísca speaks first when the panel opens on an empty conversation
  useEffect(() => {
    if (open && msgs.length === 0 && empresaId && info && !pending.current) {
      const g = greeting(empresaId, lang, fmt, firstName);
      setMsgs([{ role: "assistant", text: g.text, actions: g.actions }]);
    }
  }, [open, msgs.length, empresaId, info, lang, fmt, firstName]);

  useEffect(() => {
    if (open && pending.current && !busy) {
      const q = pending.current;
      pending.current = null;
      void send(q);
    }
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(q: string) {
    if (!q.trim() || !empresaId || !info || busy) return;
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "" }]);
    const [answer] = await Promise.all([ask(q, empresaId, lang, fmt), new Promise((r) => setTimeout(r, 550))]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      const words = answer.text.split(/(\s+)/);
      for (let i = 1; i <= words.length; i += 3) {
        const partial = words.slice(0, i).join("");
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text: partial }]);
        await new Promise((r) => setTimeout(r, 16));
      }
    }
    setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text: answer.text, links: answer.links, actions: answer.actions }]);
    setBusy(false);
  }

  /** Opens a real ticket in the internal chat, assigned to the first active team member. */
  async function runAction(msgIndex: number, action: AgentAction) {
    setMsgs((m) => m.map((x, i) => (i === msgIndex ? { ...x, done: true } : x)));
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    try {
      const users = await fetch("/api/usuarios", { headers }).then((r) => (r.ok ? r.json() : []));
      const owner = (users as { id: number; nome: string; perfil: string; status: string }[]).find(
        (u) => u.perfil === "colaborador" && u.status === "ativo",
      );
      if (!owner) throw new Error(t("copilot.noOwner"));
      const res = await fetch("/api/chat/chamados", { method: "POST", headers, body: JSON.stringify({ destinado_a: owner.id, titulo: action.title }) });
      const ticket = await res.json();
      if (!res.ok) throw new Error(ticket.error ?? res.statusText);
      await fetch(`/api/chat/chamados/${ticket.id}/mensagens`, { method: "POST", headers, body: JSON.stringify({ conteudo: action.body }) });
      qc.invalidateQueries({ queryKey: ["chamados"] });
      setMsgs((m) => [...m, { role: "assistant", text: t("copilot.ticketDone", { name: owner.nome }), links: [{ label: t("copilot.openChat"), href: "/chat" }] }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: t("copilot.ticketFail", { err: e instanceof Error ? e.message : String(e) }) }]);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="vt-fab fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full py-2 pl-2 pr-4 text-sm font-semibold"
          data-testid="copilot-fab"
        >
          <FaiscaMark size={28} flicker /> {t("copilot.name")}
        </button>
      )}
      {open && (
        <aside className="vt-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col shadow-2xl" data-testid="copilot-panel" data-no-translate aria-label={t("copilot.name")}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--vt-trilho)" }}>
            <div className="flex items-center gap-3">
              <FaiscaMark size={36} flicker />
              <div>
                <div className="text-lg font-bold leading-tight" style={{ fontStretch: "115%" }}>{t("copilot.name")}</div>
                <div className="vt-small">{info ? t("copilot.role", { plant: info.plant.name }) : t("copilot.noPlant")}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t("common.close")} className="rounded-full p-1.5 text-[color:var(--vt-neblina)] hover:text-[color:var(--vt-cal)]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-[0.95rem] leading-relaxed">
            {!info && <p className="vt-small">{t("copilot.noPlant")}</p>}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="vt-msg-user">{m.text}</div>
              ) : (
                <div key={i} className="vt-msg-bot flex gap-3" data-testid="copilot-answer">
                  <FaiscaMark size={22} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    {m.text ? <RichText text={m.text} /> : <span className="vt-small animate-pulse">{t("copilot.thinking")}</span>}
                    {(m.actions?.length || m.links?.length) && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {m.actions?.map((a) => (
                          <button key={a.title} className="vt-action" disabled={m.done} onClick={() => runAction(i, a)} data-testid="copilot-action">
                            {a.label}
                          </button>
                        ))}
                        {m.links?.map((l) => (
                          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm font-medium underline underline-offset-4" style={{ color: "var(--vt-arco)" }}>
                            {l.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {info && msgs.length <= 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions(lang).map((s) => (
                  <button key={s} onClick={() => send(s)} className="vt-chip" data-testid="copilot-suggestion">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 px-4 pb-2 pt-3"
          >
            <input className="vt-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("copilot.placeholder")} disabled={!info} data-testid="copilot-input" />
            <button type="submit" disabled={busy || !info || !input.trim()} aria-label={t("copilot.send")} className="vt-action flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0" style={{ background: "var(--vt-sodio)", color: "#1d1300" }}>
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="px-5 pb-4 text-[11px]" style={{ color: "var(--vt-neblina)" }}>{t("copilot.footer")}</div>
        </aside>
      )}
    </>
  );
}

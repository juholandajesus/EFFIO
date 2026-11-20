import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlant } from "@/industry/use-plant";
import { ask, suggestions, type CopilotAnswer } from "@/industry/copilot";
import { RichText } from "@/industry/ui";

const EVENT = "effio:copilot";

/** Opens the copilot from anywhere; optionally asks a question right away. */
export function openCopilot(question?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { question } }));
}

interface Msg {
  role: "user" | "assistant";
  text: string;
  links?: CopilotAnswer["links"];
  typing?: boolean;
}

export function CopilotPanel() {
  const { empresaId, info, fmt, lang, t } = usePlant();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);

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

  async function send(q: string) {
    if (!q.trim() || !empresaId || !info || busy) return;
    setInput("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "", typing: true }]);
    const [answer] = await Promise.all([ask(q, empresaId, lang, fmt), new Promise((r) => setTimeout(r, 650))]);
    // reveal progressively, like a streamed answer
    const words = answer.text.split(/(\s+)/);
    for (let i = 1; i <= words.length; i += 3) {
      const partial = words.slice(0, i).join("");
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text: partial, typing: true }]);
      await new Promise((r) => setTimeout(r, 18));
    }
    setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text: answer.text, links: answer.links }]);
    setBusy(false);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
          data-testid="copilot-fab"
        >
          <Sparkles className="h-4 w-4" /> {t("copilot.name")}
        </button>
      )}
      {open && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-2xl" data-testid="copilot-panel">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary p-1.5 text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
              <div>
                <div className="font-semibold leading-tight">{t("copilot.name")}</div>
                <div className="text-xs text-muted-foreground">{info ? info.plant.name : t("copilot.noPlant")}</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label={t("common.close")} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-muted-foreground">{info ? t("copilot.intro") : t("copilot.noPlant")}</p>
                {info &&
                  suggestions(lang).map((s) => (
                    <button key={s} onClick={() => send(s)} className="block w-full rounded-lg border px-3 py-2 text-left hover:bg-muted" data-testid="copilot-suggestion">
                      {s}
                    </button>
                  ))}
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-8 rounded-lg bg-primary/15 px-3 py-2">{m.text}</div>
              ) : (
                <div key={i} className="mr-4 rounded-lg border bg-background px-3 py-2" data-testid="copilot-answer">
                  {m.text ? <RichText text={m.text} /> : <span className="animate-pulse text-muted-foreground">{t("copilot.thinking")}</span>}
                  {m.links && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.links.map((l) => (
                        <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2 border-t p-3"
          >
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("copilot.placeholder")} disabled={!info} data-testid="copilot-input" />
            <Button type="submit" size="icon" disabled={busy || !info} aria-label={t("copilot.send")}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="px-4 pb-3 text-[11px] text-muted-foreground">{t("copilot.footer")}</div>
        </aside>
      )}
    </>
  );
}

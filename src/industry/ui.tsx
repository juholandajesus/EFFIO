import type { ReactNode } from "react";
import { Factory, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n";

/** Validated categorical order (fixed, never cycled) + reserved status colors. */
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };
export const GRID = "#1e262f";
/** quiet tint of series 1, for ranges and runner-up bars */
export const SERIES_SOFT = "#1d3a5c";
export const MUTED_INK = "#8a97a3";
export const AXIS = { stroke: MUTED_INK, fontSize: 12, tickLine: false, axisLine: false } as const;
export const TOOLTIP = {
  contentStyle: { borderRadius: 8, border: "1px solid #24303b", background: "#11171d", color: "#edf1f4", boxShadow: "0 8px 24px rgb(0 0 0 / 0.5)", fontSize: 12 },
  labelStyle: { color: "#8a97a3" },
  itemStyle: { color: "#edf1f4" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Kpi({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: ReactNode; icon?: React.ElementType; tone?: "accent" }) {
  return (
    <Card className={`shadow-sm ${tone === "accent" ? "border-l-4 border-l-primary" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function NoPlant() {
  const { t } = useT();
  return (
    <div className="flex h-72 items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Factory className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">{t("noplant.title")}</p>
          <p className="text-sm text-muted-foreground">{t("noplant.body")}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  const { t } = useT();
  const map = {
    high: { color: STATUS.critical, Icon: AlertTriangle, label: t("sev.high") },
    medium: { color: STATUS.serious, Icon: AlertCircle, label: t("sev.medium") },
    low: { color: STATUS.warning, Icon: Info, label: t("sev.low") },
  }[severity];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">
      <map.Icon className="h-3.5 w-3.5" style={{ color: map.color }} />
      {map.label}
    </span>
  );
}

/** Renders the copilot's light markdown (**bold**, "- " bullets). */
export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
    );
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) =>
        l.startsWith("- ") ? (
          <div key={i} className="flex gap-2 pl-1">
            <span className="text-muted-foreground">•</span>
            <span>{bold(l.slice(2))}</span>
          </div>
        ) : l.trim() ? (
          <p key={i}>{bold(l)}</p>
        ) : null,
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.dashed ? (
            <span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

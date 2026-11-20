import { Link, useLocation } from "wouter";
import {
  Zap, Building2, Upload, BarChart3, Activity, FileText,
  BatteryCharging, LayoutDashboard, GitMerge, LogOut,
  Building, Cpu, FileCheck, MessageSquare, UserCheck,
  Factory, Boxes, Radar, Leaf, PlugZap,
} from "lucide-react";
import { useT } from "@/i18n";
import type { Dict } from "@/i18n/en";
import { getPlant } from "@/industry/engine";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarGroup, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { useEmpresa } from "@/context/empresa-context";
import { useAuth } from "@/context/auth-context";

type NavItem = { title: keyof Dict; url: string; icon: React.ElementType };

const AI_ITEMS: NavItem[] = [
  { title: "nav.overview", url: "/overview", icon: Factory },
  { title: "nav.production", url: "/production", icon: Boxes },
  { title: "nav.anomalies", url: "/anomalies", icon: Radar },
  { title: "nav.carbon", url: "/carbon", icon: Leaf },
  { title: "nav.integrations", url: "/integrations", icon: PlugZap },
];

const ALWAYS_VISIBLE: NavItem[] = [
  { title: "nav.companies", url: "/empresas", icon: Building2 },
  { title: "nav.sectors", url: "/setores", icon: Building },
  { title: "nav.machines", url: "/maquinas", icon: Cpu },
  { title: "nav.chat", url: "/chat", icon: MessageSquare },
];

const GESTOR_ITEMS: NavItem[] = [
  { title: "nav.approvals", url: "/aprovacoes", icon: UserCheck },
];

const ML_ITEMS: NavItem[] = [
  { title: "nav.contract", url: "/contrato", icon: FileCheck },
  { title: "nav.uploadCsv", url: "/upload-csv", icon: Upload },
  { title: "nav.consumption", url: "/consumo", icon: Activity },
  { title: "nav.mlDashboard", url: "/dashboard", icon: BarChart3 },
  { title: "nav.mlDiagnostics", url: "/diagnosticos", icon: FileText },
];

const BESS_ITEMS: NavItem[] = [
  { title: "nav.bessUnits", url: "/bess", icon: BatteryCharging },
  { title: "nav.bessDashboard", url: "/dashboard-bess", icon: LayoutDashboard },
  { title: "nav.bessDiagnostics", url: "/diagnosticos-bess", icon: FileText },
];

const INTEGRADO_ITEMS: NavItem[] = [
  { title: "nav.integrated", url: "/dashboard-integrado", icon: GitMerge },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { empresaAtiva, hasMercadoLivre, hasBess, hasCompleto } = useEmpresa();
  const { isGestor, usuario, logout } = useAuth();
  const { t } = useT();

  const noEmpresa = !empresaAtiva;
  const country = getPlant(empresaAtiva?.id)?.plant.country ?? (empresaAtiva ? "BR" : null);
  const isBrazil = country === "BR";

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={location === item.url}>
          <Link href={item.url} className="flex items-center gap-3">
            <item.icon className="h-5 w-5" />
            <span>{t(item.title)}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar>
      <SidebarHeader className="p-4 flex flex-row items-center gap-2">
        <div className="bg-primary text-primary-foreground p-1 rounded-md flex items-center justify-center">
          <Zap className="h-6 w-6" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-bold text-xl tracking-tight">EFFIO</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("brand.tagline")}</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("nav.groupAi")}
          </SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {renderItems(AI_ITEMS)}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("nav.groupManage")}
          </SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {renderItems(ALWAYS_VISIBLE)}
            {isGestor && renderItems(GESTOR_ITEMS)}
          </SidebarMenu>
        </SidebarGroup>

        {(noEmpresa || (hasMercadoLivre && isBrazil)) && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Mercado Livre
            </SidebarGroupLabel>
            <SidebarMenu className="px-2">
              {renderItems(ML_ITEMS)}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {(noEmpresa || hasBess) && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              BESS
            </SidebarGroupLabel>
            <SidebarMenu className="px-2">
              {renderItems(BESS_ITEMS)}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {(noEmpresa || hasCompleto) && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("nav.groupIntegrated")}
            </SidebarGroupLabel>
            <SidebarMenu className="px-2">
              {renderItems(INTEGRADO_ITEMS)}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {usuario && (
          <div className="text-xs text-muted-foreground mb-2 px-1 truncate">
            <span className="font-medium">{usuario.nome}</span>
            <br />
            <span className="opacity-70">{t(`role.${usuario.perfil}` as "role.gestor_principal")}</span>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild onClick={logout}>
              <button className="flex items-center gap-3 text-muted-foreground hover:text-foreground w-full">
                <LogOut className="h-5 w-5" />
                <span>{t("nav.logout")}</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

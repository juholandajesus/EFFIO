import { Link, useLocation } from "wouter";
import { 
  Zap, Building2, Upload, BarChart3, Activity, FileText,
  BatteryCharging, LayoutDashboard, GitMerge, LogOut,
  Building, Cpu, FileCheck, MessageSquare, UserCheck, Settings
} from "lucide-react";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarGroup, SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { useEmpresa } from "@/context/empresa-context";
import { useAuth } from "@/context/auth-context";

type NavItem = { title: string; url: string; icon: React.ElementType };

const ALWAYS_VISIBLE: NavItem[] = [
  { title: "Empresas", url: "/empresas", icon: Building2 },
  { title: "Setores", url: "/setores", icon: Building },
  { title: "Máquinas", url: "/maquinas", icon: Cpu },
  { title: "Contrato de Energia", url: "/contrato", icon: FileCheck },
  { title: "Chat Interno", url: "/chat", icon: MessageSquare },
];

const GESTOR_ITEMS: NavItem[] = [
  { title: "Aprovações", url: "/aprovacoes", icon: UserCheck },
];

const ML_ITEMS: NavItem[] = [
  { title: "Upload CSV", url: "/upload-csv", icon: Upload },
  { title: "Consumo Energético", url: "/consumo", icon: Activity },
  { title: "Dashboard Mercado Livre", url: "/dashboard", icon: BarChart3 },
  { title: "Diagnósticos Mercado Livre", url: "/diagnosticos", icon: FileText },
];

const BESS_ITEMS: NavItem[] = [
  { title: "Unidades BESS", url: "/bess", icon: BatteryCharging },
  { title: "Dashboard BESS", url: "/dashboard-bess", icon: LayoutDashboard },
  { title: "Diagnósticos BESS", url: "/diagnosticos-bess", icon: FileText },
];

const INTEGRADO_ITEMS: NavItem[] = [
  { title: "Dashboard Integrado", url: "/dashboard-integrado", icon: GitMerge },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { empresaAtiva, hasMercadoLivre, hasBess, hasCompleto } = useEmpresa();
  const { isGestor, usuario, logout } = useAuth();

  const noEmpresa = !empresaAtiva;

  const renderItems = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={location === item.url}>
          <Link href={item.url} className="flex items-center gap-3">
            <item.icon className="h-5 w-5" />
            <span>{item.title}</span>
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
        <span className="font-bold text-xl tracking-tight">EFFIO</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Gestão
          </SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {renderItems(ALWAYS_VISIBLE)}
            {isGestor && renderItems(GESTOR_ITEMS)}
          </SidebarMenu>
        </SidebarGroup>

        {(noEmpresa || hasMercadoLivre) && (
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
              Integrado
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
            <span className="opacity-70">{usuario.perfil.replace("_", " ")}</span>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild onClick={logout}>
              <button className="flex items-center gap-3 text-muted-foreground hover:text-foreground w-full">
                <LogOut className="h-5 w-5" />
                <span>Sair</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

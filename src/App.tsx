import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmpresaProvider } from "@/context/empresa-context";
import { AuthProvider } from "@/context/auth-context";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Cadastro from "@/pages/cadastro";
import Dashboard from "@/pages/dashboard";
import Empresas from "@/pages/empresas";
import UploadCsv from "@/pages/upload-csv";
import Consumo from "@/pages/consumo";
import Diagnosticos from "@/pages/diagnosticos";
import Bess from "@/pages/bess";
import DashboardBess from "@/pages/dashboard-bess";
import DiagnosticosBess from "@/pages/diagnosticos-bess";
import DashboardIntegrado from "@/pages/dashboard-integrado";
import Setores from "@/pages/setores";
import Maquinas from "@/pages/maquinas";
import Contrato from "@/pages/contrato";
import Chat from "@/pages/chat";
import Aprovacoes from "@/pages/aprovacoes";
import { Layout } from "@/components/layout";
import { DemoBanner } from "@/components/demo-banner";
import { I18nProvider } from "@/i18n";
import Overview from "@/pages/overview";
import Production from "@/pages/production";
import Anomalies from "@/pages/anomalies";
import Carbon from "@/pages/carbon";
import Integrations from "@/pages/integrations";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/cadastro" component={Cadastro} />

      <Route path="/overview">
        <Layout><Overview /></Layout>
      </Route>
      <Route path="/production">
        <Layout><Production /></Layout>
      </Route>
      <Route path="/anomalies">
        <Layout><Anomalies /></Layout>
      </Route>
      <Route path="/carbon">
        <Layout><Carbon /></Layout>
      </Route>
      <Route path="/integrations">
        <Layout><Integrations /></Layout>
      </Route>
      <Route path="/dashboard">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/empresas">
        <Layout><Empresas /></Layout>
      </Route>
      <Route path="/upload-csv">
        <Layout><UploadCsv /></Layout>
      </Route>
      <Route path="/consumo">
        <Layout><Consumo /></Layout>
      </Route>
      <Route path="/diagnosticos">
        <Layout><Diagnosticos /></Layout>
      </Route>
      <Route path="/bess">
        <Layout><Bess /></Layout>
      </Route>
      <Route path="/dashboard-bess">
        <Layout><DashboardBess /></Layout>
      </Route>
      <Route path="/diagnosticos-bess">
        <Layout><DiagnosticosBess /></Layout>
      </Route>
      <Route path="/dashboard-integrado">
        <Layout><DashboardIntegrado /></Layout>
      </Route>
      <Route path="/setores">
        <Layout><Setores /></Layout>
      </Route>
      <Route path="/maquinas">
        <Layout><Maquinas /></Layout>
      </Route>
      <Route path="/contrato">
        <Layout><Contrato /></Layout>
      </Route>
      <Route path="/chat">
        <Layout><Chat /></Layout>
      </Route>
      <Route path="/aprovacoes">
        <Layout><Aprovacoes /></Layout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
      <TooltipProvider>
        <AuthProvider>
          <EmpresaProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </EmpresaProvider>
        </AuthProvider>
        <Toaster />
        <DemoBanner />
      </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;

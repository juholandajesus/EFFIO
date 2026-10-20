import { Link } from "wouter";
import { Zap, ArrowRight, ShieldCheck, BarChart3, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="px-6 py-4 flex justify-between items-center border-b">
        <div className="flex items-center gap-2 text-primary">
          <Zap className="h-8 w-8 fill-current" />
          <span className="font-bold text-2xl text-foreground tracking-tight">EFFIO</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/cadastro">Cadastre-se</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto py-20">
        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary/10 text-secondary mb-8">
          Inteligência Energética para o Mercado Livre
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          Assuma o controle da sua <span className="text-primary">energia</span>.
        </h1>
        
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
          A EFFIO transforma dados complexos de consumo horário em decisões estratégicas. O cockpit definitivo para gestores de energia no Brasil.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Button size="lg" className="h-14 px-8 text-lg" asChild>
            <Link href="/cadastro">
              Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg" asChild>
            <Link href="/login">Acessar Cockpit</Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 w-full text-left">
          <div className="p-6 rounded-2xl bg-card border shadow-sm">
            <Database className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Ingestão Simples</h3>
            <p className="text-muted-foreground">Faça upload dos seus dados CCEE em CSV e deixe a EFFIO estruturar milhares de registros em segundos.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border shadow-sm">
            <BarChart3 className="h-10 w-10 text-secondary mb-4" />
            <h3 className="text-xl font-bold mb-2">Dashboards Precisos</h3>
            <p className="text-muted-foreground">Visualize o consumo por submercado, tipo de operação e acompanhe sua série temporal diária.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border shadow-sm">
            <ShieldCheck className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2">Decisões Seguras</h3>
            <p className="text-muted-foreground">Identifique picos de custo, anomalias e oportunidades de otimização no seu perfil de carga.</p>
          </div>
        </div>
      </main>

      <footer className="border-t py-8 text-center text-muted-foreground">
        <p>© {new Date().getFullYear()} EFFIO Energy Intelligence. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

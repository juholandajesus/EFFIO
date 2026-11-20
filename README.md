# EFFIO — Frontend

Cockpit de inteligência energética (Mercado Livre de Energia + BESS).
React 19 + Vite 6 + Tailwind 4 + shadcn/ui + React Query + wouter.

Adaptado do projeto original no Replit para rodar sozinho: no **StackBlitz**, no seu computador ou em qualquer hospedagem estática (Vercel, Netlify...).

## Versão atual (Brasil)

- **Inglês e português:** botão EN/PT no topo. As telas novas usam `t()` (`src/i18n/en.ts` e `pt.ts`). As telas antigas são traduzidas pelo dicionário `src/i18n/legacy-en.ts`: para traduzir um texto novo de uma tela antiga, basta adicionar uma linha `"Texto em português": "English text"`.
- **Anomalias e Previsão** (`/anomalies`): detecta carga de base elevada, equipamento ligado sem produzir, pico de demanda e perda de eficiência, cada um com o custo anual em R$, e mostra a previsão de carga de 7 dias. Hoje roda com os dados simulados da Metalúrgica Horizonte (`src/industry/`).
- **Copiloto EFFIO** (botão flutuante): responde perguntas com os números da planta. Pode ser ligado a qualquer LLM via `VITE_COPILOT_URL` (veja `.env.example`).

A versão para indústria no Golfo (Emirados, Arábia Saudita, Omã), com Energia × Produção, Carbono e Integrações ERP, está guardada na branch `demo-global`.

## Rodando

```bash
npm install
npm run dev
```

No StackBlitz, a instalação e o `npm run dev` rodam sozinhos (arquivo `.stackblitzrc`).

## Dois modos

### Modo demo (padrão)
Sem nenhuma configuração, o app usa um **backend simulado no navegador** (`src/mock/`), com dados de exemplo:
3 empresas, 30 dias de consumo horário, setores, máquinas, contrato, unidades BESS, chat e colaboradores pendentes.

- Login: `demo@effio.com.br`
- Senha: `effio123`

Tudo que você cria, edita ou importa por CSV fica salvo **só no seu navegador** (localStorage).
O aviso "Modo demonstração" no canto da tela tem um botão para restaurar os dados de exemplo.

### Backend real
Crie um arquivo `.env` (veja `.env.example`) com a URL do servidor Express do EFFIO:

```
VITE_API_URL=https://seu-backend.com
```

Todas as chamadas `/api/...` passam a ir para `https://seu-backend.com/api/...` e o modo demo é desligado.
O backend precisa aceitar CORS do endereço do frontend (o servidor original já usa `cors()`).

## O que mudou em relação ao Replit

| Antes (Replit) | Agora |
|---|---|
| `package.json` com versões `catalog:` e `workspace:*` (só funcionavam no monorepo) | Versões reais do npm + `package-lock.json` |
| Pacote `@workspace/api-client-react` (pasta `lib/` que não veio no zip) | Recriado em `src/lib/api-client/` com os mesmos hooks e tipos |
| `vite.config.ts` exigia `PORT`, `BASE_PATH` e plugins do Replit | Configuração simples, sem variáveis obrigatórias |
| `tsconfig.json` dependia de `../../tsconfig.base.json` | Configuração completa e independente |
| Sem backend = app quebrado | Modo demo com backend simulado |

Novos arquivos:
- `src/lib/api-client/index.ts`: hooks do React Query (`useListEmpresas`, `useGetDashboard`...)
- `src/lib/api-base.ts`: decide se `/api` vai para o backend real ou para o modo demo
- `src/mock/seed.ts` e `src/mock/server.ts`: dados de exemplo e rotas simuladas (espelham o backend Express)
- `src/components/demo-banner.tsx`: aviso de modo demo

As páginas e componentes originais não foram alterados, exceto `main.tsx` (ativa o redirecionamento da API) e `App.tsx` (mostra o aviso de demo).

## Estrutura

```
src/
  pages/          telas (dashboard, empresas, bess, consumo, chat...)
  components/     layout, sidebar, seletor de empresa, ui/ (shadcn)
  context/        autenticação e empresa ativa
  hooks/          use-toast, use-mobile
  lib/            utils, api-client, api-base
  mock/           backend simulado do modo demo
public/           favicon, imagem de compartilhamento, robots.txt
```

## Formato do CSV (Upload CCEE)

Separador `;` ou `,`, com cabeçalho:

```
Data;Hora;ID_Empresa;NomeEmpresa;TipoOperacao;MontanteMWh;PrecoPLD_R$;Submercado
21/10/2026;10:00;1;Metalúrgica Horizonte Ltda;Consumo Fora Ponta;1,25;180,50;SE/CO
```

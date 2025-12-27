# My Sweet Home — V1

Projeto educacional para praticar arquitetura front-end leve e visual inspirada no estilo editorial do Westwing.

## 1) Visão geral do projeto
- **O que é**: um app web gamificado para organizar desejos, compras e reformas do lar.
- **Objetivo educacional**: exercitar HTML, CSS e JavaScript puros com foco em boas práticas, comentários explicativos e separação rígida de responsabilidades.

## 2) Conceito do produto
- Gamificação da wishlist e das reformas, com pontos baseados em peso das tarefas e fotos antes/depois.
- Progresso visível e motivacional, cards claros e muito espaço em branco para manter o ar premium.

## 3) Funcionalidades da V1
- Projetos (apenas Apartamento).
- Cômodos e subpartes (placeholder visual na aba Estrutura).
- Tarefas com status `backlog | doing | done`.
- Kanban responsivo (mock visual).
- Dashboard minimalista (mock de métricas).
- Planta da casa (layout estático simulando drag & resize futuros).

## 4) Arquitetura do projeto
- **index.html**: home com login fictício, lista/criação de projetos e CTA para o projeto exemplo.
- **project.html**: página do projeto com abas Estrutura, Kanban e Dashboard.
- **planner.html**: visual da planta com canvas estático e sidebar de cômodos.
- **assets/style.css**: design system (cores, tipografia, espaçamentos, componentes) e responsividade.
- **js/app.js**: navegação simples, gerenciamento mínimo de estado, helpers de UI (tabs, modal, toast).
- **js/db.js**: stubs para Supabase (login, fetch e persistência de tarefas/projetos).
- **js/project.js**: stubs das regras de negócio (progresso, pontos, atrasos, tarefas mock).

> Por que essa separação? Para isolar responsabilidades e facilitar a evolução incremental (Supabase e regras reais entram depois sem mexer no layout base).

## 5) Tecnologias utilizadas
- HTML5, CSS3, JavaScript puro.
- Google Fonts (Inter, Playfair Display).
- GitHub Pages para hospedagem estática (planejado).
- Supabase para backend (planejado, não implementado nesta etapa).

## 6) Como rodar o projeto localmente
1. Abra o repositório no VS Code.
2. Instale a extensão **Live Server**.
3. Clique em **Go Live** na barra de status ou abra o `index.html` com live reload.
4. Navegue pelos arquivos `project.html` e `planner.html` usando a navegação interna.

## 7) Roadmap
- **V1 (atual)**: Apartamento, Kanban mock, dashboard mock, planta estática.
- **V2**: Casa e Sítio, CRUD real de projetos/áreas/tarefas via Supabase, drag & resize na planta.
- **V3 (Dream House)**: Pontuação acumulada, personalização avançada, experiências ricas com fotos e progresso.

## 8) Observações finais
- Projeto pessoal e educacional; o código está intencionalmente comentado para servir como guia.
- Nenhuma dependência além de Google Fonts; arquitetura pronta para Supabase nas próximas etapas.
- Layout mobile-first com inspiração editorial (Westwing) e design system documentado em CSS.

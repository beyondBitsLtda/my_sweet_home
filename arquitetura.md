# 📘 My Sweet Home — Escopo do Projeto (V1)

---

## 1) 🎯 Objetivo do Projeto

Criar um **app web gamificado** para organizar desejos, compras e reformas do lar, transformando tudo em um **projeto visual, motivador e mensurável**.

### Funcionalidades-chave
- Projetos por ambiente (ex: *Meu AP 2026*)
- Estrutura hierárquica: **Casa → Cômodos → Subpartes → Cantos**
- Tarefas com prazo, custo, peso e fotos (antes/depois)
- Sistema de **pontuação + progresso**
- Visualizações:
  - Kanban  
  - Lista  
  - Planta interativa  
  - Dashboard de saúde
- Backend: **Supabase (Postgres + API)**
- Frontend: **GitHub Pages**

---

## 2) 🚀 Releases

### V1 — Apartamento (ativo)
- Apenas tipo **Apartamento**
- Casa e Sítio aparecem como *“Disponível em breve”*
- Sem Dream House (estrutura já preparada)

### V2 — Casa & Sítio
- Liberação dos outros tipos de projeto

### V3 — Dream House
- Usa pontuação acumulada  
- Estrutura já prevista desde a V1  

---

## 3) 🧠 Regras de Negócio (Essência)

### 3.1 Tipos de Projeto

#### Projeto Macro (Apartamento – V1)
- Mínimo **2 cômodos**
- Cada cômodo pode ter:
  - até **4 subpartes**
  - cada subparte até **4 cantos**

#### Projeto Micro (V1)
- Escolhe **1 área**
- Até **4 subpartes**
- Cantos são opcionais

---

### 3.2 Tarefas

Campos obrigatórios:

- título  
- descrição  
- tipo: `compra | reforma`  
- status: `backlog | doing | done`  
- prazo (data)  
- custo esperado  
- custo real  
- peso: `leve | médio | pesado`  
- foto **antes** *(obrigatória para concluir)*  
- foto **depois** *(obrigatória para concluir)*  

---

### 3.3 Regras de Validação

- **Atraso:** hoje > due_date e status ≠ `done`
- **Fora do prazo do projeto:** due_date > project_end_date
- **Orçamento estourado:**
  - por tarefa: `custo_real > custo_esperado`
  - por projeto: `soma_real > budget_projeto`

---

## 4) 📊 Cálculo de Progresso e Pontos

### Pesos

| Tipo   | Peso |
|--------|------|
| Leve   | 1    |
| Médio  | 2    |
| Pesado | 3    |

### Fórmula de progresso
- `W = soma dos pesos`
- `progresso = Σ (peso_tarefa / W) * 100`

*(considera apenas tarefas concluídas)*

### Pontuação (Gamificação)

- Base: `50 × peso`
- Foto antes: `+10 × peso`
- Foto depois: `+20 × peso`

**Total máximo:**  
`80 × peso`

Pontuação acumulada:

---

## 5) 🧩 Visões do Produto (V1)

### 5.1 Kanban
- Colunas: **Backlog / Fazendo / Feito**
- Filtros: cômodo, subparte, canto
- Cards exibem:
  - peso
  - custo
  - prazo
  - status das fotos

---

### 5.2 Lista (Hierárquica)

Projeto
└─ Cômodo
└─ Subparte
└─ Canto
└─ Tarefas


---

### 5.3 Dashboard — Saúde do Projeto

Indicadores:
- % de progresso
- Pontos ganhos
- Tarefas atrasadas
- Tarefas fora do prazo do projeto
- Orçado × Real
- Pendências de fotos

---

### 5.4 Planta da Casa (V1)

- Container principal (planta)
- Cômodos arrastáveis e redimensionáveis
- Formato: retângulo
- Clique → abre progresso e tarefas
- Hover/touch → mostra foto

Layout salvo como:

x, y, w, h


---

## 6) 🧱 Arquitetura do Código

### HTML (máx. 3)
- `index.html` → lista de projetos  
- `project.html` → kanban / lista / dashboard  
- `planner.html` → planta da casa  

### CSS
- `assets/style.css`

### JavaScript (máx. 3)
- `js/app.js`  
  - navegação  
  - estado global  
  - helpers de UI  

- `js/db.js`  
  - Supabase  
  - queries  
  - validações  

- `js/project.js`  
  - regras de negócio  
  - progresso  
  - renderizações  

**Regra de ouro:** funções pequenas + comentários explicando o *porquê*.

---

## 7) 🗄️ Modelo de Dados (Supabase)

### users_profile
- id (uuid)
- display_name
- total_points_lifetime

---

## 8) 🗄️ SQL — Subáreas, Cantos e tarefas com escopo

Use no Supabase (ou psql) para criar as novas entidades mantendo RLS compatível com projects/areas.

```sql
-- Tabela de subáreas
create table if not exists public.sub_areas (
  id uuid primary key default uuid_generate_v4(),
  area_id uuid not null references public.areas(id) on delete cascade,
  name text not null,
  description text,
  photo_cover_url text,
  created_at timestamptz default now()
);

alter table public.sub_areas enable row level security;

create policy "Sub areas visíveis apenas para dono do projeto"
on public.sub_areas for select
using (
  exists (
    select 1
    from public.projects p
    join public.areas a on a.project_id = p.id
    where a.id = sub_areas.area_id
      and p.user_id = auth.uid()
  )
);

create policy "Sub areas insert apenas dono"
on public.sub_areas for insert
with check (
  exists (
    select 1
    from public.projects p
    join public.areas a on a.project_id = p.id
    where a.id = sub_areas.area_id
      and p.user_id = auth.uid()
  )
);

create policy "Sub areas update apenas dono"
on public.sub_areas for update
using (
  exists (
    select 1
    from public.projects p
    join public.areas a on a.project_id = p.id
    where a.id = sub_areas.area_id
      and p.user_id = auth.uid()
  )
);

create policy "Sub areas delete apenas dono"
on public.sub_areas for delete
using (
  exists (
    select 1
    from public.projects p
    join public.areas a on a.project_id = p.id
    where a.id = sub_areas.area_id
      and p.user_id = auth.uid()
  )
);

-- Tabela de cantos
create table if not exists public.corners (
  id uuid primary key default uuid_generate_v4(),
  sub_area_id uuid not null references public.sub_areas(id) on delete cascade,
  name text not null,
  description text,
  photo_cover_url text,
  created_at timestamptz default now()
);

alter table public.corners enable row level security;

create policy "Cantos visíveis apenas para dono do projeto"
on public.corners for select
using (
  exists (
    select 1
    from public.projects p
    join public.areas a on a.project_id = p.id
    join public.sub_areas sa on sa.area_id = a.id
    where sa.id = corners.sub_area_id
      and p.user_id = auth.uid()
  )
);

create policy "Cantos insert apenas dono"
on public.corners for insert
with check (
  exists (
    select 1
    from public.projects p
    join public.areas a on a.project_id = p.id
    join public.sub_areas sa on sa.area_id = a.id
    where sa.id = corners.sub_area_id
      and p.user_id = auth.uid()
  )
);

create policy "Cantos update apenas dono"
on public.corners for update
using (
  exists (
    select 1
    from public.projects p
    join public.areas a on a.project_id = p.id
    join public.sub_areas sa on sa.area_id = a.id
    where sa.id = corners.sub_area_id
      and p.user_id = auth.uid()
  )
);

create policy "Cantos delete apenas dono"
on public.corners for delete
using (
  exists (
    select 1
    from public.projects p
    join public.areas a on a.project_id = p.id
    join public.sub_areas sa on sa.area_id = a.id
    where sa.id = corners.sub_area_id
      and p.user_id = auth.uid()
  )
);

-- Ajuste de tarefas para suportar múltiplos níveis de escopo
alter table public.tasks
  add column if not exists scope_type text check (scope_type in ('area','sub_area','corner')) default 'area',
  add column if not exists scope_id uuid;

-- Compatibilidade: tarefas antigas recebem scope_id = area_id.
update public.tasks
set scope_type = coalesce(scope_type, 'area'),
    scope_id = coalesce(scope_id, area_id)
where scope_id is null;

create index if not exists tasks_scope_idx on public.tasks (scope_type, scope_id);

-- Opcional: manter area_id atualizado ao criar tarefas de subárea/canto (útil para dashboards legados)
-- update public.tasks t set area_id = sa.area_id
-- from public.sub_areas sa where t.scope_type = 'sub_area' and t.scope_id = sa.id;
-- update public.tasks t set area_id = sa.area_id
-- from public.corners c join public.sub_areas sa on sa.id = c.sub_area_id
-- where t.scope_type = 'corner' and t.scope_id = c.id;
```

### projects
- id  
- user_id  
- name  
- home_type (`apartment | house | farm`)  
- mode (`macro | micro`)  
- start_date  
- end_date  
- budget_expected  
- budget_real  

### areas
- id  
- project_id  
- name  
- kind  
- photo_cover_url  

### parts
- id  
- area_id  
- name  
- photo_cover_url  

### corners
- id  
- part_id  
- name  
- photo_cover_url  

### tasks
- id  
- project_id  
- scope_type (`area | part | corner`)  
- scope_id  
- title  
- description  
- task_type  
- status  
- due_date  
- cost_expected  
- cost_real  
- weight  
- photo_before_url  
- photo_after_url  
- done_at  

### layout_items
- id  
- project_id  
- scope_type  
- scope_id  
- x  
- y  
- w  
- h  
- shape (`rect`)  
- updated_at  

---

## 8) 🔐 Regras Não Funcionais

### Segurança
- RLS ativo
- Cada usuário vê apenas seus dados
- Nenhuma chave sensível no frontend

### Privacidade
- Fotos em bucket privado
- URLs assinadas quando necessário

### Performance
- Carregamento por projeto
- Cache simples em memória
- Paginação se necessário

### Usabilidade
- Mobile-first
- Fluxo claro: criar → organizar → concluir
- Feedback visual constante

### Confiabilidade
- Validações fortes
- Mensagens de erro amigáveis

### Portabilidade
- Funciona localmente e no GitHub Pages

### Acessibilidade
- Contraste adequado
- Labels visíveis
- Navegação por teclado

---

## 9) 🔁 Plano Incremental (para o Codex)

### Etapa 0 — Base
- Estrutura HTML/CSS/JS
- Navegação funcional

### Etapa 1 — Supabase + Auth
- Login simples
- CRUD de projetos

### Etapa 2 — Áreas
- CRUD de cômodos
- Regra de mínimo (2)

### Etapa 3 — Tarefas + Kanban
- Drag ou botões
- Bloqueio sem fotos

### Etapa 4 — Progresso + Pontos
- Cálculos
- Dashboard

### Etapa 5 — Subpartes e Cantos
- Estrutura completa

### Etapa 6 — Fotos
- Upload
- Preview
- Mobile camera

### Etapa 7 — Planta
- Drag & resize
- Salvar layout

### Etapa 8 — Polimento Final
- Mensagens “em breve”
- UX refinado
- Checklist final

---

## 10) 🧩 Ferramentas Simples

### UI
- JS puro (recomendado)
- Opcional: Alpine.js ou Petite-Vue

### Drag & Resize
- interact.js (leve e estável)

---

## 11) 🧠 Gestão (Trello)

### Colunas
- Backlog  
- Próxima Semana  
- Hoje (máx. 3)  
- Em Progresso  
- Em Review  
- Done  
- Bugs  

### Labels
- UI/UX  
- Banco  
- Regras  
- Fotos  
- Planta  
- Refactor  
- Bug  

**Regra de ouro:** nunca mais que 3 tarefas no “Hoje”.

---

✨ **Resultado final:**  
Um app funcional, organizado, escalável e com propósito — crescendo junto com o lar 💛

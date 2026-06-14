# eLiga Cartas — Fase 0: Vite + React

Este pacote contém o projeto convertido de um único `index.html` (React via Babel/CDN) para uma
aplicação **Vite + React** normal, com `npm install` / `npm run build`.

## O que mudou

- `index.html` agora é só o "casco" HTML (meta tags, PWA, fontes) — ~25 linhas.
- Todo o código da app está em `src/App.jsx` (mesmo conteúdo, mesma lógica, mesmas funcionalidades).
- `src/main.jsx` monta o `<App />` no `#root` (substitui o `ReactDOM.createRoot(...).render(React.createElement(App))`).
- `src/index.css` tem os estilos globais que antes estavam no `<head><style>`.
- `public/manifest.webmanifest` substitui o manifest que era gerado em runtime via Blob.
- `package.json`, `vite.config.js`, `.gitignore`, `.env.example` são novos.
- **Nada de funcionalidade foi alterado** — é a mesma app, agora com build.

## Passos para aplicar no teu repositório local

1. **Faz backup/commit do estado atual** do teu clone local (por segurança).
2. **Copia todos os ficheiros deste pacote** para a raiz do teu projeto local
   (`Eliga-cartas/`), substituindo o `index.html` antigo.
   - Resultado esperado na raiz: `index.html`, `package.json`, `vite.config.js`,
     `.gitignore`, `.env.example`, pasta `src/` (com `main.jsx`, `App.jsx`, `index.css`),
     pasta `public/` (com `manifest.webmanifest`).
3. **Instala as dependências**:
   ```bash
   npm install
   ```
4. **Testa localmente**:
   ```bash
   npm run dev
   ```
   Abre o URL que aparecer (normalmente `http://localhost:5173`). Confirma que a app
   arranca, o login local funciona (admin/admin), e as tabs todas abrem.
5. **Commit e push**:
   ```bash
   git add -A
   git commit -m "Fase 0: converter para Vite + React"
   git push
   ```

## Configurar a Vercel (importante)

Como o projeto deixou de ser HTML estático puro, a Vercel precisa de saber que agora há um
build a correr:

1. No dashboard da Vercel → o projeto `eligaportugal` → **Settings → General**.
2. Em **Framework Preset**, muda para **Vite** (a Vercel pode detetar automaticamente
   depois do `package.json` aparecer no repo).
3. Confirma:
   - **Build Command**: `npm run build` (ou `vite build`)
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
4. Faz um redeploy (acontece automaticamente após o `git push`).

Se a Vercel já tinha um "Output Directory" vazio/raiz configurado para o modo estático
anterior, é importante mudares para `dist`, senão o deploy falha ou serve ficheiros errados.

## Próximos passos (Fase 1+)

- `.env.example` já tem os nomes das variáveis que vamos usar para o Supabase
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Quando tiveres o projeto Supabase
  criado, cria um `.env` local (não comitado) com esses valores e adiciona as mesmas
  variáveis nos **Environment Variables** da Vercel.
- Depois disso, instalamos o `@supabase/supabase-js` (já está no `package.json`) e
  substituímos o `store` local (localStorage) pela Auth + tabelas do Supabase.

---

# FASE 1 — Supabase Auth (email + palavra-passe)

## O que mudou

- Novo ficheiro `src/lib/supabaseClient.js` — cria o cliente Supabase a partir das
  variáveis de ambiente `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `AuthScreen` (ecrã de login/registo) já não usa a "conta local" com palavra-passe
  em hash — usa `supabase.auth.signUp` / `supabase.auth.signInWithPassword`.
  - **Criar conta** agora pede: nome de jogador, email, palavra-passe (mín. 6 caracteres).
  - **Iniciar sessão** agora pede: email + palavra-passe.
  - O "nome de jogador" fica guardado em `user_metadata.username` na conta Supabase —
    é o que continua a identificar a coleção, objetivos, etc. (chaves `eliga-tcg-col-<username>`
    no localStorage, exatamente como antes).
- A app agora arranca verificando a sessão Supabase (`supabase.auth.getSession()`), e
  fica a ouvir alterações (`onAuthStateChange`) — login/logout refletem-se automaticamente.
- `logout` agora chama `supabase.auth.signOut()`.
- Removidos `pHash` e a conta seed `admin/admin` — deixaram de fazer sentido com Auth real.

⚠️ **Importante sobre a conta "admin"**: as ferramentas de admin (Pack Admin, regenerar
Escolhas, limpar previsões) continuam a verificar `username === "admin"` (isto só será
substituído na Fase 3, com roles/Edge Functions a sério). Para teres acesso a essas
ferramentas, **regista uma conta com o nome de jogador `admin`** (qualquer email/password
tua) através do novo formulário "Criar conta".

## Como configurar (passo a passo)

### 1. Obter as chaves do Supabase
No [supabase.com](https://supabase.com) → o teu projeto → **Project Settings → API**.
Copia:
- **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
- **anon public** key (uma string longa)

### 2. Configurar localmente
Na raiz do projeto, copia `.env.example` para `.env` e preenche:
```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=ey....
```
O ficheiro `.env` **não é comitado** (já está no `.gitignore`).

### 3. Configurar na Vercel
No dashboard da Vercel → o projeto → **Settings → Environment Variables** → adiciona:
- `VITE_SUPABASE_URL` = (a mesma Project URL)
- `VITE_SUPABASE_ANON_KEY` = (a mesma anon key)

Aplica a **Production**, **Preview** e **Development**. Depois faz um redeploy (ou faz
um novo `git push` — o próximo passo já vai gerar um).

### 4. (Opcional, mas recomendado para testes) Confirmação de email
No Supabase → **Authentication → Providers → Email**, o "Confirm email" vem ligado por
defeito: depois de criar conta, o utilizador recebe um email e só pode entrar depois de
confirmar (a app mostra essa mensagem e volta para "Iniciar sessão").

- Para testares mais rápido agora (sem esperar por emails), podes desligar
  temporariamente o "Confirm email" — assim a conta fica logo com sessão ativa no
  registo. Podes voltar a ligar mais tarde (recomendado em produção, com jogadores reais).

### 5. Instalar, testar localmente
```
npm install
npm run dev
```
- Cria uma conta nova (nome de jogador, email, password).
- Confirma que entras na app e a coleção/loja funcionam como antes.
- Faz logout e login novamente para confirmar que a sessão persiste.
- **Cria também uma conta com nome de jogador `admin`** para teres acesso às
  ferramentas de admin (Pack Admin na Loja, "↻ Regenerar" em Escolhas, "Limpar" em
  Previsões).

### 6. Commit e push
```
git add -A
git commit -m "Fase 1: Supabase Auth (email+password)"
git push
```

## Próximas fases

- **Fase 2**: tabelas Supabase (`profiles`, `collection`, `lineup`, `predictions`,
  `history`) substituem o localStorage, com RLS por utilizador — a coleção passa a
  estar associada à conta na cloud, não só a este browser/dispositivo.
- **Fase 3**: Edge Functions para ações sensíveis (abrir pack, trocar, simular jornada,
  resgatar código) — remove a possibilidade de batota no cliente e o "admin" hardcoded.
- **Fase 4**: ranking real, painel admin a sério, Twitch OAuth.

---

# FASE 2 — Tabela `profiles` no Supabase (substitui o localStorage)

## O que mudou

- O progresso de cada jogador (coleção, meta/objetivos, equipa+capitão, histórico de
  packs, códigos usados, Escolhas, histórico de jornadas, vitrine, previsões, som,
  onboarding) deixou de viver só no `localStorage` do browser — passa a ficar guardado
  numa tabela `profiles` no Supabase, numa coluna `state` (jsonb), associada à conta
  (RLS: cada utilizador só vê/edita a sua própria linha).
- O `username` (nome de jogador) passa a ter como fonte de verdade a tabela `profiles`
  (coluna `username`, com restrição de unicidade), criada automaticamente no registo
  através de um trigger na tabela `auth.users`.
- **Migração automática**: na primeira vez que uma conta entra depois desta atualização,
  se ainda não existir progresso no Supabase, a app vai buscar o que estava guardado em
  `localStorage` (das Fases 0/1, ex.: as contas `test`, `test1`, `admin` que já criaste)
  e envia-o para o Supabase. A partir daí, esse browser e qualquer outro dispositivo onde
  fizeres login com a mesma conta veem a mesma coleção.
- O ranking (`rank-global`) e o contador de "regenerar Escolhas" (admin) continuam por
  agora em localStorage — são dados partilhados/simulados que só ficam "a sério" na
  Fase 4.

## Como aplicar

### 1. Correr o SQL no Supabase
- Dashboard do Supabase → **SQL Editor** → **New query**.
- Copia e cola **todo** o conteúdo do ficheiro `supabase/fase2_profiles.sql` (incluído
  neste pacote) e clica **Run**.
- Isto cria a tabela `profiles`, ativa RLS com políticas "só a tua linha", cria um
  trigger que gera automaticamente um perfil para cada conta nova, e faz *backfill*
  (cria perfis) para as contas que já criaste na Fase 1 (`test`, `test1`, `admin`, etc.).
- É seguro correr este script mais do que uma vez.

### 2. Copiar o `src/App.jsx` atualizado
Substitui o `src/App.jsx` pelo deste pacote (mesma pasta `src/` do projeto).

### 3. Testar localmente
```
npm run dev
```
- Faz login com `test` (ou `test1`/`admin`) — a coleção e o resto do progresso devem
  aparecer exatamente como estavam.
- Abre o **Supabase → Table Editor → profiles** e confirma que existe uma linha para
  essa conta, com a coluna `state` preenchida (JSON com `collection`, `meta`, etc.).
- Faz alguma ação (abre um pack, muda a equipa) e confirma que a coluna `state` na
  tabela é atualizada (pode demorar ~1 segundo, é guardado com um pequeno atraso).
- (Opcional) Testa abrir a app noutro browser/dispositivo com a mesma conta — a coleção
  deve aparecer igual.

### 4. Commit e push
```
git add -A
git commit -m "Fase 2: progresso do jogador em tabela Supabase (profiles)"
git push
```
Depois confirma em produção (`eligaportugal.vercel.app`, janela anónima) com a conta
`test`/`test1`/`admin`.

## Próximas fases (revisão)

- **Fase 3**: Edge Functions para ações sensíveis (abrir pack, trocar, simular jornada,
  resgatar código) — remove a possibilidade de batota no cliente e o "admin" hardcoded
  (passa a ser baseado num campo `role`/`is_admin` em `profiles`, em vez do nome
  de jogador).
- **Fase 4**: ranking real (tabela partilhada), painel admin a sério, Twitch OAuth.

---

# FASE 3a — Admin baseado num campo na conta (`is_admin`)

## O que mudou

- A tabela `profiles` ganha uma coluna `is_admin` (verdadeiro/falso).
- As ferramentas de admin (Pack Admin na Loja, "↻ Regenerar" em Escolhas, "Limpar" em
  Previsões) deixam de verificar `username === "admin"` e passam a verificar
  `isAdmin`, que vem dessa coluna.
- Um trigger na base de dados impede que um utilizador normal se dê a si próprio
  `is_admin = true` através de um pedido direto ao Supabase (ex.: pela consola do
  browser) — só pode ser definido por nós, no SQL Editor.

⚠️ Isto **não substitui** a Parte B (Edge Functions / anti-cheat) — só resolve o
"admin hardcoded". A lógica do jogo continua a correr no browser de cada jogador.

## Como aplicar

### 1. Correr o SQL no Supabase
- Dashboard do Supabase → **SQL Editor** → **New query**.
- Copia e cola **todo** o conteúdo do ficheiro `supabase/fase3a_admin_role.sql`
  (incluído neste pacote) e clica **Run**.
- No final do script, há um `update ... where username = 'admin'` — se a tua conta de
  admin tiver outro nome de jogador, edita essa linha antes de correr (substitui
  `'admin'` pelo nome correto).
- O `select` final mostra a lista de contas e o respetivo `is_admin` — confirma que a
  tua conta aparece com `true`.

### 2. Copiar o `src/App.jsx` atualizado
Substitui o `src/App.jsx` pelo deste pacote.

### 3. Testar localmente
```
npm run dev
```
- Entra com a conta marcada como `is_admin = true` → deve continuar a ver o Pack
  Admin, "↻ Regenerar" e "Limpar previsões", exatamente como antes.
- Entra com outra conta (sem `is_admin`) → essas opções não devem aparecer.

### 4. Commit e push
```
git add -A
git commit -m "Fase 3a: admin baseado em campo is_admin"
git push
```
Confirma em produção com as duas contas.

## Próximas fases

- **Fase 3b** (opcional, mais avançada): Edge Functions para anti-cheat nas ações
  que dão recompensas (abrir pack, trocar, resgatar código, objetivos, jornadas,
  previsões) — requer instalar a Supabase CLI.
- **Fase 4**: ranking real (tabela partilhada), painel admin a sério, Twitch OAuth.


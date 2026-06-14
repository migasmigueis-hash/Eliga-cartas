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

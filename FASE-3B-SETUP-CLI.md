# Fase 3b — Setup: Supabase CLI (Windows)

Isto faz-se **uma vez só** e serve para todas as sub-fases (3b.1, 3b.2, ...).

## 1. Instalar o Scoop (gestor de pacotes para Windows)

A Supabase já não suporta instalação via `npm install -g supabase` — no Windows,
o caminho recomendado é o **Scoop**.

No PowerShell (não precisa de ser como administrador):
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
(confirma com `S`/`Y` se perguntar — provavelmente já tens isto configurado de
sessões anteriores).

Depois instala o Scoop:
```powershell
irm get.scoop.sh | iex
```

Confirma que funcionou:
```powershell
scoop --version
```

## 2. Instalar a Supabase CLI

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Confirma:
```powershell
supabase --version
```
Deve aparecer um número de versão (ex.: `2.x.x`).

> Se `supabase` não for reconhecido depois de instalar, fecha e abre uma janela
> nova do PowerShell (tal como aconteceu com o `npm` no início do projeto).

## 3. Login

```powershell
supabase login
```
Isto abre o browser para autorizares a CLI a aceder à tua conta Supabase. Aceita.

## 4. Ligar a CLI ao projeto `eLiga Cartas`

Dentro da pasta do projeto (`cd "C:\Users\BombNuker\Documents\eliga cartas"`):

```powershell
supabase init
```
Isto cria uma pasta `supabase/` no projeto (se ainda não existir — já temos uma
com `functions/` e ficheiros `.sql`, por isso esta pasta vai juntar-se ao que já
lá está).

Depois liga ao projeto remoto:
```powershell
supabase link --project-ref <PROJECT_REF>
```

Onde encontrar o `<PROJECT_REF>`:
- É o identificador no URL do projeto: `https://<PROJECT_REF>.supabase.co`
  (o mesmo que usaste em `VITE_SUPABASE_URL`).
- Ou em Supabase → **Settings → General** → "Reference ID".

Pode pedir a password da base de dados (Settings → Database → "Database
password" — se não souberes, há um botão para gerar uma nova, mas só precisas
disto para o `link`, não para o dia-a-dia das Edge Functions).

## 5. Confirmar que está tudo ligado

```powershell
supabase projects list
```
Deve aparecer o projeto `eLiga Cartas` marcado como o atual (linked).

---

✅ Setup feito. A partir daqui, para cada sub-fase (3b.1, 3b.2, ...) só precisas de:

```powershell
supabase functions deploy <nome-da-funcao>
```

Se aparecer algo sobre Docker não estar a correr, podes forçar o deploy via API
(sem Docker):
```powershell
supabase functions deploy <nome-da-funcao> --use-api
```

## Variáveis de ambiente das Edge Functions

As Edge Functions têm automaticamente acesso a `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DB_URL` — não
precisas de as configurar manualmente. Se alguma função der erro a dizer que uma
destas variáveis está em falta (raro), corre:

```powershell
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<a tua service_role key>
```

(a `service_role key` está em Supabase → Settings → API Keys → "Secret keys" —
a mesma que NUNCA deve ir para o `.env` do frontend).

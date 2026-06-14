import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Em desenvolvimento isto ajuda a perceber rapidamente um .env em falta.
  // eslint-disable-next-line no-console
  console.error(
    'Supabase: faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Cria um ficheiro .env (ver .env.example) com os valores do teu projeto Supabase.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
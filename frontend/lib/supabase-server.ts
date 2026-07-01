import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS
// ONLY use in API routes (server-side), never in client components
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

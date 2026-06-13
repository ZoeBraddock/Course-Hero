import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/shopify/settings?shop=xyz.myshopify.com
// Returns whether this shop is connected, and when it last synced
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'Missing shop param' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('shopify_shops')
    .select('shop_domain, last_synced_at')
    .eq('shop_domain', shop)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) return NextResponse.json({ connected: false })

  return NextResponse.json({ connected: true, last_synced_at: data.last_synced_at })
}
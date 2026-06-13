import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'Missing shop param' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('shopify_shops')
    .select('shop_domain, tariff_rate, base_cost, bands, dhl_flat_rate, dhl_note, last_synced_at')
    .eq('shop_domain', shop)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({ connected: true, settings: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { shop, tariff_rate, base_cost, bands, dhl_flat_rate, dhl_note } = body

  if (!shop) return NextResponse.json({ error: 'Missing shop' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('shopify_shops')
    .update({ tariff_rate, base_cost, bands, dhl_flat_rate, dhl_note })
    .eq('shop_domain', shop)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// GET /api/shopify/options?shop=xyz.myshopify.com
// Returns all shipping options for a shop, ordered by sort_order
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'Missing shop param' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('shipping_options')
    .select('*')
    .eq('shop_domain', shop)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ options: data })
}

// POST /api/shopify/options
// Body: { shop, type: 'tariff' | 'flat', name, ...type-specific fields }
// Creates a new shipping option
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { shop, type, name } = body

  if (!shop || !type || !name) {
    return NextResponse.json({ error: 'Missing shop, type or name' }, { status: 400 })
  }
  if (type !== 'tariff' && type !== 'flat') {
    return NextResponse.json({ error: 'type must be "tariff" or "flat"' }, { status: 400 })
  }

  const insertData: Record<string, unknown> = {
    shop_domain: shop,
    type,
    name,
    zone_id: body.zone_id ?? null,
    zone_name: body.zone_name ?? null,
    profile_id: body.profile_id ?? null,
    location_group_id: body.location_group_id ?? null,
  }

  if (type === 'tariff') {
    insertData.tariff_rate = body.tariff_rate ?? 0.19
    insertData.base_cost = body.base_cost ?? 0
    insertData.bands = body.bands ?? []
  } else {
    insertData.flat_rate = body.flat_rate ?? 0
    insertData.note = body.note ?? ''
  }

  const { data, error } = await supabaseAdmin
    .from('shipping_options')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ option: data })
}

// PUT /api/shopify/options
// Body: { id, ...fields to update }
// Updates an existing shipping option
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('shipping_options')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ option: data })
}

// DELETE /api/shopify/options?id=xxx
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('shipping_options')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
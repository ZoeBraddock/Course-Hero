import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { decrypt } from '@/lib/crypto'

// GET /api/shopify/zones?shop=xyz.myshopify.com
// Returns the shop's shipping zones (id + name) across all delivery profiles
export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'Missing shop param' }, { status: 400 })

  const { data: shopRow, error: shopError } = await supabaseAdmin
    .from('shopify_shops')
    .select('access_token')
    .eq('shop_domain', shop)
    .maybeSingle()

  if (shopError) return NextResponse.json({ error: shopError.message }, { status: 500 })
  if (!shopRow) return NextResponse.json({ error: 'Shop not connected' }, { status: 404 })

  const accessToken = decrypt(shopRow.access_token)

  const query = `
    query {
      deliveryProfiles(first: 10) {
        edges {
          node {
            id
            name
            profileLocationGroups {
              locationGroupZones(first: 25) {
                edges {
                  node {
                    zone {
                      id
                      name
                      countries { code { countryCode } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `

  const res = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query }),
  })

  const json = await res.json()

  if (json.errors) {
    return NextResponse.json({ error: 'Shopify API error', details: json.errors }, { status: 500 })
  }

  const zones: { id: string; name: string; profileId: string; profileName: string; isUS: boolean }[] = []

  for (const profileEdge of json.data?.deliveryProfiles?.edges ?? []) {
    const profile = profileEdge.node
    for (const lg of profile.profileLocationGroups ?? []) {
      for (const zoneEdge of lg.locationGroupZones?.edges ?? []) {
        const zone = zoneEdge.node.zone
        const countryCodes = (zone.countries ?? []).map((c: { code: { countryCode: string } }) => c.code.countryCode)
        zones.push({
          id: zone.id,
          name: zone.name,
          profileId: profile.id,
          profileName: profile.name,
          isUS: countryCodes.includes('US'),
        })
      }
    }
  }

  return NextResponse.json({ zones })
}
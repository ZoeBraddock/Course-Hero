import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { decrypt } from '@/lib/crypto'

type Band = { min: number; max: number | null; reference: number }

type ShippingOption = {
  id: string
  type: 'tariff' | 'flat'
  name: string
  zone_id: string | null
  profile_id: string | null
  location_group_id: string | null
  tariff_rate: number | null
  base_cost: number | null
  bands: Band[] | null
  flat_rate: number | null
  note: string | null
  shopify_method_definition_ids: string[] | null
}

const API_VERSION = '2025-10'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const shop = body.shop
  if (!shop) return NextResponse.json({ error: 'Missing shop' }, { status: 400 })

  // Get token
  const { data: shopRow, error: shopError } = await supabaseAdmin
    .from('shopify_shops')
    .select('access_token')
    .eq('shop_domain', shop)
    .maybeSingle()

  if (shopError) return NextResponse.json({ error: shopError.message }, { status: 500 })
  if (!shopRow) return NextResponse.json({ error: 'Shop not connected' }, { status: 404 })

  const accessToken = decrypt(shopRow.access_token)

  // Get all options
  const { data: options, error: optionsError } = await supabaseAdmin
    .from('shipping_options')
    .select('*')
    .eq('shop_domain', shop)

  if (optionsError) return NextResponse.json({ error: optionsError.message }, { status: 500 })
  if (!options || options.length === 0) {
    return NextResponse.json({ error: 'No shipping options configured' }, { status: 400 })
  }

  // Sanity check: every option needs a zone assigned
  const missingZone = options.find((o) => !o.zone_id || !o.profile_id || !o.location_group_id)
  if (missingZone) {
    return NextResponse.json(
      { error: `"${missingZone.name}" has no shipping zone selected` },
      { status: 400 }
    )
  }

  // Group options by profile (mutation is per-profile)
  const byProfile = new Map<string, ShippingOption[]>()
  for (const opt of options as ShippingOption[]) {
    const key = opt.profile_id!
    if (!byProfile.has(key)) byProfile.set(key, [])
    byProfile.get(key)!.push(opt)
  }

  const results: Record<string, unknown>[] = []

  for (const [profileId, profileOptions] of byProfile.entries()) {
    // Group by location group + zone within this profile
    const byZone = new Map<string, ShippingOption[]>()
    for (const opt of profileOptions) {
      const key = `${opt.location_group_id}::${opt.zone_id}`
      if (!byZone.has(key)) byZone.set(key, [])
      byZone.get(key)!.push(opt)
    }

    const zonesToUpdate = []

    for (const [key, zoneOptions] of byZone.entries()) {
      const [locationGroupId, zoneId] = key.split('::')

      // Collect existing method definition ids to remove
      const methodDefinitionsToDelete: string[] = []
      for (const opt of zoneOptions) {
        if (opt.shopify_method_definition_ids) {
          methodDefinitionsToDelete.push(...opt.shopify_method_definition_ids)
        }
      }

      // Build new method definitions
      const methodDefinitionsToCreate: Record<string, unknown>[] = []

      for (const opt of zoneOptions) {
        if (opt.type === 'tariff') {
          const bands = opt.bands ?? []
          for (const band of bands) {
            const rate = Math.ceil((opt.base_cost ?? 0) + (opt.tariff_rate ?? 0) * band.reference)
            const maxLabel = band.max !== null ? `-${band.max}` : '+'
            const priceConditions: Record<string, unknown>[] = [
              {
                criteria: { amount: band.min.toFixed(2), currencyCode: 'USD' },
                operator: 'GREATER_THAN_OR_EQUAL_TO',
              },
            ]
            if (band.max !== null) {
              priceConditions.push({
                criteria: { amount: band.max.toFixed(2), currencyCode: 'USD' },
                operator: 'LESS_THAN_OR_EQUAL_TO',
              })
            }

            methodDefinitionsToCreate.push({
              name: `${opt.name} ($${band.min}${maxLabel})`,
              active: true,
              rateDefinition: {
                price: { amount: rate.toFixed(2), currencyCode: 'USD' },
              },
              priceConditionsToCreate: priceConditions,
            })
          }
        } else {
          const name = opt.note ? `${opt.name} (${opt.note})` : opt.name
          methodDefinitionsToCreate.push({
            name,
            active: true,
            rateDefinition: {
              price: { amount: (opt.flat_rate ?? 0).toFixed(2), currencyCode: 'USD' },
            },
          })
        }
      }

      zonesToUpdate.push({
        locationGroupId,
        zoneId,
        methodDefinitionsToDelete,
        methodDefinitionsToCreate,
      })
    }

    // Group zonesToUpdate by locationGroupId for the mutation input
    const locationGroupsMap = new Map<string, Record<string, unknown>[]>()
    for (const z of zonesToUpdate) {
      const arr = locationGroupsMap.get(z.locationGroupId) ?? []
      arr.push({
        id: z.zoneId,
        methodDefinitionsToCreate: z.methodDefinitionsToCreate,
      })
      locationGroupsMap.set(z.locationGroupId, arr)
    }

    const locationGroupsToUpdate = Array.from(locationGroupsMap.entries()).map(
      ([locationGroupId, zones]) => ({
        id: locationGroupId,
        zonesToUpdate: zones,
      })
    )

    // methodDefinitionsToDelete belongs at the top level of DeliveryProfileInput,
    // not nested inside each zone
    const allMethodDefinitionsToDelete: string[] = []
    for (const z of zonesToUpdate) {
      allMethodDefinitionsToDelete.push(...z.methodDefinitionsToDelete)
    }

    const mutation = `
      mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
        deliveryProfileUpdate(id: $id, profile: $profile) {
          profile {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const variables = {
      id: profileId,
      profile: {
        locationGroupsToUpdate,
        methodDefinitionsToDelete: allMethodDefinitionsToDelete,
      },
    }

    const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query: mutation, variables }),
    })

    const json = await res.json()

    if (json.errors) {
      return NextResponse.json(
        { error: 'Shopify GraphQL error', details: json.errors, variables },
        { status: 500 }
      )
    }

    const userErrors = json.data?.deliveryProfileUpdate?.userErrors
    if (userErrors && userErrors.length > 0) {
      return NextResponse.json(
        { error: 'Shopify rejected the update', details: userErrors, variables },
        { status: 500 }
      )
    }

    results.push(json.data.deliveryProfileUpdate)
  }

  // Re-fetch method definitions to capture new ids, so future syncs can clean up correctly
  const lookupQuery = `
    query {
      deliveryProfiles(first: 10) {
        edges {
          node {
            id
            profileLocationGroups {
              locationGroupZones(first: 25) {
                edges {
                  node {
                    zone { id }
                    methodDefinitions(first: 50) {
                      edges {
                        node { id name }
                      }
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

  const lookupRes = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query: lookupQuery }),
  })
  const lookupJson = await lookupRes.json()

  // Build a map: zoneId -> [{ id, name }]
  const zoneMethodMap = new Map<string, { id: string; name: string }[]>()
  for (const profileEdge of lookupJson.data?.deliveryProfiles?.edges ?? []) {
    for (const lg of profileEdge.node.profileLocationGroups ?? []) {
      for (const zoneEdge of lg.locationGroupZones?.edges ?? []) {
        const zoneId = zoneEdge.node.zone.id
        const methods = (zoneEdge.node.methodDefinitions?.edges ?? []).map(
          (e: { node: { id: string; name: string } }) => e.node
        )
        zoneMethodMap.set(zoneId, methods)
      }
    }
  }

  // Update each option's stored method definition ids by matching on name
  for (const opt of options as ShippingOption[]) {
    const methods = zoneMethodMap.get(opt.zone_id!) ?? []
    let matchedIds: string[] = []

    if (opt.type === 'tariff') {
      const bands = opt.bands ?? []
      matchedIds = bands
        .map((band) => {
          const maxLabel = band.max !== null ? `-${band.max}` : '+'
          const name = `${opt.name} ($${band.min}${maxLabel})`
          return methods.find((m) => m.name === name)?.id
        })
        .filter((id): id is string => !!id)
    } else {
      const name = opt.note ? `${opt.name} (${opt.note})` : opt.name
      const match = methods.find((m) => m.name === name)
      if (match) matchedIds = [match.id]
    }

    await supabaseAdmin
      .from('shipping_options')
      .update({ shopify_method_definition_ids: matchedIds })
      .eq('id', opt.id)
  }

  await supabaseAdmin
    .from('shopify_shops')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('shop_domain', shop)

  return NextResponse.json({ success: true, results })
}
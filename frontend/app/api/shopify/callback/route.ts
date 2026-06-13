import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { encrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const shop = params.get('shop')
  const code = params.get('code')
  const state = params.get('state')
  const cookieState = req.cookies.get('shopify_oauth_state')?.value

  if (!shop || !code || state !== cookieState) {
    return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'Token exchange failed', details: tokenData }, { status: 400 })
  }

  const encryptedToken = encrypt(tokenData.access_token)

  await supabaseAdmin
    .from('shopify_shops')
    .upsert({ shop_domain: shop, access_token: encryptedToken }, { onConflict: 'shop_domain' })

  return NextResponse.redirect('https://courses-for-horses.vercel.app/simple-ship?connected=true')
}
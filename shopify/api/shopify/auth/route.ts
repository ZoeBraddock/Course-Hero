import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  let shop = req.nextUrl.searchParams.get('shop')
  if (!shop) return NextResponse.json({ error: 'Missing shop param' }, { status: 400 })

  // Clean up common input mistakes: stray protocol, whitespace, trailing slashes
  shop = shop.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')

  if (!shop.endsWith('.myshopify.com')) {
    return NextResponse.json(
      { error: 'Shop must be a .myshopify.com domain, e.g. yourstore.myshopify.com' },
      { status: 400 }
    )
  }

  const state = crypto.randomBytes(16).toString('hex')
  const redirectUri = 'https://courses-for-horses.vercel.app/api/shopify/callback'

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=read_shipping,write_shipping&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`

  const res = NextResponse.redirect(installUrl)
  res.cookies.set('shopify_oauth_state', state, { httpOnly: true, maxAge: 600 })
  return res
}
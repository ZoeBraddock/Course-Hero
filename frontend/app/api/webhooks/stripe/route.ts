import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '../../../../lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { course_instance_id, email } = session.metadata!
    const amount = (session.amount_total ?? 0) / 100

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (!profile) {
      console.error('Profile not found for email:', email)
      return NextResponse.json({ received: true }) // return 200 so Stripe doesn't retry
    }

    // upsert handles Stripe retries gracefully — won't duplicate
    const { data: enrolment } = await supabaseAdmin
      .from('enrolment')
      .upsert(
        { course_instance_id, profile_id: profile.id, role: 'student', status: 'active' },
        { onConflict: 'course_instance_id,profile_id', ignoreDuplicates: true }
      )
      .select('id')
      .single()

    if (!enrolment) {
      console.error('Enrolment upsert failed')
      return NextResponse.json({ received: true })
    }

    await supabaseAdmin
      .from('orders')
      .upsert(
        {
          enrolment_id: enrolment.id,
          amount,
          status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
        },
        { onConflict: 'stripe_session_id', ignoreDuplicates: true }
      )
  }

  return NextResponse.json({ received: true })
}
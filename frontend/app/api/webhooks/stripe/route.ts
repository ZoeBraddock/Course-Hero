import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '../../../../lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Required: read raw body for Stripe signature verification
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Only handle successful payments
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const { course_instance_id, email, fb_profile_url } = session.metadata!
    const amount = (session.amount_total ?? 0) / 100 // convert from cents

    try {
      // 1. Find or create profile by email
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (profileError || !profile) {
        console.error('Profile not found for email:', email)
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }

      // Update fb_profile_url on profile if provided
      if (fb_profile_url) {
        await supabaseAdmin
          .from('profiles')
          .update({ fb_profile_url })
          .eq('id', profile.id)
      }

      // 2. Create enrolment row
      const { data: enrolment, error: enrolmentError } = await supabaseAdmin
        .from('enrolment')
        .insert({
          course_instance_id,
          profile_id: profile.id,
          role: 'student',
          status: 'active',
        })
        .select('id')
        .single()

      if (enrolmentError || !enrolment) {
        console.error('Enrolment insert error:', enrolmentError)
        return NextResponse.json({ error: 'Failed to create enrolment' }, { status: 500 })
      }

      // 3. Create order row
      const { error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          enrolment_id: enrolment.id,
          amount,
          status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string,
        })

      if (orderError) {
        console.error('Order insert error:', orderError)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
      }

      console.log(`Enrolment created for ${email} in instance ${course_instance_id}`)
    } catch (err) {
      console.error('Webhook processing error:', err)
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
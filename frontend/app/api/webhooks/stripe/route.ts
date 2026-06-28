import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { supabaseAdmin } from '../../../../lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY!)
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

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('email', email)
      .single()

    if (!profile) {
      console.error('Profile not found for email:', email)
      return NextResponse.json({ received: true })
    }

    // Get course instance + course details for email
    const { data: instance } = await supabaseAdmin
      .from('course_instance')
      .select('start_date, end_date, fb_group_invite_url, course!course_instance_course_id_fkey(title)')
      .eq('course_instance_id', course_instance_id)
      .single()

    // Upsert enrolment
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

    // Upsert order
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

    // Send confirmation email
    if (instance) {
      const course = (instance.course as any)
      const firstName = profile.full_name?.split(' ')[0] ?? 'there'
      const startDate = new Date(instance.start_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
      const endDate = new Date(instance.end_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })

      await resend.emails.send({
        from: 'Course Hero <onboarding@resend.dev>',
        to: email,
        subject: `You're enrolled in ${course.title}!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #ffffff; padding: 40px; border-radius: 12px;">
            <h1 style="color: #6366f1; margin-bottom: 8px;">You're enrolled! 🎉</h1>
            <p style="color: #9ca3af; margin-bottom: 32px;">Payment confirmed — here's everything you need.</p>

            <div style="background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px;">${course.title}</h2>
              <p style="color: #9ca3af; margin: 0 0 16px 0;">${startDate} – ${endDate}</p>
              <p style="color: #9ca3af; margin: 0;">Amount paid: <strong style="color: #ffffff;">$${amount.toFixed(2)} NZD</strong></p>
            </div>

            ${instance.fb_group_invite_url ? `
            <div style="background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 8px 0;">Join the Facebook Group</h3>
              <p style="color: #9ca3af; margin: 0 0 16px 0;">Connect with your instructor and fellow students.</p>
              <a href="${instance.fb_group_invite_url}" style="display: inline-block; background: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 600;">
                Join Group →
              </a>
            </div>
            ` : ''}

            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Hi ${firstName}, thanks for enrolling. If you have any questions, reply to this email.
            </p>
          </div>
        `,
      })

      console.log(`Confirmation email sent to ${email}`)
    }
  }

  return NextResponse.json({ received: true })
}
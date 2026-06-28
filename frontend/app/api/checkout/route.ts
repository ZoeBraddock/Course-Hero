import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '../../../lib/supabase-server'

console.log('STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY)
console.log('SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('SERVICE_ROLE exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const { courseInstanceId, email } = await req.json()

  console.log('courseInstanceId:', courseInstanceId)
  console.log('email:', email)

  if (!courseInstanceId || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: instance, error } = await supabaseAdmin
    .from('course_instance')
    .select('course_instance_id, course_id, course!course_instance_course_id_fkey(title, price)')
    .eq('course_instance_id', courseInstanceId)
    .single()

  console.log('instance:', JSON.stringify(instance))
  console.log('instanceError:', JSON.stringify(error))

  if (error || !instance) {
    return NextResponse.json({ error: 'Course instance not found' }, { status: 404 })
  }

  const course = (instance.course as any) as { title: string; price: number }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    line_items: [{
      price_data: {
        currency: 'nzd',
        product_data: { name: course.title },
        unit_amount: Math.round(course.price * 100),
      },
      quantity: 1,
    }],
    allow_promotion_codes: true,
    metadata: { course_instance_id: courseInstanceId, email },
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/enrolment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/course/${instance.course_id}`,
  })

  return NextResponse.json({ url: session.url })
}
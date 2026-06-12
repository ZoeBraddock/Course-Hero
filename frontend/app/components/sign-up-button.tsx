'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function SignUpButton() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (user) return null

  return (
    <Link href="/signup" className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-3 rounded-full transition">
      Sign Up Free
    </Link>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import Navbar from '../components/navbar'

export default function Account() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUser(data.user)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) return null

  const memberSince = new Date(user.created_at).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long' })

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar />
      <div className="bg-gray-900 rounded-2xl p-10 border border-gray-800 w-full max-w-md text-center space-y-6">
        <div>
          <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold">{user.email}</h1>
          <p className="text-gray-500 text-sm mt-1">Member since {memberSince}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/my-courses" className="block bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition">
            My Courses
          </Link>
          <Link href="/my-horses" className="block bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition">
            My Horses
          </Link>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full border border-red-800 hover:bg-red-900/30 text-red-400 font-medium py-3 rounded-xl transition"
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}

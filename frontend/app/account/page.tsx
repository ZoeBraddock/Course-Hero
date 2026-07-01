'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar />
      <div className="bg-gray-900 rounded-2xl p-10 border border-gray-800 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-8">My Account</h1>

        <div className="space-y-4 mb-8">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</p>
            <p className="text-white">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Member since</p>
            <p className="text-white">{new Date(user.created_at).toLocaleDateString('en-NZ')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-8">
          <Link href="/my-courses" className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-3 transition">
            <span className="text-sm font-medium">My Courses</span>
            <span className="text-gray-500">→</span>
          </Link>
          <Link href="/my-horses" className="flex items-center justify-between bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-3 transition">
            <span className="text-sm font-medium">My Horses</span>
            <span className="text-gray-500">→</span>
          </Link>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-lg py-2.5 text-sm font-medium transition"
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}

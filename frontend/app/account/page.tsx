'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Navbar from '../components/navbar'

export default function Account() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
      }
    }
    getUser()
  }, [])

  if (!user) return null

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar />
      <div className="bg-gray-900 rounded-2xl p-10 border border-gray-800 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-6">My Account</h1>
        <p className="text-gray-400 mb-2">Email</p>
        <p className="text-white mb-6">{user.email}</p>
        <p className="text-gray-500 text-sm">More profile settings coming soon.</p>
      </div>
    </main>
  )
}
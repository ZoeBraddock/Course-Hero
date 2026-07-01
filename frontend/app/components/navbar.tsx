'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-10 flex justify-between items-center px-6 py-4 bg-gray-950 border-b border-gray-800 h-20">
      <Link href="/" className="text-white font-bold text-lg tracking-tight">
        Course Hero
      </Link>
      <div className="flex gap-4 items-center">
        <Link href="/" className="text-gray-400 hover:text-white transition text-sm">Home</Link>

        {user ? (
          <>
            <Link href="/my-courses" className="text-gray-400 hover:text-white transition text-sm">My Courses</Link>
            <Link href="/my-horses" className="text-gray-400 hover:text-white transition text-sm">My Horses</Link>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm hover:bg-indigo-500 transition"
              >
                {user.email?.charAt(0).toUpperCase()}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-xl overflow-hidden">
                  <div className="px-4 py-3 text-sm text-gray-400 border-b border-gray-800 truncate">
                    {user.email}
                  </div>
                  <Link
                    href="/account"
                    className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
                    onClick={() => setMenuOpen(false)}
                  >
                    Account
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
                  >
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link href="/login" className="text-gray-400 hover:text-white transition text-sm">Log In</Link>
            <Link href="/signup" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-full transition">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import Navbar from '../components/navbar'

export default function Account() {
  const [user, setUser] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUser(data.user)
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', data.user.id)
        .single()
      setAvatarUrl(profile?.avatar_url ?? null)
    })
  }, [])

  const handleAvatarUpload = async (file: File) => {
    if (!user) return
    setUploadingAvatar(true)
    setError('')
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadErr) { setError(uploadErr.message); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setAvatarUrl(`${publicUrl}?t=${Date.now()}`)
    setUploadingAvatar(false)
  }

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
          <div className="relative w-24 h-24 mx-auto mb-4 group cursor-pointer">
            <div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center text-3xl font-bold overflow-hidden ring-4 ring-gray-800">
              {avatarUrl
                ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                : user.email?.charAt(0).toUpperCase()
              }
            </div>
            <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition cursor-pointer">
              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition">
                {uploadingAvatar ? '...' : 'Change'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = '' }} />
            </label>
          </div>
          <h1 className="text-xl font-bold">{user.email}</h1>
          <p className="text-gray-500 text-sm mt-1">Member since {memberSince}</p>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col gap-3">
          <Link href="/my-courses" className="block bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition">
            My Courses
          </Link>
          <Link href="/my-horses" className="block bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition">
            My Horses
          </Link>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full border border-red-900 hover:bg-red-900/20 text-red-400 font-medium py-3 rounded-xl transition"
        >
          Sign Out
        </button>
      </div>
    </main>
  )
}

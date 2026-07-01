'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Navbar from '../components/navbar'

export default function CreateCourse() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUser(data.user)
    })
  }, [])

  const handleCreate = async () => {
    if (!title.trim()) return setError('Title is required')
    if (!price) return setError('Price is required')
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('course').insert({
      title,
      description,
      price: parseFloat(price),
      owner_id: user.id,
    })
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/my-courses')
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar />
      <div className="bg-gray-900 p-10 rounded-2xl border border-gray-800 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Create a Course</h1>
        <p className="text-gray-400 mb-8">Add a new course to Course Hero</p>

        <form onSubmit={e => { e.preventDefault(); handleCreate() }} className="space-y-4">
          <input
            type="text"
            placeholder="Course Title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
          />
          <textarea
            placeholder="Description"
            value={description}
            rows={3}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
          />
          <input
            type="number"
            placeholder="Price *"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition"
          >
            {saving ? 'Creating...' : 'Create Course'}
          </button>
        </form>
      </div>
    </main>
  )
}

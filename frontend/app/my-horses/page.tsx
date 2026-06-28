'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Navbar from '../components/navbar'

interface Horse {
  id: string
  name: string
  breed: string | null
  dob: string | null
  colour: string | null
  bio: string | null
  photo_url: string | null
}

const emptyForm = { name: '', breed: '', dob: '', colour: '', bio: '' }

export default function MyHorses() {
  const [horses, setHorses] = useState<Horse[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data } = await supabase
        .from('horse')
        .select('id, name, breed, dob, colour, bio, photo_url')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })

      setHorses(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) return setError('Name is required')
    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editingId) {
      const { error: err } = await supabase
        .from('horse')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editingId)

      if (err) { setError(err.message); setSaving(false); return }
      setHorses(prev => prev.map(h => h.id === editingId ? { ...h, ...form } : h))
    } else {
      const { data, error: err } = await supabase
        .from('horse')
        .insert({ ...form, owner_id: user.id })
        .select()
        .single()

      if (err) { setError(err.message); setSaving(false); return }
      setHorses(prev => [...prev, data])
    }

    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
    setSaving(false)
  }

  const handlePhotoUpload = async (horseId: string, file: File) => {
    if (!userId) return
    setUploadingId(horseId)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${userId}/${horseId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('horse-photos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploadingId(null)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('horse-photos')
      .getPublicUrl(path)

    const { error: updateError } = await supabase
      .from('horse')
      .update({ photo_url: publicUrl })
      .eq('id', horseId)

    if (updateError) {
      setError(updateError.message)
      setUploadingId(null)
      return
    }

    // Force re-render with cache buster
    const urlWithBuster = `${publicUrl}?t=${Date.now()}`
    setHorses(prev => prev.map(h =>
      h.id === horseId ? { ...h, photo_url: urlWithBuster } : h
    ))
    setUploadingId(null)
  }

  const handleEdit = (horse: Horse) => {
    setForm({ name: horse.name, breed: horse.breed ?? '', dob: horse.dob ?? '', colour: horse.colour ?? '', bio: horse.bio ?? '' })
    setEditingId(horse.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this horse profile?')) return
    if (userId) {
      const horse = horses.find(h => h.id === id)
      if (horse?.photo_url) {
        const ext = horse.photo_url.split('.').pop()?.split('?')[0]
        await supabase.storage.from('horse-photos').remove([`${userId}/${id}.${ext}`])
      }
    }
    await supabase.from('horse').delete().eq('id', id)
    setHorses(prev => prev.filter(h => h.id !== id))
  }

  const handleCancel = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
    setError('')
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-NZ')
  const calcAge = (dob: string) => {
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    return `${age} yr${age !== 1 ? 's' : ''}`
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar />
      <p className="text-gray-400">Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white pt-28 px-6 pb-16">
      <Navbar />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">My Horses</h1>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-4 py-2 rounded-full transition text-sm"
            >
              + Add Horse
            </button>
          )}
        </div>

        {showForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Horse' : 'New Horse'}</h2>
            <input
              type="text"
              placeholder="Name *"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Breed"
                value={form.breed}
                onChange={e => setForm({ ...form, breed: e.target.value })}
                className="bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Colour"
                value={form.colour}
                onChange={e => setForm({ ...form, colour: e.target.value })}
                className="bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date of Birth</label>
              <input
                type="date"
                value={form.dob}
                onChange={e => setForm({ ...form, dob: e.target.value })}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
              />
            </div>
            <textarea
              placeholder="Bio"
              value={form.bio}
              rows={3}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-full transition text-sm"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Horse'}
              </button>
              <button onClick={handleCancel} className="text-gray-400 hover:text-white transition text-sm px-4 py-2">
                Cancel
              </button>
            </div>
          </div>
        )}

        {horses.length === 0 && !showForm ? (
          <p className="text-gray-500">No horses yet — add your first one!</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {horses.map(horse => (
              <div key={horse.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Photo area */}
                <div className="relative h-48 bg-gray-800">
                  {horse.photo_url && (
                    <img
                      src={horse.photo_url}
                      alt={horse.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {!horse.photo_url && (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                      No photo yet
                    </div>
                  )}
                  {/* Upload overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/50 transition group">
                    <label className="cursor-pointer flex items-center justify-center w-full h-full">
                      <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition">
                        {uploadingId === horse.id ? 'Uploading...' : '📷 Change photo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingId === horse.id}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handlePhotoUpload(horse.id, file)
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <h3 className="text-lg font-bold">{horse.name}</h3>
                  <div className="text-sm text-gray-400 space-y-1">
                    {horse.breed && <p>🐴 {horse.breed}</p>}
                    {horse.colour && <p>🎨 {horse.colour}</p>}
                    {horse.dob && <p>🎂 {formatDate(horse.dob)} ({calcAge(horse.dob)})</p>}
                    {horse.bio && <p className="text-gray-300 mt-2">{horse.bio}</p>}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => handleEdit(horse)} className="text-indigo-400 hover:text-indigo-300 text-sm transition">Edit</button>
                    <button onClick={() => handleDelete(horse.id)} className="text-red-400 hover:text-red-300 text-sm transition">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
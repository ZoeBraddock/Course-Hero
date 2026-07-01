'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import Navbar from '../../components/navbar'

interface CourseInstance {
  course_instance_id: string
  start_date: string
  end_date: string
  fb_group_invite_url: string | null
}

interface Course {
  id: string
  title: string
  description: string
  price: number
  owner_id: string
  banner_url: string | null
  course_instance: CourseInstance[]
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-NZ')
const emptyInstanceForm = { start_date: '', end_date: '', fb_group_invite_url: '' }

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [course, setCourse] = useState<Course | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', price: '' })
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [showInstanceForm, setShowInstanceForm] = useState(false)
  const [instanceForm, setInstanceForm] = useState(emptyInstanceForm)
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null)
  const [savingInstance, setSavingInstance] = useState(false)

  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { setUserId(user.id); setUserEmail(user.email ?? '') }

      const { data, error: err } = await supabase
        .from('course')
        .select('id, title, description, price, owner_id, banner_url, course_instance(course_instance_id, start_date, end_date, fb_group_invite_url)')
        .eq('id', id)
        .single()

      if (err || !data) { setError('Course not found'); setLoading(false); return }
      setCourse(data as Course)

      if (user && (data.course_instance as CourseInstance[]).length > 0) {
        const instanceIds = (data.course_instance as CourseInstance[]).map(i => i.course_instance_id)
        const { data: enrolments } = await supabase
          .from('enrolment')
          .select('course_instance_id')
          .eq('profile_id', user.id)
          .in('course_instance_id', instanceIds)
        setEnrolledIds(new Set((enrolments ?? []).map((e: any) => e.course_instance_id)))
      }

      setLoading(false)
    }
    load()
  }, [id])

  const isOwner = !!(userId && course && userId === course.owner_id)

  const handleSaveCourse = async () => {
    if (!course) return
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.price) { setError('Price is required'); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('course')
      .update({ title: form.title, description: form.description, price: parseFloat(form.price) })
      .eq('id', course.id)
    if (err) { setError(err.message); setSaving(false); return }
    setCourse(prev => prev ? { ...prev, title: form.title, description: form.description, price: parseFloat(form.price) } : prev)
    setEditing(false)
    setSaving(false)
  }

  const handleBannerUpload = async (file: File) => {
    if (!userId || !course) return
    setUploadingBanner(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/${course.id}_banner.${ext}`
    const { error: uploadErr } = await supabase.storage.from('course-images').upload(path, file, { upsert: true })
    if (uploadErr) { setError(uploadErr.message); setUploadingBanner(false); return }
    const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(path)
    const { error: updateErr } = await supabase.from('course').update({ banner_url: publicUrl }).eq('id', course.id)
    if (updateErr) { setError(updateErr.message); setUploadingBanner(false); return }
    setCourse(prev => prev ? { ...prev, banner_url: `${publicUrl}?t=${Date.now()}` } : prev)
    setUploadingBanner(false)
  }

  const handleSaveInstance = async () => {
    if (!course || !instanceForm.start_date || !instanceForm.end_date) return
    setSavingInstance(true)
    const payload = { ...instanceForm, fb_group_invite_url: instanceForm.fb_group_invite_url || null }
    if (editingInstanceId) {
      const { error: err } = await supabase
        .from('course_instance')
        .update(payload)
        .eq('course_instance_id', editingInstanceId)
      if (err) { setError(err.message); setSavingInstance(false); return }
      setCourse(prev => prev ? {
        ...prev,
        course_instance: prev.course_instance.map(i =>
          i.course_instance_id === editingInstanceId ? { ...i, ...instanceForm } : i
        )
      } : prev)
      setEditingInstanceId(null)
    } else {
      const { data, error: err } = await supabase
        .from('course_instance')
        .insert({ ...payload, course_id: course.id })
        .select('course_instance_id, start_date, end_date, fb_group_invite_url')
        .single()
      if (err) { setError(err.message); setSavingInstance(false); return }
      setCourse(prev => prev ? { ...prev, course_instance: [...prev.course_instance, data] } : prev)
      setShowInstanceForm(false)
    }
    setInstanceForm(emptyInstanceForm)
    setSavingInstance(false)
  }

  const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm('Delete this instance?')) return
    await supabase.from('course_instance').delete().eq('course_instance_id', instanceId)
    setCourse(prev => prev ? {
      ...prev,
      course_instance: prev.course_instance.filter(i => i.course_instance_id !== instanceId)
    } : prev)
  }

  const handleEnrol = async (instanceId: string) => {
    if (!userId) { router.push('/login'); return }
    setEnrollingId(instanceId)
    setError('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseInstanceId: instanceId, email: userEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setEnrollingId(null)
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar /><p className="text-gray-400">Loading...</p>
    </main>
  )

  if (!course) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar /><p className="text-red-400">{error || 'Course not found'}</p>
    </main>
  )

  const instanceFormBlock = (saveLabel: string, onCancel: () => void) => (
    <div className="bg-gray-800 border border-indigo-500/50 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Start Date *</label>
          <input type="date" value={instanceForm.start_date} onChange={e => setInstanceForm({ ...instanceForm, start_date: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">End Date *</label>
          <input type="date" value={instanceForm.end_date} onChange={e => setInstanceForm({ ...instanceForm, end_date: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500 text-sm" />
        </div>
      </div>
      <input type="text" placeholder="Facebook group URL" value={instanceForm.fb_group_invite_url} onChange={e => setInstanceForm({ ...instanceForm, fb_group_invite_url: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500 text-sm" />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-3">
        <button onClick={handleSaveInstance} disabled={savingInstance} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition">
          {savingInstance ? 'Saving...' : saveLabel}
        </button>
        <button onClick={onCancel} className="text-gray-400 hover:text-white text-xs px-3 py-2 transition">Cancel</button>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white pt-20 pb-16">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 space-y-4 mt-8">

        {/* Portrait banner alongside course info */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col sm:flex-row">

          {/* Banner — portrait strip, stretches full height of card */}
          {(course.banner_url || isOwner) && (
            <div className="relative aspect-[3/4] sm:aspect-auto sm:w-56 flex-shrink-0 bg-gray-800">
              {course.banner_url
                ? <img src={course.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                : <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-800" />
              }
              {isOwner && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/50 transition cursor-pointer group">
                  <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition bg-black/60 px-4 py-2 rounded-full">
                    {uploadingBanner ? 'Uploading...' : '📷 Set banner'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); e.target.value = '' }} />
                </label>
              )}
            </div>
          )}

          {/* Course info */}
          <div className="p-8 flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500 text-xl font-bold" />
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500" />
                <input type="number" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500" />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={handleSaveCourse} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-full transition">{saving ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => { setEditing(false); setError('') }} className="text-gray-400 hover:text-white text-sm px-4 py-2 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
                  <p className="text-gray-400 mb-5">{course.description}</p>
                  <span className="text-2xl font-bold text-indigo-400">${course.price}</span>
                </div>
                {isOwner && (
                  <button
                    onClick={() => { setForm({ title: course.title, description: course.description, price: String(course.price) }); setEditing(true) }}
                    className="text-sm text-gray-500 hover:text-white transition flex-shrink-0 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Instances */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Course Dates</h2>
            {isOwner && !showInstanceForm && (
              <button
                onClick={() => { setShowInstanceForm(true); setEditingInstanceId(null); setInstanceForm(emptyInstanceForm) }}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition font-medium"
              >
                + Add instance
              </button>
            )}
          </div>

          {course.course_instance.length === 0 && !showInstanceForm && (
            <p className="text-gray-500 text-sm">
              {isOwner ? 'No instances yet — add one to start taking enrolments.' : 'No dates scheduled yet. Check back soon!'}
            </p>
          )}

          <div className="space-y-2">
            {course.course_instance.map(inst => (
              <div key={inst.course_instance_id}>
                {isOwner && editingInstanceId === inst.course_instance_id ? (
                  instanceFormBlock('Save', () => { setEditingInstanceId(null); setInstanceForm(emptyInstanceForm) })
                ) : (
                  <div className="flex justify-between items-center bg-gray-800 rounded-xl px-4 py-3">
                    <span className="text-sm text-gray-300">{fmt(inst.start_date)} – {fmt(inst.end_date)}</span>
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <>
                          <Link href={`/course/${course.id}/instance/${inst.course_instance_id}`} className="text-xs text-indigo-400 hover:text-indigo-300 transition">View enrolments →</Link>
                          <button onClick={() => { setEditingInstanceId(inst.course_instance_id); setInstanceForm({ start_date: inst.start_date, end_date: inst.end_date, fb_group_invite_url: inst.fb_group_invite_url ?? '' }) }} className="text-gray-500 hover:text-white text-xs transition">Edit</button>
                          <button onClick={() => handleDeleteInstance(inst.course_instance_id)} className="text-red-400 hover:text-red-300 text-xs transition">Delete</button>
                        </>
                      ) : enrolledIds.has(inst.course_instance_id) ? (
                        <Link href={`/course/${course.id}/instance/${inst.course_instance_id}`} className="text-xs bg-green-900 hover:bg-green-800 text-green-300 font-medium px-3 py-1.5 rounded-full transition">Visit instance →</Link>
                      ) : (
                        <button onClick={() => handleEnrol(inst.course_instance_id)} disabled={enrollingId === inst.course_instance_id} className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-full transition">
                          {enrollingId === inst.course_instance_id ? 'Redirecting...' : 'Enrol Now'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isOwner && showInstanceForm && !editingInstanceId && (
            <div className="mt-3">
              {instanceFormBlock('Add Instance', () => { setShowInstanceForm(false); setInstanceForm(emptyInstanceForm) })}
            </div>
          )}

          {error && !editing && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </div>
      </div>
    </main>
  )
}

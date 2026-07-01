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
  profile_pic_url: string | null
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

  // Owner state
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', price: '' })
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState<'banner' | 'profile_pic' | null>(null)
  const [showInstanceForm, setShowInstanceForm] = useState(false)
  const [instanceForm, setInstanceForm] = useState(emptyInstanceForm)
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null)
  const [savingInstance, setSavingInstance] = useState(false)

  // Visitor state
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { setUserId(user.id); setUserEmail(user.email ?? '') }

      const { data, error: err } = await supabase
        .from('course')
        .select('id, title, description, price, owner_id, banner_url, profile_pic_url, course_instance(course_instance_id, start_date, end_date, fb_group_invite_url)')
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

  // ── Owner handlers ─────────────────────────────────────────

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

  const handleImageUpload = async (file: File, type: 'banner' | 'profile_pic') => {
    if (!userId || !course) return
    setUploadingImage(type)
    const ext = file.name.split('.').pop()
    const path = `${userId}/${course.id}_${type}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('course-images').upload(path, file, { upsert: true })
    if (uploadErr) { setError(uploadErr.message); setUploadingImage(null); return }
    const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(path)
    const column = type === 'banner' ? 'banner_url' : 'profile_pic_url'
    const { error: updateErr } = await supabase.from('course').update({ [column]: publicUrl }).eq('id', course.id)
    if (updateErr) { setError(updateErr.message); setUploadingImage(null); return }
    setCourse(prev => prev ? { ...prev, [column]: `${publicUrl}?t=${Date.now()}` } : prev)
    setUploadingImage(null)
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

  // ── Visitor handler ────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────

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

  const hasBannerArea = !!(course.banner_url || isOwner)
  const hasProfilePicArea = !!(course.profile_pic_url || isOwner)

  const instanceFormBlock = (saveLabel: string, onCancel: () => void) => (
    <div className="bg-gray-800 border border-indigo-500 rounded-lg p-4 space-y-3">
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
        <button onClick={handleSaveInstance} disabled={savingInstance} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition">
          {savingInstance ? 'Saving...' : saveLabel}
        </button>
        <button onClick={onCancel} className="text-gray-400 hover:text-white text-xs px-3 py-2 transition">Cancel</button>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white pt-20 px-6 pb-16">
      <Navbar />
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">

          {/* Banner + profile pic */}
          {hasBannerArea && (
            <div className="relative h-48 bg-gray-800">
              {course.banner_url
                ? <img src={course.banner_url} alt="Banner" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-700" />
              }
              {isOwner && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 transition cursor-pointer group">
                  <span className="text-white text-sm opacity-0 group-hover:opacity-100 transition">
                    {uploadingImage === 'banner' ? 'Uploading...' : '📷 Set banner'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'banner'); e.target.value = '' }} />
                </label>
              )}
              {hasProfilePicArea && (
                <div className="absolute -bottom-8 left-8">
                  {isOwner ? (
                    <label className="cursor-pointer group block relative w-16 h-16">
                      {course.profile_pic_url
                        ? <img src={course.profile_pic_url} alt="Profile" className="w-16 h-16 rounded-full object-cover border-4 border-gray-900" />
                        : <div className="w-16 h-16 rounded-full bg-gray-700 border-4 border-gray-900 flex items-center justify-center text-gray-500 text-xs">Pic</div>
                      }
                      <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 transition flex items-center justify-center">
                        <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition">
                          {uploadingImage === 'profile_pic' ? '...' : '📷'}
                        </span>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'profile_pic'); e.target.value = '' }} />
                    </label>
                  ) : course.profile_pic_url && (
                    <img src={course.profile_pic_url} alt="Profile" className="w-16 h-16 rounded-full object-cover border-4 border-gray-900" />
                  )}
                </div>
              )}
            </div>
          )}

          <div className={`p-8 ${hasBannerArea && hasProfilePicArea ? 'pt-12' : 'pt-8'}`}>
            {!hasBannerArea && course.profile_pic_url && (
              <img src={course.profile_pic_url} alt="Profile" className="w-16 h-16 rounded-full object-cover mb-4" />
            )}

            {/* Course details */}
            {editing ? (
              <div className="space-y-3 mb-6">
                <input
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500 text-xl font-bold"
                />
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={handleSaveCourse} disabled={saving} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-full transition">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => { setEditing(false); setError('') }} className="text-gray-400 hover:text-white text-sm px-4 py-2 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
                    <p className="text-gray-400 mb-4">{course.description}</p>
                    <p className="text-2xl font-bold text-indigo-400">${course.price}</p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => { setForm({ title: course.title, description: course.description, price: String(course.price) }); setEditing(true) }}
                      className="text-gray-400 hover:text-white text-sm transition flex-shrink-0"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Instances */}
            <div className="mt-6 border-t border-gray-800 pt-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">Dates</h2>
                {isOwner && !showInstanceForm && (
                  <button
                    onClick={() => { setShowInstanceForm(true); setEditingInstanceId(null); setInstanceForm(emptyInstanceForm) }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition"
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
                      <div className="flex justify-between items-center bg-gray-800 rounded-lg px-4 py-3">
                        <span className="text-sm text-gray-300">{fmt(inst.start_date)} – {fmt(inst.end_date)}</span>
                        <div className="flex items-center gap-2">
                          {isOwner ? (
                            <>
                              <Link href={`/course/${course.id}/instance/${inst.course_instance_id}`} className="text-xs text-indigo-400 hover:text-indigo-300 transition">View enrolments →</Link>
                              <button onClick={() => { setEditingInstanceId(inst.course_instance_id); setInstanceForm({ start_date: inst.start_date, end_date: inst.end_date, fb_group_invite_url: inst.fb_group_invite_url ?? '' }) }} className="text-gray-400 hover:text-white text-xs transition">Edit</button>
                              <button onClick={() => handleDeleteInstance(inst.course_instance_id)} className="text-red-400 hover:text-red-300 text-xs transition">Delete</button>
                            </>
                          ) : enrolledIds.has(inst.course_instance_id) ? (
                            <Link href={`/course/${course.id}/instance/${inst.course_instance_id}`} className="text-xs bg-green-800 hover:bg-green-700 text-green-300 font-medium px-3 py-1.5 rounded-full transition">Visit instance →</Link>
                          ) : (
                            <button onClick={() => handleEnrol(inst.course_instance_id)} disabled={enrollingId === inst.course_instance_id} className="text-xs bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-full transition">
                              {enrollingId === inst.course_instance_id ? 'Redirecting...' : 'Enrol Now'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* New instance form */}
              {isOwner && showInstanceForm && !editingInstanceId && (
                <div className="mt-2">
                  {instanceFormBlock('Add Instance', () => { setShowInstanceForm(false); setInstanceForm(emptyInstanceForm) })}
                </div>
              )}
            </div>

            {error && !editing && <p className="text-red-400 text-sm mt-4">{error}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}

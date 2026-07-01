'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import Navbar from '../components/navbar'

interface Instance {
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
  created_at: string
  course_instance: Instance[]
  banner_url: string | null
  profile_pic_url: string | null
}

interface EnrolledInstance {
  course_instance_id: string
  start_date: string
  end_date: string
  role: string
  payment_status: string
  course: { id: string; title: string; banner_url: string | null; profile_pic_url: string | null }
}

type OwnedFilter = 'all' | 'upcoming'
type OwnedSort = 'recent' | 'name' | 'upcoming'
type EnrolledFilter = 'all' | 'upcoming' | 'past'
type EnrolledSort = 'recent' | 'name' | 'upcoming'

const today = new Date().toISOString().split('T')[0]
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-NZ')
const hasUpcoming = (instances: Instance[]) => instances.some(i => i.start_date >= today)
const emptyCourseForm = { title: '', description: '', price: '' }
const emptyInstanceForm = { start_date: '', end_date: '', fb_group_invite_url: '' }

const btnBase = 'px-3 py-1 rounded-full text-xs font-medium transition'
const activeBtn = `${btnBase} bg-indigo-500 text-white`
const inactiveBtn = `${btnBase} bg-gray-800 text-gray-400 hover:text-white`

export default function MyCourses() {
  const [ownedCourses, setOwnedCourses] = useState<Course[]>([])
  const [enrolledInstances, setEnrolledInstances] = useState<EnrolledInstance[]>([])
  const [supportingInstances, setSupportingInstances] = useState<EnrolledInstance[]>([])
  const [loading, setLoading] = useState(true)

  const [showCourseForm, setShowCourseForm] = useState(false)
  const [courseForm, setCourseForm] = useState(emptyCourseForm)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [savingCourse, setSavingCourse] = useState(false)

  const [showInstanceForm, setShowInstanceForm] = useState<string | null>(null)
  const [instanceForm, setInstanceForm] = useState(emptyInstanceForm)
  const [editingInstance, setEditingInstance] = useState<{ courseId: string; instanceId: string } | null>(null)
  const [savingInstance, setSavingInstance] = useState(false)

  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState<{ courseId: string; type: 'banner' | 'profile_pic' } | null>(null)

  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>('all')
  const [ownedSort, setOwnedSort] = useState<OwnedSort>('recent')
  const [enrolledFilter, setEnrolledFilter] = useState<EnrolledFilter>('all')
  const [enrolledSort, setEnrolledSort] = useState<EnrolledSort>('recent')

  const router = useRouter()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)

    const [ownedRes, enrolmentsRes] = await Promise.all([
      supabase
        .from('course')
        .select('id, title, description, price, created_at, banner_url, profile_pic_url, course_instance(course_instance_id, start_date, end_date, fb_group_invite_url)')
        .eq('owner_id', user.id),
      supabase
        .from('enrolment')
        .select('id, role, status, course_instance_id, course_instance(course_instance_id, start_date, end_date, course(id, title, banner_url, profile_pic_url)), orders(status)')
        .eq('profile_id', user.id),
    ])

    setOwnedCourses((ownedRes.data as Course[]) ?? [])

    const enrolled: EnrolledInstance[] = []
    const supporting: EnrolledInstance[] = []

    for (const e of enrolmentsRes.data ?? []) {
      const ci = e.course_instance as any
      if (!ci) continue
      const item: EnrolledInstance = {
        course_instance_id: ci.course_instance_id,
        start_date: ci.start_date,
        end_date: ci.end_date,
        role: e.role,
        payment_status: (e.orders as any[])?.[0]?.status ?? 'unknown',
        course: ci.course,
      }
      if (e.role === 'instructor') supporting.push(item)
      else enrolled.push(item)
    }

    setEnrolledInstances(enrolled)
    setSupportingInstances(supporting)
    setLoading(false)
  }

  // ── Filtered + sorted owned courses ──────────────────────
  const filteredOwned = useMemo(() => {
    let result = ownedFilter === 'upcoming'
      ? ownedCourses.filter(c => hasUpcoming(c.course_instance))
      : [...ownedCourses]

    if (ownedSort === 'recent') result.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (ownedSort === 'name') result.sort((a, b) => a.title.localeCompare(b.title))
    else if (ownedSort === 'upcoming') {
      result.sort((a, b) => {
        const aNext = a.course_instance.filter(i => i.start_date >= today).sort()[0]?.start_date ?? '9999'
        const bNext = b.course_instance.filter(i => i.start_date >= today).sort()[0]?.start_date ?? '9999'
        return aNext.localeCompare(bNext)
      })
    }
    return result
  }, [ownedCourses, ownedFilter, ownedSort])

  // ── Filtered + sorted enrolled instances ─────────────────
  const filteredEnrolled = useMemo(() => {
    let result = enrolledFilter === 'upcoming'
      ? enrolledInstances.filter(i => i.start_date >= today)
      : enrolledFilter === 'past'
      ? enrolledInstances.filter(i => i.end_date < today)
      : [...enrolledInstances]

    if (enrolledSort === 'recent') result.sort((a, b) => b.start_date.localeCompare(a.start_date))
    else if (enrolledSort === 'name') result.sort((a, b) => a.course.title.localeCompare(b.course.title))
    else if (enrolledSort === 'upcoming') {
      result.sort((a, b) => {
        const aDate = a.start_date >= today ? a.start_date : '9999'
        const bDate = b.start_date >= today ? b.start_date : '9999'
        return aDate.localeCompare(bDate)
      })
    }
    return result
  }, [enrolledInstances, enrolledFilter, enrolledSort])

  // ── Course image uploads ─────────────────────────────────

  const handleCourseImageUpload = async (courseId: string, file: File, type: 'banner' | 'profile_pic') => {
    if (!userId) return
    setUploadingImage({ courseId, type })
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${userId}/${courseId}_${type}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('course-images')
      .upload(path, file, { upsert: true })

    if (uploadError) { setError(uploadError.message); setUploadingImage(null); return }

    const { data: { publicUrl } } = supabase.storage
      .from('course-images')
      .getPublicUrl(path)

    const column = type === 'banner' ? 'banner_url' : 'profile_pic_url'

    const { error: updateError } = await supabase
      .from('course')
      .update({ [column]: publicUrl })
      .eq('id', courseId)

    if (updateError) { setError(updateError.message); setUploadingImage(null); return }

    setOwnedCourses(prev => prev.map(c =>
      c.id === courseId ? { ...c, [column]: `${publicUrl}?t=${Date.now()}` } : c
    ))
    setUploadingImage(null)
  }

  // ── Course CRUD ──────────────────────────────────────────

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim()) return setError('Title is required')
    if (!courseForm.price) return setError('Price is required')
    if (!userId) return
    setSavingCourse(true)
    setError('')

    if (editingCourseId) {
      const { error: err } = await supabase
        .from('course')
        .update({ title: courseForm.title, description: courseForm.description, price: parseFloat(courseForm.price) })
        .eq('id', editingCourseId)

      if (err) { setError(err.message); setSavingCourse(false); return }

      setOwnedCourses(prev => prev.map(c =>
        c.id === editingCourseId
          ? { ...c, title: courseForm.title, description: courseForm.description, price: parseFloat(courseForm.price) }
          : c
      ))
    } else {
      const { data, error: err } = await supabase
        .from('course')
        .insert({ title: courseForm.title, description: courseForm.description, price: parseFloat(courseForm.price), owner_id: userId })
        .select('id, title, description, price, created_at')
        .single()

      if (err) { setError(err.message); setSavingCourse(false); return }
      setOwnedCourses(prev => [{ ...data, course_instance: [], banner_url: null, profile_pic_url: null }, ...prev])
    }

    setCourseForm(emptyCourseForm)
    setEditingCourseId(null)
    setShowCourseForm(false)
    setSavingCourse(false)
  }

  const handleEditCourse = (course: Course) => {
    setCourseForm({ title: course.title, description: course.description ?? '', price: String(course.price) })
    setEditingCourseId(course.id)
    setShowCourseForm(false)
    setShowInstanceForm(null)
    setError('')
  }

  const handleDeleteCourse = async (courseId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This will also delete all instances and enrolments. This cannot be undone.`)) return
    await supabase.from('course').delete().eq('id', courseId)
    setOwnedCourses(prev => prev.filter(c => c.id !== courseId))
  }

  const handleCancelCourse = () => {
    setCourseForm(emptyCourseForm)
    setEditingCourseId(null)
    setShowCourseForm(false)
    setError('')
  }

  // ── Instance CRUD ────────────────────────────────────────

  const handleSaveInstance = async (courseId: string) => {
    if (!instanceForm.start_date || !instanceForm.end_date) return setError('Start and end dates are required')
    setSavingInstance(true)
    setError('')

    if (editingInstance) {
      const { error: err } = await supabase
        .from('course_instance')
        .update({ start_date: instanceForm.start_date, end_date: instanceForm.end_date, fb_group_invite_url: instanceForm.fb_group_invite_url || null })
        .eq('course_instance_id', editingInstance.instanceId)

      if (err) { setError(err.message); setSavingInstance(false); return }

      setOwnedCourses(prev => prev.map(c =>
        c.id === courseId
          ? { ...c, course_instance: c.course_instance.map(i =>
              i.course_instance_id === editingInstance.instanceId
                ? { ...i, ...instanceForm, fb_group_invite_url: instanceForm.fb_group_invite_url || null }
                : i
            )}
          : c
      ))
    } else {
      const { data, error: err } = await supabase
        .from('course_instance')
        .insert({ course_id: courseId, start_date: instanceForm.start_date, end_date: instanceForm.end_date, fb_group_invite_url: instanceForm.fb_group_invite_url || null })
        .select('course_instance_id, start_date, end_date, fb_group_invite_url')
        .single()

      if (err) { setError(err.message); setSavingInstance(false); return }
      setOwnedCourses(prev => prev.map(c =>
        c.id === courseId ? { ...c, course_instance: [...c.course_instance, data] } : c
      ))
    }

    setInstanceForm(emptyInstanceForm)
    setEditingInstance(null)
    setShowInstanceForm(null)
    setSavingInstance(false)
  }

  const handleEditInstance = (courseId: string, inst: Instance) => {
    setInstanceForm({ start_date: inst.start_date, end_date: inst.end_date, fb_group_invite_url: inst.fb_group_invite_url ?? '' })
    setEditingInstance({ courseId, instanceId: inst.course_instance_id })
    setShowInstanceForm(courseId)
    setEditingCourseId(null)
    setError('')
  }

  const handleDeleteInstance = async (courseId: string, instanceId: string) => {
    if (!confirm('Delete this instance? This will also delete all enrolments for it.')) return
    await supabase.from('course_instance').delete().eq('course_instance_id', instanceId)
    setOwnedCourses(prev => prev.map(c =>
      c.id === courseId ? { ...c, course_instance: c.course_instance.filter(i => i.course_instance_id !== instanceId) } : c
    ))
  }

  const handleCancelInstance = () => {
    setInstanceForm(emptyInstanceForm)
    setEditingInstance(null)
    setShowInstanceForm(null)
    setError('')
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
      <div className="max-w-4xl mx-auto space-y-12">
        <h1 className="text-3xl font-bold">My Courses</h1>

        {/* ── Courses I Own ── */}
        <section>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold text-indigo-400">Courses I Own</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                <button className={ownedFilter === 'all' ? activeBtn : inactiveBtn} onClick={() => setOwnedFilter('all')}>All</button>
                <button className={ownedFilter === 'upcoming' ? activeBtn : inactiveBtn} onClick={() => setOwnedFilter('upcoming')}>Upcoming</button>
              </div>
              <select
                value={ownedSort}
                onChange={e => setOwnedSort(e.target.value as OwnedSort)}
                className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full outline-none border border-gray-700 focus:border-indigo-500"
              >
                <option value="recent">Recently Added</option>
                <option value="name">Name</option>
                <option value="upcoming">Next Upcoming</option>
              </select>
              {!showCourseForm && !editingCourseId && (
                <button
                  onClick={() => { setShowCourseForm(true); setCourseForm(emptyCourseForm) }}
                  className="bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold px-4 py-1 rounded-full transition"
                >
                  + Add Course
                </button>
              )}
            </div>
          </div>

          {showCourseForm && !editingCourseId && (
            <div className="bg-gray-900 border border-indigo-500 rounded-xl p-6 mb-4 space-y-3">
              <h3 className="font-semibold">New Course</h3>
              <input type="text" placeholder="Title *" value={courseForm.title} onChange={e => setCourseForm({ ...courseForm, title: e.target.value })} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500" />
              <textarea placeholder="Description" value={courseForm.description} rows={2} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500" />
              <input type="number" placeholder="Price *" value={courseForm.price} onChange={e => setCourseForm({ ...courseForm, price: e.target.value })} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500" />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={handleSaveCourse} disabled={savingCourse} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-full transition">{savingCourse ? 'Saving...' : 'Create Course'}</button>
                <button onClick={handleCancelCourse} className="text-gray-400 hover:text-white text-sm px-4 py-2 transition">Cancel</button>
              </div>
            </div>
          )}

          {filteredOwned.length === 0 ? (
            <p className="text-gray-500">{ownedFilter === 'upcoming' ? 'No courses with upcoming instances.' : "You haven't created any courses yet."}</p>
          ) : (
            <div className="space-y-4">
              {filteredOwned.map(course => (
                <div key={course.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  {editingCourseId === course.id ? (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Edit Course</h3>
                      <input type="text" placeholder="Title *" value={courseForm.title} onChange={e => setCourseForm({ ...courseForm, title: e.target.value })} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500" />
                      <textarea placeholder="Description" value={courseForm.description} rows={2} onChange={e => setCourseForm({ ...courseForm, description: e.target.value })} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500" />
                      <input type="number" placeholder="Price *" value={courseForm.price} onChange={e => setCourseForm({ ...courseForm, price: e.target.value })} className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500" />
                      {error && <p className="text-red-400 text-sm">{error}</p>}
                      <div className="flex gap-3">
                        <button onClick={handleSaveCourse} disabled={savingCourse} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-full transition">{savingCourse ? 'Saving...' : 'Save Changes'}</button>
                        <button onClick={handleCancelCourse} className="text-gray-400 hover:text-white text-sm px-4 py-2 transition">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <Link href={`/course/${course.id}`} className="text-lg font-semibold hover:text-indigo-400 transition">{course.title}</Link>
                          <p className="text-gray-400 text-sm">{course.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-indigo-400 font-bold">${course.price}</span>
                          <button onClick={() => handleEditCourse(course)} className="text-gray-400 hover:text-white text-sm transition">Edit</button>
                          <button onClick={() => handleDeleteCourse(course.id, course.title)} className="text-red-400 hover:text-red-300 text-sm transition">Delete</button>
                        </div>
                      </div>

                      {/* Course images */}
                      <div className="flex gap-3 mb-4">
                        <div className="flex-1 relative h-28 bg-gray-800 rounded-lg overflow-hidden group">
                          {course.banner_url
                            ? <img src={course.banner_url} alt="Banner" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No banner</div>
                          }
                          <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/50 transition cursor-pointer">
                            <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition">
                              {uploadingImage?.courseId === course.id && uploadingImage?.type === 'banner' ? 'Uploading...' : '📷 Set banner'}
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCourseImageUpload(course.id, f, 'banner'); e.target.value = '' }} />
                          </label>
                        </div>
                        <div className="relative w-28 h-28 bg-gray-800 rounded-lg overflow-hidden group flex-shrink-0">
                          {course.profile_pic_url
                            ? <img src={course.profile_pic_url} alt="Profile" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs text-center px-2">No profile pic</div>
                          }
                          <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/50 transition cursor-pointer">
                            <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition text-center px-1">
                              {uploadingImage?.courseId === course.id && uploadingImage?.type === 'profile_pic' ? 'Uploading...' : '📷 Set pic'}
                            </span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCourseImageUpload(course.id, f, 'profile_pic'); e.target.value = '' }} />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {course.course_instance.map(inst => (
                          <div key={inst.course_instance_id}>
                            {editingInstance?.instanceId === inst.course_instance_id ? (
                              <div className="bg-gray-800 border border-indigo-500 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-semibold">Edit Instance</h4>
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
                                <input type="text" placeholder="Facebook group invite URL" value={instanceForm.fb_group_invite_url} onChange={e => setInstanceForm({ ...instanceForm, fb_group_invite_url: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500 text-sm" />
                                {error && <p className="text-red-400 text-xs">{error}</p>}
                                <div className="flex gap-3">
                                  <button onClick={() => handleSaveInstance(course.id)} disabled={savingInstance} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition">{savingInstance ? 'Saving...' : 'Save Changes'}</button>
                                  <button onClick={handleCancelInstance} className="text-gray-400 hover:text-white text-xs px-3 py-2 transition">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center bg-gray-800 rounded-lg px-4 py-2">
                                <span className="text-sm text-gray-300">{formatDate(inst.start_date)} – {formatDate(inst.end_date)}</span>
                                <div className="flex items-center gap-3">
                                  <Link href={`/course/${course.id}/instance/${inst.course_instance_id}`} className="text-xs text-indigo-400 hover:text-indigo-300 transition">View enrolments →</Link>
                                  <button onClick={() => handleEditInstance(course.id, inst)} className="text-gray-400 hover:text-white text-xs transition">Edit</button>
                                  <button onClick={() => handleDeleteInstance(course.id, inst.course_instance_id)} className="text-red-400 hover:text-red-300 text-xs transition">Delete</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {showInstanceForm === course.id && !editingInstance && (
                          <div className="bg-gray-800 border border-indigo-500 rounded-lg p-4 space-y-3 mt-2">
                            <h4 className="text-sm font-semibold">New Instance</h4>
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
                            <input type="text" placeholder="Facebook group invite URL" value={instanceForm.fb_group_invite_url} onChange={e => setInstanceForm({ ...instanceForm, fb_group_invite_url: e.target.value })} className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg outline-none border border-gray-600 focus:border-indigo-500 text-sm" />
                            {error && <p className="text-red-400 text-xs">{error}</p>}
                            <div className="flex gap-3">
                              <button onClick={() => handleSaveInstance(course.id)} disabled={savingInstance} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition">{savingInstance ? 'Saving...' : 'Add Instance'}</button>
                              <button onClick={handleCancelInstance} className="text-gray-400 hover:text-white text-xs px-3 py-2 transition">Cancel</button>
                            </div>
                          </div>
                        )}

                        {showInstanceForm !== course.id && (
                          <button onClick={() => { setShowInstanceForm(course.id); setEditingInstance(null); setInstanceForm(emptyInstanceForm) }} className="text-xs text-gray-500 hover:text-indigo-400 transition mt-1">
                            + Add instance
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Courses I'm Supporting ── */}
        {supportingInstances.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 text-indigo-400">Courses I'm Supporting</h2>
            <div className="space-y-2">
              {supportingInstances.map(inst => (
                <Link key={inst.course_instance_id} href={`/course/${inst.course.id}/instance/${inst.course_instance_id}`} className="bg-gray-900 border border-gray-800 hover:border-indigo-500 rounded-xl overflow-hidden transition block">
                  <div className="relative h-24 bg-gray-800">
                    {inst.course.banner_url && <img src={inst.course.banner_url} alt="" className="w-full h-full object-cover" />}
                    {inst.course.profile_pic_url && (
                      <img src={inst.course.profile_pic_url} alt="" className="absolute -bottom-4 left-4 w-8 h-8 rounded-full object-cover border-2 border-gray-900" />
                    )}
                  </div>
                  <div className={`flex justify-between items-center px-4 py-3 ${inst.course.profile_pic_url ? 'pt-6' : 'pt-3'}`}>
                    <div>
                      <p className="font-medium">{inst.course.title}</p>
                      <p className="text-sm text-gray-400">{formatDate(inst.start_date)} – {formatDate(inst.end_date)}</p>
                    </div>
                    <span className="text-xs text-indigo-400">View →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Courses I'm Enrolled In ── */}
        <section>
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h2 className="text-xl font-semibold text-indigo-400">Courses I'm Enrolled In</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1">
                <button className={enrolledFilter === 'all' ? activeBtn : inactiveBtn} onClick={() => setEnrolledFilter('all')}>All</button>
                <button className={enrolledFilter === 'upcoming' ? activeBtn : inactiveBtn} onClick={() => setEnrolledFilter('upcoming')}>Upcoming</button>
                <button className={enrolledFilter === 'past' ? activeBtn : inactiveBtn} onClick={() => setEnrolledFilter('past')}>Past</button>
              </div>
              <select
                value={enrolledSort}
                onChange={e => setEnrolledSort(e.target.value as EnrolledSort)}
                className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full outline-none border border-gray-700 focus:border-indigo-500"
              >
                <option value="recent">Recently Added</option>
                <option value="name">Name</option>
                <option value="upcoming">Next Upcoming</option>
              </select>
            </div>
          </div>

          {filteredEnrolled.length === 0 ? (
            <p className="text-gray-500">
              {enrolledFilter === 'upcoming' ? 'No upcoming enrolments.' : enrolledFilter === 'past' ? 'No past enrolments.' : "You haven't enrolled in any courses yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEnrolled.map(inst => (
                <Link key={inst.course_instance_id} href={`/course/${inst.course.id}/instance/${inst.course_instance_id}`} className="bg-gray-900 border border-gray-800 hover:border-indigo-500 rounded-xl overflow-hidden transition block">
                  <div className="relative h-24 bg-gray-800">
                    {inst.course.banner_url && <img src={inst.course.banner_url} alt="" className="w-full h-full object-cover" />}
                    {inst.course.profile_pic_url && (
                      <img src={inst.course.profile_pic_url} alt="" className="absolute -bottom-4 left-4 w-8 h-8 rounded-full object-cover border-2 border-gray-900" />
                    )}
                  </div>
                  <div className={`flex justify-between items-center px-4 py-3 ${inst.course.profile_pic_url ? 'pt-6' : 'pt-3'}`}>
                    <div>
                      <p className="font-medium">{inst.course.title}</p>
                      <p className="text-sm text-gray-400">{formatDate(inst.start_date)} – {formatDate(inst.end_date)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${inst.payment_status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                      {inst.payment_status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
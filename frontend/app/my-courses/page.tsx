'use client'

import { useEffect, useState } from 'react'
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
  course_instance: Instance[]
}

interface EnrolledInstance {
  course_instance_id: string
  start_date: string
  end_date: string
  role: string
  payment_status: string
  course: { id: string; title: string }
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-NZ')
const emptyCourseForm = { title: '', description: '', price: '' }
const emptyInstanceForm = { start_date: '', end_date: '', fb_group_invite_url: '' }

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
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [ownedRes, enrolmentsRes] = await Promise.all([
      supabase
        .from('course')
        .select('id, title, description, price, course_instance(course_instance_id, start_date, end_date, fb_group_invite_url)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('enrolment')
        .select('id, role, status, course_instance_id, course_instance(course_instance_id, start_date, end_date, course(id, title)), orders(status)')
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

  // ── Course CRUD ──────────────────────────────────────────

  const handleSaveCourse = async () => {
    if (!courseForm.title.trim()) return setError('Title is required')
    if (!courseForm.price) return setError('Price is required')
    setSavingCourse(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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
        .insert({ title: courseForm.title, description: courseForm.description, price: parseFloat(courseForm.price), owner_id: user.id })
        .select('id, title, description, price')
        .single()

      if (err) { setError(err.message); setSavingCourse(false); return }
      setOwnedCourses(prev => [{ ...data, course_instance: [] }, ...prev])
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-indigo-400">Courses I Own</h2>
            {!showCourseForm && !editingCourseId && (
              <button
                onClick={() => { setShowCourseForm(true); setCourseForm(emptyCourseForm) }}
                className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold px-4 py-2 rounded-full transition"
              >
                + Add Course
              </button>
            )}
          </div>

          {/* New course form — top level, add only */}
          {showCourseForm && !editingCourseId && (
            <div className="bg-gray-900 border border-indigo-500 rounded-xl p-6 mb-4 space-y-3">
              <h3 className="font-semibold">New Course</h3>
              <input
                type="text"
                placeholder="Title *"
                value={courseForm.title}
                onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
              />
              <textarea
                placeholder="Description"
                value={courseForm.description}
                rows={2}
                onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
              />
              <input
                type="number"
                placeholder="Price *"
                value={courseForm.price}
                onChange={e => setCourseForm({ ...courseForm, price: e.target.value })}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={handleSaveCourse} disabled={savingCourse} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-full transition">
                  {savingCourse ? 'Saving...' : 'Create Course'}
                </button>
                <button onClick={handleCancelCourse} className="text-gray-400 hover:text-white text-sm px-4 py-2 transition">Cancel</button>
              </div>
            </div>
          )}

          {ownedCourses.length === 0 && !showCourseForm ? (
            <p className="text-gray-500">You haven't created any courses yet.</p>
          ) : (
            <div className="space-y-4">
              {ownedCourses.map(course => (
                <div key={course.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">

                  {/* Inline edit form */}
                  {editingCourseId === course.id ? (
                    <div className="space-y-3">
                      <h3 className="font-semibold">Edit Course</h3>
                      <input
                        type="text"
                        placeholder="Title *"
                        value={courseForm.title}
                        onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                        className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
                      />
                      <textarea
                        placeholder="Description"
                        value={courseForm.description}
                        rows={2}
                        onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                        className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
                      />
                      <input
                        type="number"
                        placeholder="Price *"
                        value={courseForm.price}
                        onChange={e => setCourseForm({ ...courseForm, price: e.target.value })}
                        className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg outline-none border border-gray-700 focus:border-indigo-500"
                      />
                      {error && <p className="text-red-400 text-sm">{error}</p>}
                      <div className="flex gap-3">
                        <button onClick={handleSaveCourse} disabled={savingCourse} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-full transition">
                          {savingCourse ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button onClick={handleCancelCourse} className="text-gray-400 hover:text-white text-sm px-4 py-2 transition">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Course header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-semibold">{course.title}</h3>
                          <p className="text-gray-400 text-sm">{course.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-indigo-400 font-bold">${course.price}</span>
                          <button onClick={() => handleEditCourse(course)} className="text-gray-400 hover:text-white text-sm transition">Edit</button>
                          <button onClick={() => handleDeleteCourse(course.id, course.title)} className="text-red-400 hover:text-red-300 text-sm transition">Delete</button>
                        </div>
                      </div>

                      {/* Instances */}
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
                                  <button onClick={() => handleSaveInstance(course.id)} disabled={savingInstance} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition">
                                    {savingInstance ? 'Saving...' : 'Save Changes'}
                                  </button>
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

                        {/* Add instance form */}
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
                              <button onClick={() => handleSaveInstance(course.id)} disabled={savingInstance} className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-full transition">
                                {savingInstance ? 'Saving...' : 'Add Instance'}
                              </button>
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
                <Link key={inst.course_instance_id} href={`/course/${inst.course.id}/instance/${inst.course_instance_id}`} className="flex justify-between items-center bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl px-6 py-4 transition">
                  <div>
                    <p className="font-medium">{inst.course.title}</p>
                    <p className="text-sm text-gray-400">{formatDate(inst.start_date)} – {formatDate(inst.end_date)}</p>
                  </div>
                  <span className="text-xs text-indigo-400">View →</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Courses I'm Enrolled In ── */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">Courses I'm Enrolled In</h2>
          {enrolledInstances.length === 0 ? (
            <p className="text-gray-500">You haven't enrolled in any courses yet.</p>
          ) : (
            <div className="space-y-2">
              {enrolledInstances.map(inst => (
                <Link key={inst.course_instance_id} href={`/course/${inst.course.id}/instance/${inst.course_instance_id}`} className="flex justify-between items-center bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl px-6 py-4 transition">
                  <div>
                    <p className="font-medium">{inst.course.title}</p>
                    <p className="text-sm text-gray-400">{formatDate(inst.start_date)} – {formatDate(inst.end_date)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${inst.payment_status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
                    {inst.payment_status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
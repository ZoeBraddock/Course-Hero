'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Navbar from '../../components/navbar'

interface CourseInstance {
  course_instance_id: string
  start_date: string
  end_date: string
}

interface Course {
  id: string
  title: string
  description: string
  price: number
  course_instance: CourseInstance[]
}

export default function CourseDetail() {
  const { id } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCourse = async () => {
      const { data: courseData, error: courseError } = await supabase
        .from('course')
        .select('id, title, description, price')
        .eq('id', id)
        .single()

      if (courseError || !courseData) {
        setError('Course not found')
        return
      }

      const { data: instances } = await supabase
        .from('course_instance')
        .select('course_instance_id, start_date, end_date')
        .eq('course_id', id)

      const instanceList = instances ?? []
      setCourse({ ...courseData, course_instance: instanceList })

      if (instanceList.length === 1) {
        setSelectedInstance(instanceList[0].course_instance_id)
      }
    }

    fetchCourse()
  }, [id])

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user?.email) setEmail(data.user.email)
    }
    getUser()
  }, [])

  const handleEnrol = async () => {
    if (!selectedInstance) return setError('Please select a course instance')
    if (!email) return setError('Please enter your email')

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseInstanceId: selectedInstance,
          email,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      window.location.href = data.url
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (error && !course) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Navbar />
        <p className="text-red-400">{error}</p>
      </main>
    )
  }

  if (!course) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Navbar />
        <p className="text-gray-400">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar />
      <div className="bg-gray-900 rounded-2xl p-10 border border-gray-800 w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-4">{course.title}</h1>
        <p className="text-gray-400 mb-6">{course.description}</p>
        <p className="text-2xl font-bold text-indigo-400 mb-8">${course.price}</p>

        {course.course_instance?.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Select a date</label>
            <select
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-indigo-500 outline-none"
            >
              <option value="">Choose an instance...</option>
              {course.course_instance.map((inst) => (
                <option key={inst.course_instance_id} value={inst.course_instance_id}>
                  {new Date(inst.start_date).toLocaleDateString('en-NZ')} –{' '}
                  {new Date(inst.end_date).toLocaleDateString('en-NZ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {course.course_instance?.length === 0 && (
          <p className="text-gray-500 text-sm mb-6">No upcoming dates scheduled yet.</p>
        )}

        {course.course_instance?.length > 0 && (
          <>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-6 outline-none border border-gray-700 focus:border-indigo-500"
            />

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <button
              onClick={handleEnrol}
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition"
            >
              {loading ? 'Redirecting to payment...' : 'Enrol Now'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import Navbar from './components/navbar'
import SignUpButton from './components/sign-up-button'

interface Instance {
  start_date: string
  end_date: string
}

interface Course {
  id: string
  title: string
  description: string
  price: number
  name: string | null
  created_at: string
  course_instance: Instance[]
}

type Filter = 'all' | 'upcoming'
type Sort = 'recent' | 'name' | 'upcoming'

const today = new Date().toISOString().split('T')[0]

const hasUpcoming = (course: Course) =>
  course.course_instance.some(i => i.start_date >= today)

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')

  useEffect(() => {
    supabase
      .from('course')
      .select('id, title, description, price, name, created_at, course_instance(start_date, end_date)')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setCourses((data as Course[]) ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    let result = filter === 'upcoming' ? courses.filter(hasUpcoming) : [...courses]

    if (sort === 'recent') result.sort((a, b) => b.created_at.localeCompare(a.created_at))
    else if (sort === 'name') result.sort((a, b) => a.title.localeCompare(b.title))
    else if (sort === 'upcoming') {
      result.sort((a, b) => {
        const aNext = a.course_instance.filter(i => i.start_date >= today).sort()[0]?.start_date ?? '9999'
        const bNext = b.course_instance.filter(i => i.start_date >= today).sort()[0]?.start_date ?? '9999'
        return aNext.localeCompare(bNext)
      })
    }

    return result
  }, [courses, filter, sort])

  const btnBase = 'px-4 py-1.5 rounded-full text-sm font-medium transition'
  const active = `${btnBase} bg-indigo-500 text-white`
  const inactive = `${btnBase} bg-gray-800 text-gray-400 hover:text-white`

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-indigo-900 to-purple-900 py-24 px-8 text-center">
        <h1 className="text-5xl font-bold mb-4">Course Hero</h1>
        <p className="text-xl text-indigo-200 mb-2">Here to save you from course based admin!</p>
        <p className="text-gray-300 max-w-2xl mx-auto mb-8">
          Sick of admin getting in the way of running a course?<br />
          Say goodbye to the hassle and hello to more time for teaching and learning.<br />
          Sign up now and experience the freedom of a course without admin!
        </p>
        <SignUpButton />
      </section>

      {/* Courses */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-1">Available Courses</h2>
            <p className="text-gray-400">Browse our current course catalogue</p>
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Filter */}
            <div className="flex gap-2">
              <button className={filter === 'all' ? active : inactive} onClick={() => setFilter('all')}>All</button>
              <button className={filter === 'upcoming' ? active : inactive} onClick={() => setFilter('upcoming')}>Upcoming</button>
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value as Sort)}
              className="bg-gray-800 text-gray-300 text-sm px-4 py-1.5 rounded-full outline-none border border-gray-700 focus:border-indigo-500"
            >
              <option value="recent">Recently Added</option>
              <option value="name">Name</option>
              <option value="upcoming">Next Upcoming</option>
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 mb-6">{error}</p>}

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">No courses found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(course => (
              <Link
                href={`/course/${course.id}`}
                key={course.id}
                className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-indigo-500 transition block"
              >
                <h3 className="text-xl font-semibold mb-2">{course.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{course.description}</p>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-indigo-400 text-sm">{course.name}</span>
                  <div className="flex items-center gap-3">
                    {hasUpcoming(course) && (
                      <span className="text-xs text-green-400 font-medium">Upcoming</span>
                    )}
                    <span className="text-white font-bold">${course.price}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
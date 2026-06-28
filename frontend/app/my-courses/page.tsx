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
}

interface OwnedCourse {
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

export default function MyCourses() {
  const [ownedCourses, setOwnedCourses] = useState<OwnedCourse[]>([])
  const [enrolledInstances, setEnrolledInstances] = useState<EnrolledInstance[]>([])
  const [supportingInstances, setSupportingInstances] = useState<EnrolledInstance[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [ownedRes, enrolmentsRes] = await Promise.all([
        supabase
          .from('course')
          .select('id, title, description, price, course_instance(course_instance_id, start_date, end_date)')
          .eq('owner_id', user.id),
        supabase
          .from('enrolment')
          .select(`
            id, role, status, course_instance_id,
            course_instance(course_instance_id, start_date, end_date, course(id, title)),
            orders(status)
          `)
          .eq('profile_id', user.id),
      ])

      console.log('user.id:', user.id)
      console.log('enrolments data:', enrolmentsRes.data)
      console.log('enrolments error:', enrolmentsRes.error)
      console.log('owned data:', ownedRes.data)
      console.log('owned error:', ownedRes.error)

      const owned = ownedRes.data
      const enrolments = enrolmentsRes.data

      setOwnedCourses((owned as OwnedCourse[]) ?? [])

      const enrolled: EnrolledInstance[] = []
      const supporting: EnrolledInstance[] = []

      for (const e of enrolments ?? []) {
        const ci = e.course_instance as any
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

    load()
  }, [])

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

        <section>
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">Courses I Own</h2>
          {ownedCourses.length === 0 ? (
            <p className="text-gray-500">You haven't created any courses yet.</p>
          ) : (
            <div className="space-y-4">
              {ownedCourses.map((course) => (
                <div key={course.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">{course.title}</h3>
                      <p className="text-gray-400 text-sm">{course.description}</p>
                    </div>
                    <span className="text-indigo-400 font-bold">${course.price}</span>
                  </div>
                  {course.course_instance.length === 0 ? (
                    <p className="text-gray-600 text-sm">No instances yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {course.course_instance.map((inst) => (
                        <Link
                          key={inst.course_instance_id}
                          href={`/course/${course.id}/instance/${inst.course_instance_id}`}
                          className="flex justify-between items-center bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2 transition"
                        >
                          <span className="text-sm text-gray-300">
                            {formatDate(inst.start_date)} – {formatDate(inst.end_date)}
                          </span>
                          <span className="text-xs text-indigo-400">View enrolments →</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {supportingInstances.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 text-indigo-400">Courses I'm Supporting</h2>
            <div className="space-y-2">
              {supportingInstances.map((inst) => (
                <Link
                  key={inst.course_instance_id}
                  href={`/course/${inst.course.id}/instance/${inst.course_instance_id}`}
                  className="flex justify-between items-center bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl px-6 py-4 transition"
                >
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

        <section>
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">Courses I'm Enrolled In</h2>
          {enrolledInstances.length === 0 ? (
            <p className="text-gray-500">You haven't enrolled in any courses yet.</p>
          ) : (
            <div className="space-y-2">
              {enrolledInstances.map((inst) => (
                <Link
                  key={inst.course_instance_id}
                  href={`/course/${inst.course.id}/instance/${inst.course_instance_id}`}
                  className="flex justify-between items-center bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl px-6 py-4 transition"
                >
                  <div>
                    <p className="font-medium">{inst.course.title}</p>
                    <p className="text-sm text-gray-400">{formatDate(inst.start_date)} – {formatDate(inst.end_date)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    inst.payment_status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'
                  }`}>
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
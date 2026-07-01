'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../../lib/supabase'
import Navbar from '../../../../components/navbar'

interface Student {
  enrolment_id: string
  profile_id: string
  role: string
  status: string
  created_at: string
  full_name: string | null
  email: string | null
  fb_profile_url: string | null
  payment_status: string | null
  amount: number | null
}

interface InstanceDetail {
  course_instance_id: string
  start_date: string
  end_date: string
  fb_group_invite_url: string | null
  course: {
    id: string
    title: string
    description: string
    price: number
    owner_id: string
    banner_url: string | null
  }
}

const ROLES = ['student', 'instructor', 'owner']

export default function InstanceDetail() {
  const { id, instanceId } = useParams()
  const router = useRouter()
  const [instance, setInstance] = useState<InstanceDetail | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [myEnrolment, setMyEnrolment] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: inst } = await supabase
        .from('course_instance')
        .select('course_instance_id, start_date, end_date, fb_group_invite_url, course!course_instance_course_id_fkey(id, title, description, price, owner_id, banner_url)')
        .eq('course_instance_id', instanceId)
        .single()

      if (!inst) { router.push('/my-courses'); return }
      setInstance(inst as any)

      const ownerCheck = (inst.course as any)?.owner_id === user.id
      setIsOwner(ownerCheck)

      if (ownerCheck) {
        const { data: enrolments } = await supabase
          .from('enrolment')
          .select(`id, profile_id, role, status, created_at, profiles ( full_name, email, fb_profile_url ), orders ( status, amount )`)
          .eq('course_instance_id', instanceId)

        setStudents((enrolments ?? []).map((e: any) => ({
          enrolment_id: e.id,
          profile_id: e.profile_id,
          role: e.role,
          status: e.status,
          created_at: e.created_at,
          full_name: e.profiles?.full_name ?? null,
          email: e.profiles?.email ?? null,
          fb_profile_url: e.profiles?.fb_profile_url ?? null,
          payment_status: e.orders?.[0]?.status ?? null,
          amount: e.orders?.[0]?.amount ?? null,
        })))
      } else {
        const { data: myE } = await supabase
          .from('enrolment')
          .select(`id, profile_id, role, status, created_at, profiles ( full_name, email, fb_profile_url ), orders ( status, amount )`)
          .eq('course_instance_id', instanceId)
          .eq('profile_id', user.id)
          .single()

        if (myE) {
          setMyEnrolment({
            enrolment_id: myE.id,
            profile_id: myE.profile_id,
            role: myE.role,
            status: myE.status,
            created_at: myE.created_at,
            full_name: (myE.profiles as any)?.full_name ?? null,
            email: (myE.profiles as any)?.email ?? null,
            fb_profile_url: (myE.profiles as any)?.fb_profile_url ?? null,
            payment_status: (myE.orders as any[])?.[0]?.status ?? null,
            amount: (myE.orders as any[])?.[0]?.amount ?? null,
          })
        }
      }

      setLoading(false)
    }

    load()
  }, [id, instanceId])

  const handleRoleChange = async (enrolmentId: string, newRole: string) => {
    setRoleUpdating(enrolmentId)
    await supabase.from('enrolment').update({ role: newRole }).eq('id', enrolmentId)
    setStudents(prev => prev.map(s => s.enrolment_id === enrolmentId ? { ...s, role: newRole } : s))
    setRoleUpdating(null)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-NZ')

  if (loading) return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar /><p className="text-gray-400">Loading...</p>
    </main>
  )

  if (!instance) return null

  const course = instance.course as any

  return (
    <main className="min-h-screen bg-gray-950 text-white pt-20 pb-16">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 space-y-4 mt-8">

        {/* Banner */}
        <div className="relative w-full h-48 sm:h-64 bg-gray-900 rounded-2xl overflow-hidden">
          {course.banner_url
            ? <img src={course.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
            : <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-900" />
          }
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <button onClick={() => router.push('/my-courses')} className="text-gray-300 hover:text-white text-sm transition mb-2 block">← My Courses</button>
            <h1 className="text-2xl font-bold text-white">{course.title}</h1>
          </div>
        </div>

        {/* Course + instance info */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Course</p>
            <p className="text-gray-300 text-sm">{course.description}</p>
            <p className="text-indigo-400 font-bold text-lg pt-2">${course.price}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">This Instance</p>
            <p className="text-gray-300 text-sm">
              <span className="text-gray-500">Dates: </span>
              {formatDate(instance.start_date)} – {formatDate(instance.end_date)}
            </p>
            {instance.fb_group_invite_url && (
              <p className="text-gray-300 text-sm">
                <span className="text-gray-500">Facebook group: </span>
                <a href={instance.fb_group_invite_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Join link</a>
              </p>
            )}
          </div>
        </div>

        {/* Owner view: enrolments */}
        {isOwner && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold mb-4">Enrolments <span className="text-gray-500 font-normal text-sm">({students.length})</span></h2>
            {students.length === 0 ? (
              <p className="text-gray-500 text-sm">No one enrolled yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800 text-left">
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">Email</th>
                      <th className="pb-3 pr-4">Facebook</th>
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 pr-4">Payment</th>
                      <th className="pb-3">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {students.map(s => (
                      <tr key={s.enrolment_id} className="text-gray-300">
                        <td className="py-3 pr-4">{s.full_name ?? '—'}</td>
                        <td className="py-3 pr-4">{s.email ?? '—'}</td>
                        <td className="py-3 pr-4">
                          {s.fb_profile_url
                            ? <a href={s.fb_profile_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Profile</a>
                            : '—'
                          }
                        </td>
                        <td className="py-3 pr-4">
                          <select
                            value={s.role}
                            disabled={roleUpdating === s.enrolment_id}
                            onChange={e => handleRoleChange(s.enrolment_id, e.target.value)}
                            className="bg-gray-800 text-white text-xs px-2 py-1 rounded-lg border border-gray-700 outline-none"
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.payment_status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900/60 text-yellow-400'}`}>
                            {s.payment_status ?? 'unknown'}
                          </span>
                        </td>
                        <td className="py-3 text-gray-500 text-xs">{formatDate(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Student view: own enrolment */}
        {!isOwner && myEnrolment && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold mb-4">My Enrolment</h2>
            <div className="space-y-3 text-sm">
              <p className="text-gray-300">
                <span className="text-gray-500">Role: </span>
                <span className="capitalize">{myEnrolment.role}</span>
              </p>
              <p className="text-gray-300">
                <span className="text-gray-500">Payment: </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${myEnrolment.payment_status === 'paid' ? 'bg-green-900 text-green-400' : 'bg-yellow-900/60 text-yellow-400'}`}>
                  {myEnrolment.payment_status ?? 'unknown'}
                </span>
              </p>
              <p className="text-gray-300">
                <span className="text-gray-500">Enrolled: </span>
                {formatDate(myEnrolment.created_at)}
              </p>
            </div>
          </div>
        )}

        {!isOwner && !myEnrolment && (
          <p className="text-gray-500 text-sm">You are not enrolled in this instance.</p>
        )}
      </div>
    </main>
  )
}

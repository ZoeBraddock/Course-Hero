import { supabase } from '../../../lib/supabase'
import Navbar from '../../components/navbar'

export const revalidate = 0

export default async function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: course, error } = await supabase
    .from('course')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !course) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Navbar />
        <p className="text-red-400">Course not found</p>
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
        <button className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 rounded-full transition">
          Enrol Now
        </button>
      </div>
    </main>
  )
}
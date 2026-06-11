import Link from 'next/dist/client/link'
import { supabase } from '../lib/supabase'
import Navbar from './components/navbar'

export const revalidate = 0
export default async function Home() {
  const { data: courses, error } = await supabase
    .from('course')
    .select('*')

  if (error) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-red-400">Error loading courses: {error.message}</p>
      </main>
    )
  }

  return (
    
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-indigo-900 to-purple-900 py-24 px-8 text-center">
        <h1 className="text-5xl font-bold mb-4">Course Hero</h1>
        <p className="text-xl text-indigo-200 mb-2">Here to save you from course based admin!</p>
        <p className="text-gray-300 max-w-2xl mx-auto mb-8">
          Sick of admin getting in the way of running a course?  <br></br>
          Say goodbye to the hassle and hello to more time for teaching and learning. <br></br>
          Sign up now and experience the freedom of a course without admin!
        </p>
        <Link href="/signup" className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold px-8 py-3 rounded-full transition">
          Sign Up Free
        </Link>
      </section>

      {/* Courses Section */}
      <section className="max-w-6xl mx-auto px-8 py-16">
        <h2 className="text-3xl font-bold mb-2">Available Courses</h2>
        <p className="text-gray-400 mb-10">Browse our current course catalogue</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link href={`/course/${course.id}`} key={course.id} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-indigo-500 transition block">
              <h3 className="text-xl font-semibold mb-2">{course.title}</h3>
              <p className="text-gray-400 text-sm mb-4">{course.description}</p>
              <div className="flex justify-between items-center mt-auto">
                <span className="text-indigo-400 text-sm">{course.name}</span>
                <span className="text-white font-bold">${course.price}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

    </main>
  )
}
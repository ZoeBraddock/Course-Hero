'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function CreateCourse() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
      }
    }
    getUser()
  }, [])

  const handleCreateCourse = async () => {
    const { error } = await supabase.from('course').insert({
      title: title,
      description: description,
      price: parseFloat(price),
      primary_instructor: user.id,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Course created!')
      setTitle('')
      setDescription('')
      setPrice('')
    }
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="bg-gray-900 p-10 rounded-2xl border border-gray-800 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2">Create a Course</h1>
        <p className="text-gray-400 mb-8">Add a new course to Course Hero</p>

        <form onSubmit={(e) => { e.preventDefault(); handleCreateCourse(); }}>
          <input
            type="text"
            placeholder="Course Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-4 outline-none border border-gray-700 focus:border-indigo-500"
          />
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-4 outline-none border border-gray-700 focus:border-indigo-500"
          />
          <input
            type="number"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-6 outline-none border border-gray-700 focus:border-indigo-500"
          />

          <button
            type="submit"
            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 rounded-full transition"
          >
            Create Course
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-gray-300">{message}</p>}
      </div>
    </main>
  )
}
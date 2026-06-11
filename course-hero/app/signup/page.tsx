'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSignUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Success! Account created.')
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="bg-gray-900 p-10 rounded-2xl border border-gray-800 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2">Create an Account</h1>
        <p className="text-gray-400 mb-8">Join Course Hero today</p>

        <input
          type="email"
          placeholder="Email"
          value={email}   
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-4 outline-none border border-gray-700 focus:border-indigo-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-6 outline-none border border-gray-700 focus:border-indigo-500"
        />

        <button
          onClick={handleSignUp}
          className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 rounded-full transition"
        >
          Sign Up
        </button>

        {message && <p className="mt-4 text-sm text-gray-300">{message}</p>}
      </div>
    </main>
  )
}
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import Navbar from '../components/navbar'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSignUp = async () => {
    setError('')
    const { error: err } = await supabase.auth.signUp({ email, password })
    if (err) setError(err.message)
    else setSuccess(true)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar />
      <div className="bg-gray-900 p-10 rounded-2xl border border-gray-800 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2">Create an Account</h1>
        <p className="text-gray-400 mb-8">Join Course Hero today</p>

        {success ? (
          <div className="text-center space-y-3">
            <p className="text-green-400 font-medium">Check your email to confirm your account.</p>
            <p className="text-gray-500 text-sm">Once confirmed you can <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition">log in</Link>.</p>
          </div>
        ) : (
          <>
            <form onSubmit={e => { e.preventDefault(); handleSignUp() }}>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-4 outline-none border border-gray-700 focus:border-indigo-500"
              />
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-6 outline-none border border-gray-700 focus:border-indigo-500"
              />
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 rounded-full transition">
                Sign Up
              </button>
            </form>

            <p className="text-gray-500 text-sm mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition">Log in</Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}

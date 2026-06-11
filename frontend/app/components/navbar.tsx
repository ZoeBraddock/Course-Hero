import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-10 flex justify-between items-center px-6 py-4 bg-gray-950 border-b border-gray-800 h-20">
      <Link href="/" className="text-white font-bold text-lg">
        Course Hero
      </Link>
      <div className="flex gap-4">
        <Link href="/" className="text-gray-300 hover:text-white transition">
          Home
        </Link>
        <Link href="/create-course" className="text-gray-300 hover:text-white transition">
          Create Course
        </Link>
        <Link href="/login" className="text-gray-300 hover:text-white transition">
          Log In
        </Link>
        <Link href="/signup" className="text-gray-300 hover:text-white transition">
          Sign Up
        </Link>
      </div>
    </nav>
  )
}
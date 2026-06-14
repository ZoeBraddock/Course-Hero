import Navbar from '../components/navbar'

export default function EnrolmentSuccess() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Navbar />
      <div className="bg-gray-900 rounded-2xl p-10 border border-gray-800 w-full max-w-lg text-center">
        <div className="text-5xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-4">You're enrolled!</h1>
        <p className="text-gray-400 mb-2">Payment confirmed. Check your email for next steps.</p>
        <p className="text-gray-500 text-sm">You'll receive a Facebook group invite link shortly.</p>
      </div>
    </main>
  )
}
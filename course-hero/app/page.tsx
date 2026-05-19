import { supabase } from '../lib/supabase'

export default async function Home() {
  const { data: courses, error } = await supabase
    .from('course')
    .select('*')

  if (error) {
    return <main><p>Error loading courses: {error.message}</p></main>
  }

  return (
    <main>
      <h1>Course Hero - Here to save you from course based admin!</h1><br></br>
      <p>Sick of admin getting in the way of running a course? Well have we got the deal for you!</p><br></br>
      <p>Course Hero is here to save you from course based admin! With our easy to use platform, you can say goodbye to the hassle of managing your course and hello to more time for teaching and learning.</p><br></br>
      <p>Sign up now and experience the freedom of a course without admin!</p><br></br>

      <h2>Courses</h2>
      {courses.map((course) => (
        <div key={course.id}>
          <h3>{course.name}</h3>
          <p>{course.description}</p>
        </div>
      ))}
    </main>
  )
}
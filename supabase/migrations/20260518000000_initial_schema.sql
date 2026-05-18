-- Students (profile row per auth user)
create table public.student (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  facebook_name text,
  facebook_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Instructors (profile row per auth user)
create table public.instructor (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique not null,
  bio text,
  facebook_name text,
  facebook_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Courses
create table public.course (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  primary_instructor text not null,
  price numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Student enrollments
create table public.student_course (
  student_id uuid not null references public.student(id) on delete cascade,
  course_id  uuid not null references public.course(id)  on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (student_id, course_id)
);

-- Instructor assignments, as a course might have multiple instructors
create table public.instructor_course (
  instructor_id uuid not null references public.instructor(id) on delete cascade,
  course_id     uuid not null references public.course(id)     on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (instructor_id, course_id)
);

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student(id) on delete restrict,
  course_id  uuid not null references public.course(id)  on delete restrict,
  amount numeric(10,2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.student            enable row level security;
alter table public.instructor         enable row level security;
alter table public.course             enable row level security;
alter table public.student_course     enable row level security;
alter table public.instructor_course  enable row level security;
alter table public.orders             enable row level security;

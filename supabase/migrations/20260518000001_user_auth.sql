-- Create a table for public profiles
alter table orders
drop constraint orders_student_id_fkey;

drop table if exists public.student_course;
drop table if exists public.instructor_course;
drop table if exists public.student;
drop table if exists public.instructor;

create table profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  website text,
  email text unique not null,
  bio text, 
  facebook_name text,
  facebook_id text unique,
  instructor bool,
  constraint username_length check (char_length(username) >= 3)
);

alter table orders
ADD CONSTRAINT orders_student_id_fkey
FOREIGN KEY (student_id) REFERENCES public.profiles(id);

create table profile_course (
  profile_id uuid not null references public.profile(id) on delete cascade,
  course_id  uuid not null references public.course(id)  on delete cascade,
  enrolled_at timestamptz not null default now(),
  course_instructor bool,
  primary key (profile_id, course_id)
);

alter table course
add constraint course_primary_instructor_fkey
foreign key (primary_instructor) references public.profiles(id);

-- Grant the privileges roles need
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/database/postgres/row-level-security for more details.
alter table profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check ((select auth.uid()) = id);

create policy "Users can update own profile." on profiles
  for update using ((select auth.uid()) = id);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Set up Storage!
insert into storage.buckets (id, name)
  values ('avatars', 'avatars');

-- Set up access controls for storage.
-- See https://supabase.com/docs/guides/storage/security/access-control#policy-examples for more details.
create policy "Avatar images are publicly accessible." on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Anyone can upload an avatar." on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy "Anyone can update their own avatar." on storage.objects
  for update using ((select auth.uid()) = owner) with check (bucket_id = 'avatars');
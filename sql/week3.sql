-- Auto-create a free subscription row for every new user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (user_id) values (new.id);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Speeds up the rate-limit and quota queries
create index if not exists idx_submissions_form_created on submissions (form_id, created_at);
create index if not exists idx_submissions_form_ip on submissions (form_id, ip_hash, created_at);

-- Let users read only their own subscription
alter table subscriptions enable row level security;
create policy "read own subscription" on subscriptions
  for select using (auth.uid() = user_id);

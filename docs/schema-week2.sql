alter table forms
  add column recaptcha_on boolean default false,
  add column allowed_domain text;

alter table submissions add column ip_hash text;

create table files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  storage_path text not null,
  size_bytes int
);

create table webhooks (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade,
  target_url text not null,
  active boolean default true
);

create table webhook_logs (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid references webhooks(id) on delete cascade,
  status_code int,
  sent_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  stripe_customer_id text,
  status text default 'free',
  monthly_quota int default 50
);
create extension if not exists pgcrypto;

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text,
  city text,
  state text,
  country text default 'Brasil',
  site text,
  instagram text,
  whatsapp text,
  description text,
  average_ticket numeric,
  service_capacity text,
  positioning text,
  differentiators text,
  tone_of_voice text,
  communication_restrictions text,
  forbidden_words text,
  forbidden_promises text,
  strategic_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table company_dna (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  positioning text,
  value_proposition text,
  tone_of_voice text,
  main_audience text,
  audience_pains text,
  audience_desires text,
  common_objections text,
  available_proofs text,
  differentiators text,
  recurring_offers text,
  commercial_limits text,
  legal_ethic_restrictions text,
  visual_style text,
  brand_colors text,
  communication_references text,
  good_campaign_examples text,
  bad_campaign_examples text,
  vertice_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  type text,
  short_description text,
  full_description text,
  average_ticket numeric,
  estimated_margin numeric,
  target_audience text,
  main_pain text,
  main_desire text,
  objections text,
  proofs text,
  differentiators text,
  benefits text,
  delivery_method text,
  delivery_time text,
  seasonality text,
  current_offer text,
  preferred_cta text,
  current_conversion_destination text,
  status text default 'ativo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  name text not null,
  promise text,
  condition text,
  bonus text,
  guarantee text,
  urgency text,
  scarcity text,
  price numeric,
  discount text,
  cta text,
  rules text,
  limits text,
  notes text,
  status text default 'ativa',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table demand_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid,
  session_type text not null,
  objective text,
  product_id uuid references products(id),
  offer_id uuid references offers(id),
  status text default 'collecting_context',
  collected_context jsonb default '{}'::jsonb,
  agent_decisions jsonb default '[]'::jsonb,
  generated_assets jsonb default '[]'::jsonb,
  approvals jsonb default '[]'::jsonb,
  next_action text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table session_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references demand_sessions(id) on delete cascade,
  role text not null,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  session_id uuid references demand_sessions(id),
  product_id uuid references products(id),
  offer_id uuid references offers(id),
  name text not null,
  objective text,
  channel text,
  funnel_type text,
  destination_type text,
  budget_daily numeric,
  budget_total numeric,
  location jsonb default '{}'::jsonb,
  age_min int,
  age_max int,
  meta_campaign_id text,
  meta_status text,
  internal_status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table creative_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  session_id uuid references demand_sessions(id),
  type text not null,
  format text,
  angle text,
  pain text,
  desire text,
  objection text,
  promise text,
  proof text,
  cta text,
  hypothesis text,
  copy_text text,
  script_text text,
  image_prompt text,
  asset_url text,
  meta_creative_id text,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table copy_variations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  creative_asset_id uuid references creative_assets(id) on delete cascade,
  channel text,
  primary_text text,
  headline text,
  description text,
  caption text,
  cta text,
  angle text,
  status text default 'draft',
  created_at timestamptz default now()
);

create table funnel_decisions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  session_id uuid references demand_sessions(id),
  funnel_type text not null,
  reason text,
  steps jsonb default '[]'::jsonb,
  destination_url text,
  whatsapp_message text,
  form_id uuid,
  landing_page_id uuid,
  created_at timestamptz default now()
);

create table landing_pages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  session_id uuid references demand_sessions(id),
  title text,
  slug text,
  page_json jsonb not null default '{}'::jsonb,
  html_export text,
  status text default 'draft',
  published_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table forms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  title text,
  description text,
  fields jsonb default '[]'::jsonb,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  form_id uuid references forms(id),
  name text,
  email text,
  whatsapp text,
  city text,
  source text,
  payload jsonb default '{}'::jsonb,
  status text default 'new',
  created_at timestamptz default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  session_id uuid references demand_sessions(id),
  campaign_id uuid references campaigns(id),
  item_type text not null,
  item_id uuid,
  status text default 'pending',
  requested_by uuid,
  approved_by uuid,
  notes text,
  created_at timestamptz default now(),
  approved_at timestamptz
);

create table meta_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid,
  meta_user_id text,
  ad_account_id text,
  business_id text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  creative_asset_id uuid references creative_assets(id),
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  date_start date,
  date_end date,
  spend numeric,
  impressions int,
  reach int,
  frequency numeric,
  cpm numeric,
  cpc numeric,
  ctr numeric,
  clicks int,
  leads int,
  cost_per_lead numeric,
  results numeric,
  cost_per_result numeric,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  creative_asset_id uuid references creative_assets(id),
  evaluation_type text,
  diagnosis text,
  possible_causes text,
  recommendation text,
  confidence numeric,
  created_at timestamptz default now()
);

create table learned_patterns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  product_id uuid references products(id),
  offer_id uuid references offers(id),
  pattern_type text,
  title text,
  description text,
  evidence jsonb default '{}'::jsonb,
  confidence numeric,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table ai_usage (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid,
  session_id uuid references demand_sessions(id),
  generation_type text,
  model text,
  prompt_tokens int,
  completion_tokens int,
  image_count int,
  estimated_cost numeric,
  status text,
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

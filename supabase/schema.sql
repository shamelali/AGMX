-- ============================================================
-- AGMX V2 — Production Database Schema (Supabase / PostgreSQL)
-- Multi-tenant cooperative governance platform.
--
-- Design rules
--   * Every business table carries organization_id (tenancy boundary).
--   * Row-Level Security (RLS) is enabled on every table.
--   * Votes, resolutions, compliance checks and audit events are
--     append-only: INSERT allowed, UPDATE/DELETE denied.
--   * Demo data (window.MC_DATA in data.js) is NOT migrated here.
--     Production records are created through the API only.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- IDENTITY & TENANCY
-- ------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  type          text not null default 'cooperative',   -- cooperative | partner | federation
  registration_no text,
  state         text,
  zone          text,
  plan          text not null default 'starter',        -- starter | enterprise | platinum | unlimited
  status        text not null default 'active',         -- active | trial | suspended | prospect
  settings      jsonb not null default '{}'::jsonb,     -- UUK ref, quorum %, senior-mode defaults...
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- profiles extend auth.users (Supabase) with role & org binding
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name       text not null,
  role            text not null default 'member',       -- secretary | chairman | treasurer | board | member | admin
  phone           text,
  language        text not null default 'BM',
  senior_mode     boolean not null default false,
  theme           text not null default 'default',
  created_at      timestamptz not null default now()
);

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  member_id       uuid references public.members(id) on delete cascade,  -- link to cooperative member record
  role            text not null default 'member',
  permissions     text[] not null default '{}',
  unique (organization_id, user_id)
);

-- ------------------------------------------------------------
-- COMMERCIAL
-- ------------------------------------------------------------

-- Human-readable lead references for agm_assessments (LD-0001, LD-0002, …)
create sequence public.lead_ref_seq start with 1 increment by 1;
create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,          -- essential_agm | professional_agm | enterprise_agm | governance_os...
  name        text not null,
  type        text not null,                 -- agm_service | subscription
  price_monthly numeric(12,2),
  price_annual  numeric(12,2),
  price_oneoff  numeric(12,2),               -- for AGM service packages
  max_members int,
  features    jsonb not null default '[]'::jsonb
);

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id         uuid not null references public.plans(id),
  status          text not null default 'trialing',   -- trialing | active | past_due | canceled
  current_period_start timestamptz,
  current_period_end   timestamptz,
  created_at      timestamptz not null default now()
);

create table public.agm_assessments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,  -- null until converted
  reference       text unique not null default ('LD-' || lpad(nextval('public.lead_ref_seq')::text, 4, '0')),
  coop_name       text not null,
  coop_reg        text,
  state           text,
  members         int not null,
  agm_date        date,
  mode            text not null,             -- physical | online | hybrid
  expected_attendance int,
  candidates      int not null default 0,
  motions         int not null default 0,
  current_process text not null default 'manual',
  needs_managed   boolean not null default true,
  contact_name    text not null,
  contact_phone   text not null,
  contact_email   text,
  complexity_score int not null,             -- 0..100 (computed by assessment engine)
  recommended_plan uuid references public.plans(id),
  status          text not null default 'lead',  -- lead | contacted | quoted | won | lost
  created_at      timestamptz not null default now()
);

create table public.quotes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_id   uuid references public.agm_assessments(id),
  number          text unique not null,
  status          text not null default 'draft',   -- draft | sent | accepted | declined | expired
  valid_until     date,
  subtotal        numeric(12,2) not null,
  tax             numeric(12,2) not null default 0,
  total           numeric(12,2) not null,
  created_at      timestamptz not null default now()
);

create table public.quote_items (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.quotes(id) on delete cascade,
  plan_id    uuid references public.plans(id),
  description text not null,
  quantity   int not null default 1,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id        uuid references public.quotes(id),
  number          text unique not null,
  status          text not null default 'unpaid',   -- unpaid | paid | overdue | void
  issued_at       date not null default current_date,
  due_at          date,
  amount          numeric(12,2) not null,
  paid_at         timestamptz
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  method          text not null,             -- fpx | card | bank_transfer | manual
  reference       text,
  amount          numeric(12,2) not null,
  status          text not null default 'pending',  -- pending | succeeded | failed | refunded
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- COOPERATIVE MEMBERS
-- ------------------------------------------------------------
create table public.members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_no       text not null,
  name            text not null,
  ic              text,
  phone           text,
  shares          numeric(14,2) not null default 0,
  status          text not null default 'Aktif',      -- Aktif | Tunggakan | Berehat | Keluar
  arrears         numeric(14,2) not null default 0,
  eligible        boolean not null default true,       -- computed: eligible = Aktif & arrears=0
  age             int,
  joined_at       date,
  proxy_of        uuid references public.members(id),  -- proxy holder
  unique (organization_id, member_no)
);

create table public.member_status_history (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id       uuid not null references public.members(id) on delete cascade,
  from_status     text,
  to_status       text not null,
  changed_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- AGM
-- ------------------------------------------------------------
create table public.agms (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  edition         int not null,
  fiscal_year     text,
  scheduled_at    timestamptz not null,
  venue           text,
  mode            text not null default 'hybrid',     -- physical | online | hybrid
  status          text not null default 'planned',    -- planned | notice | open | live | closed | minuted | archived
  quorum_pct      numeric(5,2) not null,              -- from UUK, e.g. 25.00
  notice_days     int not null default 21,
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table public.agm_settings (
  agm_id          uuid primary key references public.agms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  allow_proxy     boolean not null default true,
  allow_online    boolean not null default true,
  voting_opens_at timestamptz,
  voting_closes_at timestamptz,
  min_seconder    int not null default 1
);

create table public.agenda_items (
  id              uuid primary key default gen_random_uuid(),
  agm_id          uuid not null references public.agms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code            text not null,              -- AG-01...
  title           text not null,
  type            text not null,              -- opening | compliance | resolution | financial | report | election | motions | closing
  duration_min    int not null default 10,
  presenter       text,
  sort_order      int not null default 0,
  status          text not null default 'menunggu'  -- menunggu | berlangsung | selesai
);

create table public.agm_notices (
  id              uuid primary key default gen_random_uuid(),
  agm_id          uuid not null references public.agms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sent_at         timestamptz not null default now(),
  channel         text not null,              -- qr | sms | whatsapp | email
  recipient_count int not null default 0,
  read_count      int not null default 0
);

create table public.notice_recipients (
  id              uuid primary key default gen_random_uuid(),
  notice_id       uuid not null references public.agm_notices(id) on delete cascade,
  member_id       uuid not null references public.members(id) on delete cascade,
  delivered_at    timestamptz,
  opened_at       timestamptz,
  unique (notice_id, member_id)
);

create table public.attendance (
  id              uuid primary key default gen_random_uuid(),
  agm_id          uuid not null references public.agms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id       uuid not null references public.members(id) on delete cascade,
  check_in_at     timestamptz not null default now(),
  method          text not null,              -- qr | otp | whatsapp | manual
  unique (agm_id, member_id)
);

create table public.quorum_snapshots (
  id              uuid primary key default gen_random_uuid(),
  agm_id          uuid not null references public.agms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  total_members   int not null,
  present         int not null,
  pct             numeric(5,2) not null,
  satisfied       boolean not null,
  captured_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- GOVERNANCE (append-only where noted)
-- ------------------------------------------------------------
create table public.motions (
  id              uuid primary key default gen_random_uuid(),
  agm_id          uuid not null references public.agms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code            text not null,              -- M-001...
  title           text not null,
  type            text not null,              -- kewangan | pentadbiran | ukk | lain
  proposer_id     uuid references public.members(id),
  seconder_id     uuid references public.members(id),
  status          text not null default 'draf',  -- draf | dibentang | dibincang | diundi | diluluskan | digugurkan
  discussion      jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create table public.votes (                    -- APPEND-ONLY
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agm_id          uuid not null references public.agms(id) on delete cascade,
  motion_id       uuid not null references public.motions(id) on delete cascade,
  voter_id        uuid not null references public.members(id) on delete cascade,
  choice          text not null,               -- ya | tidak | kecuali
  cast_at         timestamptz not null default now(),
  audit_event_id  uuid references public.audit_events(id),
  unique (motion_id, voter_id)
);

create table public.resolutions (
  id              uuid primary key default gen_random_uuid(),
  agm_id          uuid not null references public.agms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  motion_id       uuid references public.motions(id),
  title           text not null,
  passed          boolean not null,
  votes_ya        int not null default 0,
  votes_tidak     int not null default 0,
  votes_kecuali   int not null default 0,
  minuted_at      timestamptz
);

create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  agm_id          uuid not null references public.agms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asker_id        uuid references public.members(id),
  text            text not null,
  dedupe_group    text,                        -- grouped by AI Question Organizer
  status          text not null default 'baru',
  answered_at     timestamptz
);

create table public.actions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agm_id          uuid references public.agms(id),
  resolution_id   uuid references public.resolutions(id),
  title           text not null,
  pic_id          uuid references public.members(id),
  due_date        date,
  status          text not null default 'terbuka',  -- terbuka | selesai | lewat
  created_at      timestamptz not null default now()
);

-- ------------------------------------------------------------
-- COMPLIANCE
-- ------------------------------------------------------------
create table public.compliance_rules (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,            -- BRule-001...
  act         text not null,                   -- akta1993 | gp14 | gp14b | uuk
  description text not null,
  severity    text not null default 'info'     -- info | warning | critical
);

create table public.compliance_checks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agm_id          uuid references public.agms(id),
  rule_id         uuid not null references public.compliance_rules(id),
  result          text not null,               -- lulus | amaran | gagal
  details         jsonb not null default '{}'::jsonb,
  checked_at      timestamptz not null default now()
);

create table public.compliance_findings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  check_id        uuid references public.compliance_checks(id),
  severity        text not null,
  message         text not null,
  status          text not null default 'terbuka',
  resolved_at     timestamptz
);

-- ------------------------------------------------------------
-- EVIDENCE / AUDIT VAULT
-- ------------------------------------------------------------
create table public.documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agm_id          uuid references public.agms(id),
  category        text not null,               -- notice | minutes | financial | motion | resolution
  filename        text not null,
  mime            text not null,
  size_bytes      bigint,
  storage_path    text not null,               -- Supabase Storage path
  sha256          text,
  created_at      timestamptz not null default now()
);

create table public.audit_events (              -- APPEND-ONLY
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,  -- null = system-level event (public lead capture)
  actor_id        uuid references auth.users(id),
  actor_name      text,
  action          text not null,               -- undian.cast | motion.created | minit.ai_draft ...
  entity_type     text not null,
  entity_id       text not null,
  payload         jsonb not null default '{}'::jsonb,
  prev_hash       text,
  hash            text not null unique,        -- chained hash (sha256 of prev + payload)
  occurred_at     timestamptz not null default now()
);

-- ------------------------------------------------------------
-- DISTRIBUTION: PARTNERS & FEDERATIONS
-- ------------------------------------------------------------
create table public.partners (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_name    text not null,
  contact_email   text not null,
  commission_pct  numeric(5,2) not null default 10.00,
  status          text not null default 'active'
);

create table public.partner_organizations (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  referred_at     timestamptz not null default now(),
  commission_earned numeric(12,2) not null default 0
);

create table public.federations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  owner_org_id    uuid not null references public.organizations(id) on delete cascade,
  created_at      timestamptz not null default now()
);

create table public.federation_organizations (
  id              uuid primary key default gen_random_uuid(),
  federation_id   uuid not null references public.federations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  unique (federation_id, organization_id)
);

-- ------------------------------------------------------------
-- INDEXES (tenancy + hot paths)
-- ------------------------------------------------------------
create index idx_org_slug on public.organizations(slug);
create index idx_members_org on public.members(organization_id);
create index idx_members_eligible on public.members(organization_id, eligible);
create index idx_agms_org on public.agms(organization_id, status);
create index idx_motions_agm on public.motions(agm_id);
create index idx_votes_motion on public.votes(motion_id);
create index idx_attendance_agm on public.attendance(agm_id);
create index idx_audit_org on public.audit_events(organization_id, occurred_at desc);
create index idx_assessments_status on public.agm_assessments(status);
create index idx_leads_created on public.agm_assessments(created_at desc);

-- ------------------------------------------------------------
-- ROW-LEVEL SECURITY (enable on all business tables)
-- ------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.profiles             enable row level security;
alter table public.organization_members enable row level security;
alter table public.plans                enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.agm_assessments      enable row level security;
alter table public.quotes               enable row level security;
alter table public.quote_items          enable row level security;
alter table public.invoices             enable row level security;
alter table public.payments             enable row level security;
alter table public.members              enable row level security;
alter table public.member_status_history enable row level security;
alter table public.agms                 enable row level security;
alter table public.agm_settings         enable row level security;
alter table public.agenda_items         enable row level security;
alter table public.agm_notices          enable row level security;
alter table public.notice_recipients    enable row level security;
alter table public.attendance           enable row level security;
alter table public.quorum_snapshots     enable row level security;
alter table public.motions              enable row level security;
alter table public.votes                enable row level security;
alter table public.resolutions          enable row level security;
alter table public.questions            enable row level security;
alter table public.actions              enable row level security;
alter table public.compliance_rules     enable row level security;
alter table public.compliance_checks    enable row level security;
alter table public.compliance_findings  enable row level security;
alter table public.documents            enable row level security;
alter table public.audit_events         enable row level security;
alter table public.partners             enable row level security;
alter table public.partner_organizations enable row level security;
alter table public.federations          enable row level security;
alter table public.federation_organizations enable row level security;

-- Tenant isolation helper: returns the caller's organization_id
create or replace function public.current_org_id()
returns uuid language sql stable security definer as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- Example RLS policy pattern (apply per table):
-- create policy "members_org_isolation" on public.members
--   for all using (organization_id = public.current_org_id())
--   with check (organization_id = public.current_org_id());

-- Append-only guard for votes & audit_events:
-- create trigger votes_append_only before update or delete on public.votes
--   for each row execute function public.raise_append_only();

-- ============================================================
-- SPRINT 2 — MONEY FLOW RPCs (Lead → Quote → Invoice → Payment)
-- Called by the browser api.js SupabaseAdapter (PostgREST).
--
-- Security model:
--   * All functions are SECURITY DEFINER so they can write across
--     RLS-protected tables with server-side validation.
--   * submit_agm_assessment is the ONLY public (anon) entry point.
--     PRODUCTION: front it with an edge function + CAPTCHA +
--     rate limiting before exposing to the internet.
--   * Quote/invoice/payment functions are for the checkout flow;
--     grant them to `authenticated` and add operator-role checks
--     (or move behind a server API) before real money moves.
--   * Commercial mutations append to audit_events.
-- ============================================================

-- Public lead capture: insert an assessment from the marketing site.
create or replace function public.submit_agm_assessment(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id  uuid;
  v_ref text;
begin
  insert into public.agm_assessments (
    coop_name, coop_reg, state, members, agm_date, mode, expected_attendance,
    candidates, motions, current_process, needs_managed,
    contact_name, contact_phone, contact_email, complexity_score, status
  ) values (
    p->>'coop_name', p->>'coop_reg', p->>'state', (p->>'members')::int,
    nullif(p->>'agm_date', '')::date,
    coalesce(p->>'mode', 'hybrid'), (p->>'expected_attendance')::int,
    coalesce((p->>'candidates')::int, 0), coalesce((p->>'motions')::int, 0),
    coalesce(p->>'current_process', 'manual'), coalesce((p->>'needs_managed')::boolean, true),
    p->>'contact_name', p->>'contact_phone', nullif(p->>'contact_email', ''),
    coalesce((p->>'complexity_score')::int, 0), 'lead'
  )
  returning id, reference into v_id, v_ref;

  insert into public.audit_events (organization_id, actor_name, action, entity_type, entity_id, payload, hash)
  values (
    null, 'public', 'assessment.submitted', 'agm_assessment', v_id::text,
    jsonb_build_object('ref', v_ref, 'coop_name', p->>'coop_name',
                       'score', coalesce((p->>'complexity_score')::int, 0)),
    encode(sha256((v_ref || now()::text)::bytea), 'hex')   -- placeholder chain; see hash-chain note below
  );
  return jsonb_build_object('id', v_id, 'ref', v_ref);
end $$;

-- Auto-provision a prospect organization for a lead at quote time.
create or replace function public.provision_prospect_org(p_assessment_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  a    public.agm_assessments;
  v_org uuid;
begin
  select * into a from public.agm_assessments where id = p_assessment_id;
  if not found then raise exception 'assessment % not found', p_assessment_id; end if;
  if a.organization_id is not null then return a.organization_id; end if;

  insert into public.organizations (slug, name, type, registration_no, state, plan, status, settings)
  values (
    lower(regexp_replace(a.coop_name, '[^a-z0-9]+', '-', 'gi')) || '-' || substr(md5(random()::text), 1, 6),
    a.coop_name, 'cooperative', a.coop_reg, a.state, 'starter', 'prospect',
    jsonb_build_object('source', 'assessment', 'assessment_id', p_assessment_id)
  )
  returning id into v_org;

  update public.agm_assessments
     set organization_id = v_org, status = 'quoted'
   where id = p_assessment_id;
  return v_org;
end $$;

-- Create a quote (with line items) for an assessment.
-- p_items: [{"description": "...", "qty": 1, "unit_price": 3500.00}, …]
create or replace function public.create_quote_for_assessment(
  p_assessment_ref text,
  p_items jsonb,
  p_tax_rate numeric default 0.08
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a       public.agm_assessments;
  v_org   uuid;
  v_quote uuid;
  v_sub   numeric := 0;
  v_tax   numeric := 0;
  v_total numeric := 0;
  v_num   text;
  it      jsonb;
begin
  select * into a from public.agm_assessments where reference = p_assessment_ref;
  if not found then raise exception 'assessment % not found', p_assessment_ref; end if;

  v_org := public.provision_prospect_org(a.id);

  select coalesce(max(substring(number from '\d+$')::int), 0) + 1
    into v_num from public.quotes
   where number like 'QT-' || to_char(now(), 'YYYY') || '-%';
  v_num := 'QT-' || to_char(now(), 'YYYY') || '-' || lpad(v_num::text, 3, '0');

  insert into public.quotes (organization_id, assessment_id, number, status, valid_until, subtotal, tax, total)
  values (v_org, a.id, v_num, 'sent', current_date + 30, 0, 0, 0)
  returning id into v_quote;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.quote_items (quote_id, description, quantity, unit_price, line_total)
    values (
      v_quote, it->>'description',
      greatest(coalesce((it->>'qty')::int, 1), 1),
      (it->>'unit_price')::numeric,
      greatest(coalesce((it->>'qty')::int, 1), 1) * (it->>'unit_price')::numeric
    );
    v_sub := v_sub + greatest(coalesce((it->>'qty')::int, 1), 1) * (it->>'unit_price')::numeric;
  end loop;

  v_tax   := round(v_sub * p_tax_rate, 2);
  v_total := v_sub + v_tax;
  update public.quotes set subtotal = v_sub, tax = v_tax, total = v_total where id = v_quote;

  update public.agm_assessments set status = 'quoted' where id = a.id;

  insert into public.audit_events (organization_id, actor_name, action, entity_type, entity_id, payload, hash)
  values (v_org, 'checkout', 'quote.created', 'quote', v_num,
          jsonb_build_object('lead', a.reference, 'total', v_total, 'items', jsonb_array_length(p_items)),
          encode(sha256((v_num || now()::text)::bytea), 'hex'));

  return jsonb_build_object(
    'number', v_num, 'status', 'sent', 'subtotal', v_sub, 'tax', v_tax,
    'tax_rate', p_tax_rate, 'total', v_total, 'valid_until', current_date + 30,
    'lead_ref', a.reference,
    'items', (select jsonb_agg(jsonb_build_object(
                'description', qi.description, 'qty', qi.quantity,
                'unit_price', qi.unit_price, 'line_total', qi.line_total) order by qi.description)
              from public.quote_items qi where qi.quote_id = v_quote)
  );
end $$;

-- Accept a quote (moves the lead to "Sebut Harga Diterima").
create or replace function public.accept_quote(p_number text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.quotes;
begin
  select * into q from public.quotes where number = p_number;
  if not found then raise exception 'quote % not found', p_number; end if;
  if q.status = 'accepted' then return public.get_quote(p_number); end if;

  update public.quotes set status = 'accepted' where id = q.id;
  update public.agm_assessments set status = 'quoted'
   where id = q.assessment_id and status = 'contacted';

  insert into public.audit_events (organization_id, actor_name, action, entity_type, entity_id, payload, hash)
  values (q.organization_id, 'checkout', 'quote.accepted', 'quote', q.number,
          jsonb_build_object('total', q.total),
          encode(sha256((q.number || now()::text)::bytea), 'hex'));
  return public.get_quote(p_number);
end $$;

-- Issue an invoice for an accepted quote (NET 14 payment terms).
create or replace function public.create_invoice_for_quote(p_quote_number text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q      public.quotes;
  v_inv  uuid;
  v_num  text;
begin
  select * into q from public.quotes where number = p_quote_number;
  if not found then raise exception 'quote % not found', p_quote_number; end if;
  if q.status <> 'accepted' then raise exception 'quote % is not accepted', p_quote_number; end if;
  if exists (select 1 from public.invoices where quote_id = q.id) then
    return public.get_invoice((select number from public.invoices where quote_id = q.id limit 1));
  end if;

  select coalesce(max(substring(number from '\d+$')::int), 0) + 1
    into v_num from public.invoices
   where number like 'INV-' || to_char(now(), 'YYYY') || '-%';
  v_num := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_num::text, 3, '0');

  insert into public.invoices (organization_id, quote_id, number, status, issued_at, due_at, amount)
  values (q.organization_id, q.id, v_num, 'unpaid', current_date, current_date + 14, q.total)
  returning id into v_inv;

  insert into public.audit_events (organization_id, actor_name, action, entity_type, entity_id, payload, hash)
  values (q.organization_id, 'checkout', 'invoice.created', 'invoice', v_num,
          jsonb_build_object('quote', q.number, 'amount', q.total, 'due', current_date + 14),
          encode(sha256((v_num || now()::text)::bytea), 'hex'));

  return public.get_invoice(v_num);
end $$;

-- Record a payment against an invoice.
--   p_method: fpx | card | bank_transfer
--   bank_transfer → payment status 'pending' (operator verifies later);
--   fpx / card    → 'succeeded' immediately (in production this function
--                   is only called AFTER gateway webhook confirmation).
create or replace function public.record_payment(
  p_invoice_number text,
  p_method text,
  p_reference text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv     public.invoices;
  v_pay   uuid;
  v_ref   text;
  v_org   uuid;
begin
  select * into inv from public.invoices where number = p_invoice_number;
  if not found then raise exception 'invoice % not found', p_invoice_number; end if;
  if inv.status = 'paid' then raise exception 'invoice % is already paid', p_invoice_number; end if;
  if p_method not in ('fpx', 'card', 'bank_transfer') then
    raise exception 'invalid payment method %', p_method;
  end if;

  v_org := inv.organization_id;
  v_ref := coalesce(nullif(p_reference, ''),
                    upper(p_method) || to_char(now(), 'YYYYMMDDHH24MISS'));

  insert into public.payments (invoice_id, organization_id, method, reference, amount, status, paid_at)
  values (inv.id, v_org, p_method, v_ref, inv.amount,
          case when p_method = 'bank_transfer' then 'pending' else 'succeeded' end,
          case when p_method = 'bank_transfer' then null else now() end)
  returning id into v_pay;

  if p_method <> 'bank_transfer' then
    update public.invoices set status = 'paid', paid_at = now() where id = inv.id;
    update public.agm_assessments set status = 'won'
     where id = (select assessment_id from public.quotes where id = inv.quote_id);
  end if;

  insert into public.audit_events (organization_id, actor_name, action, entity_type, entity_id, payload, hash)
  values (v_org, 'checkout',
          case when p_method = 'bank_transfer' then 'payment.pending_verification' else 'payment.succeeded' end,
          'payment', v_pay::text,
          jsonb_build_object('invoice', inv.number, 'method', p_method, 'reference', v_ref, 'amount', inv.amount),
          encode(sha256((v_ref || now()::text)::bytea), 'hex'));

  return jsonb_build_object(
    'id', v_pay, 'invoice_number', inv.number, 'lead_ref',
    (select a.reference from public.agm_assessments a
      join public.quotes q on q.assessment_id = a.id where q.id = inv.quote_id),
    'method', p_method, 'reference', v_ref, 'amount', inv.amount,
    'status', case when p_method = 'bank_transfer' then 'pending' else 'succeeded' end,
    'paid_at', case when p_method = 'bank_transfer' then null else now() end,
    'created_at', now()
  );
end $$;

-- Read helpers for the checkout page (join items into the quote row).
create or replace function public.get_quote(p_number text)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'number', q.number, 'status', q.status, 'subtotal', q.subtotal, 'tax', q.tax,
    'total', q.total, 'valid_until', q.valid_until,
    'lead_ref', a.reference,
    'items', (select jsonb_agg(jsonb_build_object(
                'description', qi.description, 'qty', qi.quantity,
                'unit_price', qi.unit_price, 'line_total', qi.line_total) order by qi.description)
              from public.quote_items qi where qi.quote_id = q.id)
  )
  from public.quotes q
  left join public.agm_assessments a on a.id = q.assessment_id
  where q.number = p_number;
$$;

create or replace function public.get_invoice(p_number text)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'number', i.number, 'quote_number', q.number, 'lead_ref', a.reference,
    'amount', i.amount, 'status', i.status, 'issued_at', i.issued_at,
    'due_at', i.due_at, 'paid_at', i.paid_at
  )
  from public.invoices i
  left join public.quotes q on q.id = i.quote_id
  left join public.agm_assessments a on a.id = q.assessment_id
  where i.number = p_number;
$$;

-- Grants: lead capture is public; the rest require an authenticated session.
-- PRODUCTION: wrap submit_agm_assessment with an edge function (CAPTCHA +
-- rate limit) and add operator-role checks to the money-movement RPCs.
grant execute on function public.submit_agm_assessment(jsonb)                    to anon, authenticated;
grant execute on function public.create_quote_for_assessment(text, jsonb, numeric) to authenticated;
grant execute on function public.accept_quote(text)                              to authenticated;
grant execute on function public.create_invoice_for_quote(text)                  to authenticated;
grant execute on function public.record_payment(text, text, text)                to authenticated;
grant execute on function public.get_quote(text)                                 to authenticated;
grant execute on function public.get_invoice(text)                               to authenticated;

-- Operator read access for the Lead Inbox (authenticated users only;
-- tighten to a staff role before production).
create policy "assessments_staff_read" on public.agm_assessments
  for select to authenticated using (true);

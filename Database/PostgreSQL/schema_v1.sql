create table if not exists app_user (
    id uuid primary key,
    username text not null unique,
    password_hash text not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table if not exists app_settings (
    id uuid primary key,
    settings_json jsonb not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table if not exists search_job (
    id uuid primary key,
    title text not null,
    free_text text not null,
    category text,
    radius_km integer not null,
    min_price numeric(12,2),
    max_price numeric(12,2),
    interval_minutes integer not null,
    status text not null,
    ai_search_plan jsonb not null,
    last_checked_at timestamptz,
    last_deal_found_at timestamptz,
    snoozed_until timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table if not exists listing_snapshot (
    id uuid primary key,
    search_job_id uuid not null references search_job(id) on delete cascade,
    source_system text not null,
    external_id text not null,
    title text not null,
    price numeric(12,2),
    location_text text,
    listing_url text,
    raw_payload jsonb not null,
    discovered_at timestamptz not null,
    updated_at timestamptz not null,
    unique (source_system, external_id)
);

create table if not exists listing_evaluation (
    id uuid primary key,
    listing_snapshot_id uuid not null references listing_snapshot(id) on delete cascade,
    score integer not null,
    verdict text not null,
    reasoning_json jsonb not null,
    created_at timestamptz not null
);

create table if not exists notification_event (
    id uuid primary key,
    search_job_id uuid references search_job(id) on delete set null,
    listing_snapshot_id uuid references listing_snapshot(id) on delete set null,
    channel text not null,
    status text not null,
    payload_json jsonb not null,
    created_at timestamptz not null
);

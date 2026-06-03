-- Каталог
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- Клиенти (собственици) и обекти
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  eik text
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  address text
);

-- Пожарогасители
create type extinguisher_type as enum ('powder_abc','powder_bc','water','foam','co2');

create table extinguishers (
  id uuid primary key default gen_random_uuid(),     -- = QR payload
  site_id uuid not null references sites(id) on delete cascade,
  brand_id uuid references brands(id),
  model text,
  type extinguisher_type not null,
  serial_number text,
  manufacture_year int not null,
  category text,                                     -- БДС ISO 11602-2, напр. "К2"
  mass_kg numeric(6,3),                              -- маса на заредения
  stamp_year int,                                    -- макс. година за експлоатация
  created_at timestamptz not null default now()
);

-- История на обслужванията
create type service_kind as enum ('TO','recharge','powder_change','foam_change','HI');

create table service_events (
  id uuid primary key default gen_random_uuid(),
  extinguisher_id uuid not null references extinguishers(id) on delete cascade,
  kind service_kind not null,
  service_date date not null,
  technician_name text,
  agent_trade_name text,                             -- търговско наименование на в-вото (при ПЗ/ХИ)
  notes text,
  created_at timestamptz not null default now()
);

-- Протоколи
create table protocols (
  id uuid primary key default gen_random_uuid(),
  number text not null,                              -- "55/2026"
  protocol_date date not null,
  city text not null default 'Нова Загора',
  site_id uuid not null references sites(id),
  representative text not null default 'В. Вълков',
  created_at timestamptz not null default now()
);

create table protocol_lines (
  id uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references protocols(id) on delete cascade,
  extinguisher_id uuid references extinguishers(id),
  idx int not null,                                  -- № по ред
  markings text not null,                            -- кол.2
  category text,                                     -- кол.3
  mass_kg text,                                      -- кол.4 (текст, за форматиране "1,600")
  agent text,                                        -- кол.5
  agent_trade_name text,                             -- кол.6
  service_kind text not null,                        -- кол.7 ("ТО"/"П"/"ХИ")
  service_date text not null,                        -- кол.8 "27.05.2026"
  technician_name text,                              -- кол.9
  sticker_no text                                    -- кол.11
);

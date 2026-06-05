-- Каталог гасителни вещества (по ТЗ т.4) — разширяем
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('powder','foam','water','co2')),
  trade_name text not null,
  unique (kind, trade_name)
);

insert into agents (kind, trade_name) values
 ('powder','Кобра ABC 50'),
 ('powder','Верея ABC 40'),
 ('foam','Щамекс FF'),
 ('water','Вода'),
 ('co2','CO2')
on conflict (kind, trade_name) do nothing;

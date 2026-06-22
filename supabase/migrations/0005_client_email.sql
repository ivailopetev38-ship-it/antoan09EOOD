-- Имейл на клиента (получател на протоколи) — по избор.
alter table clients add column if not exists email text;
comment on column clients.email is 'Имейл на клиента (получател на протоколи) — по избор.';

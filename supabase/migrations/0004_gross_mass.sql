-- Обща (бруто) маса на заредения пожарогасител — графа 4 на протокола (различна от капацитета mass_kg)
alter table extinguishers add column if not exists gross_mass_kg numeric;
comment on column extinguishers.gross_mass_kg is 'Обща (бруто) маса на заредения пожарогасител, кг — различна от mass_kg (капацитет на гасителното вещество). Графа 4 на протокола.';

insert into brands (name) values
 ('Солти'),('Огнехром'),('Дрипалдер'),('Ятрус'),('Торнадо'),
 ('Sparky'),('Gloria'),('Bavaria'),('Total'),('Ceasefire'),
 ('Minimax'),('Tyco'),('Sicli'),('Chubb'),('FirePro'),('Ansul'),('Kidde')
on conflict (name) do nothing;

-- Демо клиент + обект
insert into clients (id, name, address, phone, eik) values
 ('11111111-1111-1111-1111-111111111111','ЕТ Демо Клиент','гр. Нова Загора, ул. Демо 1','0888000111','111111111');

insert into sites (id, client_id, name, address) values
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Склад №1','гр. Нова Загора, ул. Демо 1');

-- Реален пример от бланката: Прахов 1 кг № 5487/2019, К2, 1.600 кг, ТО, стикер 0615
insert into extinguishers (id, site_id, type, model, serial_number, manufacture_year, category, mass_kg, stamp_year) values
 ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222','powder_abc','Прахов 1 кг','5487',2019,'К2',1.600,2034),
 ('33333333-3333-3333-3333-333333333334','22222222-2222-2222-2222-222222222222','co2','CO2 5 кг','7781',2015,'К1',5.000,2025);

insert into service_events (extinguisher_id, kind, service_date, technician_name) values
 ('33333333-3333-3333-3333-333333333333','TO','2025-05-27','Х. Христов');

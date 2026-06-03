-- Включваме RLS на всички таблици. Няма политики → клиентският (anon) ключ
-- няма достъп; целият достъп е сървърен през service_role ключа, който
-- заобикаля RLS. Така затваряме данните за директни заявки от браузъра.
alter table brands enable row level security;
alter table clients enable row level security;
alter table sites enable row level security;
alter table extinguishers enable row level security;
alter table service_events enable row level security;
alter table protocols enable row level security;
alter table protocol_lines enable row level security;

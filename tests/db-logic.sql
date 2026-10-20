-- Proves de la lògica SQL dins d'una sola transacció que acaba amb un error a propòsit:
-- tot es desfà i el missatge d'error porta el resultat. Executar al SQL Editor.
do $$
declare
  r text := '';
  ok int := 0; ko int := 0;
  v_exp uuid; v_mati uuid; v_tarda uuid; v_slot_m uuid; v_slot_t uuid;
  v_day date := public.madrid_today() + 30;
  v_res jsonb; v_b1 uuid; v_b2 uuid; v_st text; v_user uuid := gen_random_uuid();
  procedure_ok boolean;
begin
  insert into public.experiences (slug, name, duration_minutes) values ('qa-logic', 'QA', 210) returning id into v_exp;
  insert into public.slot_types (experience_id, key, label, start_time, end_time, sort)
    values (v_exp, 'mati', 'Matí', '10:00', '13:30', 1) returning id into v_mati;
  insert into public.slot_types (experience_id, key, label, start_time, end_time, sort)
    values (v_exp, 'tarda', 'Tarda', '16:00', '19:30', 2) returning id into v_tarda;
  insert into public.slots (experience_id, slot_type_id, day) values (v_exp, v_mati, v_day) returning id into v_slot_m;
  insert into public.slots (experience_id, slot_type_id, day) values (v_exp, v_tarda, v_day) returning id into v_slot_t;

  -- 1. Primera prereserva
  v_res := public.create_prebooking('qa-logic', v_day, 'mati', 'Empresa A', 'Anna', 'A@A.cat', '600000000', 'Vic', 20, null, false, 'qa', 'ca', null);
  v_b1 := (v_res->>'id')::uuid;
  select status::text into v_st from public.slots where id = v_slot_m;
  if v_st = 'pendent' and v_res->>'ref' like 'CNX-%' then ok := ok + 1; else ko := ko + 1; r := r || ' [1 pendent]'; end if;

  -- 2. Segona a la mateixa franja: rebutjada
  begin
    perform public.create_prebooking('qa-logic', v_day, 'mati', 'Empresa B', 'Bet', 'b@b.cat', '600000001', 'Vic', 10, null, false, 'qa', 'ca', null);
    ko := ko + 1; r := r || ' [2 duplicada acceptada]';
  exception when others then
    if sqlerrm like '%SLOT_UNAVAILABLE%' then ok := ok + 1; else ko := ko + 1; r := r || ' [2 ' || sqlerrm || ']'; end if;
  end;

  -- 3. Tarda independent
  v_res := public.create_prebooking('qa-logic', v_day, 'tarda', 'Empresa C', 'Carla', 'c@c.cat', '600000002', 'Vic', 30, 'nota', true, 'qa', 'ca', null);
  v_b2 := (v_res->>'id')::uuid;
  if v_b2 is not null then ok := ok + 1; else ko := ko + 1; r := r || ' [3 tarda]'; end if;

  -- 4. Vista pública
  if (select count(*) from public.public_availability('qa-logic', v_day, v_day) where status = 'pendent') = 2
     and (select bool_and(to_jsonb(p)::text not like '%Empresa%') from public.public_availability('qa-logic', v_day, v_day) p)
  then ok := ok + 1; else ko := ko + 1; r := r || ' [4 públic]'; end if;

  -- 5. Sense rol d'equip, les RPC admin fallen
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated', 'email', 'qa@impausa.com')::text, true);
  begin
    perform public.admin_release_slot(v_b1);
    ko := ko + 1; r := r || ' [5 sense rol]';
  exception when others then ok := ok + 1;
  end;

  -- Com a membre de l'equip
  insert into auth.users (id, email, aud, role) values (v_user, 'qa@impausa.com', 'authenticated', 'authenticated');
  insert into public.staff (user_id, email, role) values (v_user, 'qa@impausa.com', 'comercial');

  -- 6. No es pot tancar una franja amb sol·licitud activa
  begin
    perform public.admin_set_slot_open(v_slot_m, false);
    ko := ko + 1; r := r || ' [6 tancada amb sol·licitud]';
  exception when others then
    if sqlerrm like '%SLOT_HAS_BOOKING%' then ok := ok + 1; else ko := ko + 1; r := r || ' [6 ' || sqlerrm || ']'; end if;
  end;

  -- 7. Confirmar → franja confirmada
  perform public.admin_update_booking(v_b1, 'confirmada', false);
  select status::text into v_st from public.slots where id = v_slot_m;
  if v_st = 'confirmada' then ok := ok + 1; else ko := ko + 1; r := r || ' [7 ' || v_st || ']'; end if;

  -- 8. Cancel·lar sense alliberar → continua bloquejant (pendent)
  perform public.admin_update_booking(v_b2, 'cancellada', false);
  select status::text into v_st from public.slots where id = v_slot_t;
  if v_st = 'pendent' then ok := ok + 1; else ko := ko + 1; r := r || ' [8 ' || v_st || ']'; end if;

  -- 9. Alliberar → disponible i es pot tornar a sol·licitar
  perform public.admin_release_slot(v_b2);
  select status::text into v_st from public.slots where id = v_slot_t;
  v_res := public.create_prebooking('qa-logic', v_day, 'tarda', 'Empresa D', 'Dani', 'd@d.cat', '600000003', 'Vic', 12, null, false, 'qa', 'ca', null);
  if v_st = 'disponible' and v_res ? 'ref' then ok := ok + 1; else ko := ko + 1; r := r || ' [9 alliberar]'; end if;

  -- 10. La cancel·lada no pot recuperar la franja ocupada per una altra
  begin
    perform public.admin_update_booking(v_b2, 'confirmada', false);
    ko := ko + 1; r := r || ' [10 doble confirmació]';
  exception when others then
    if sqlerrm like '%SLOT_UNAVAILABLE%' then ok := ok + 1; else ko := ko + 1; r := r || ' [10 ' || sqlerrm || ']'; end if;
  end;

  -- 11. Bloquejar/obrir un dia sense tocar franges amb sol·licitud; deshabilitar amb sol·licituds → error
  perform public.admin_set_day_open(v_exp, v_day, false);
  if (select count(*) from public.slots where experience_id = v_exp and status = 'bloquejada') = 0 then ok := ok + 1; else ko := ko + 1; r := r || ' [11 bloqueig]'; end if;
  begin
    perform public.admin_set_day_enabled(v_exp, v_day, false);
    ko := ko + 1; r := r || ' [11b deshabilitat amb sol·licituds]';
  exception when others then ok := ok + 1;
  end;

  -- 12. Marcar contacte passa de nova a negociació
  perform public.admin_mark_contacted((v_res->>'id')::uuid, true);
  if (select commercial_status::text from public.bookings where id = (v_res->>'id')::uuid) = 'negociacio' then ok := ok + 1; else ko := ko + 1; r := r || ' [12 contacte]'; end if;

  -- 13. Auditoria amb l'actor
  if (select count(*) from public.audit_log where actor_email = 'qa@impausa.com') >= 4 then ok := ok + 1; else ko := ko + 1; r := r || ' [13 auditoria]'; end if;

  -- 14. Data passada
  insert into public.slots (experience_id, slot_type_id, day) values (v_exp, v_mati, public.madrid_today());
  begin
    perform public.create_prebooking('qa-logic', public.madrid_today(), 'mati', 'E', 'E', 'e@e.cat', '600000004', 'Vic', 1, null, false, 'qa', 'ca', null);
    ko := ko + 1; r := r || ' [14 data avui acceptada]';
  exception when others then ok := ok + 1;
  end;

  -- 15. Habilitar rang laborable
  if public.admin_enable_range(v_exp, v_day + 1, v_day + 7, array[1,2,3,4,5]) = 10 then ok := ok + 1; else ko := ko + 1; r := r || ' [15 rang]'; end if;

  raise exception 'RESULTAT: % correctes, % errors.%', ok, ko, r;
end $$;

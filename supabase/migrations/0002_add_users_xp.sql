-- Adds XP tracking to users, plus an atomic increment RPC.
-- A read-then-PATCH from Node would race two concurrent chat turns for the
-- same user; this function does the +N inside a single UPDATE instead.

alter table users
    add column if not exists xp integer not null default 0
        check (xp >= 0);

create or replace function increment_user_xp(p_user_id uuid, p_xp_amount integer)
returns integer
language plpgsql
as $$
declare
    new_xp integer;
begin
    update users
    set xp = xp + p_xp_amount
    where id = p_user_id
    returning xp into new_xp;

    if new_xp is null then
        raise exception 'User % not found', p_user_id;
    end if;

    return new_xp;
end;
$$;

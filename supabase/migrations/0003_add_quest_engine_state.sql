-- Adds Dynamic Quest Engine state to users: whether the user has completed
-- initial level calibration, and their active task/objective text.

alter table users
    add column if not exists is_calibrated boolean not null default false;

alter table users
    add column if not exists current_task text;

-- Consecutive failed-objective count, used by the Struggle Drop mechanic to
-- back off the player's estimated_level after repeated failures.
alter table users
    add column if not exists consecutive_fails integer not null default 0
        check (consecutive_fails >= 0);

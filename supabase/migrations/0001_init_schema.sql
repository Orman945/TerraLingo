-- TerraLingo MVP (Phase 1 - Hollywood Boulevard)
-- Initial schema: users, conversations, vocabulary_memory
-- Requires pgvector for embedding storage (vocabulary_memory.embedding)

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ============================================================
-- users
-- ============================================================
create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    base_language text not null,
    target_language text not null,
    estimated_level integer not null default 1
        check (estimated_level between 1 and 10)
);

-- ============================================================
-- conversations
-- ============================================================
create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    npc_id text not null,
    role text not null check (role in ('user', 'npc')),
    message_text text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_id
    on conversations (user_id);

-- ============================================================
-- vocabulary_memory
-- Vector dimension (1536) matches OpenAI text-embedding-3-small / ada-002.
-- ============================================================
create table if not exists vocabulary_memory (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users (id) on delete cascade,
    word text not null,
    encounter_count integer not null default 1,
    mastery_score float not null default 0,
    embedding vector(1536),
    unique (user_id, word)
);

create index if not exists idx_vocabulary_memory_user_id
    on vocabulary_memory (user_id);

-- ivfflat index for cosine-similarity search over embeddings.
create index if not exists idx_vocabulary_memory_embedding
    on vocabulary_memory
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

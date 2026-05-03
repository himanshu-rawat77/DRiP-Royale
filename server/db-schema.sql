create table if not exists token_wallets (
  wallet text primary key,
  royale_balance integer not null default 0,
  challenge_tickets integer not null default 0,
  starter_distributed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists campaign_progress (
  wallet text not null,
  campaign_id text not null,
  completed_chapters integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  best_difficulty text,
  claimed_rewards integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (wallet, campaign_id)
);

create table if not exists campaign_entries (
  entry_id text primary key,
  wallet text not null,
  campaign_id text not null,
  amount integer not null default 0,
  split_json jsonb not null default '{}'::jsonb,
  status text not null,
  run_id text,
  created_at timestamptz not null default now()
);

create table if not exists creator_earnings (
  creator text primary key,
  total_royale integer not null default 0,
  by_campaign jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists campaign_funds (
  campaign_id text primary key,
  reward_pool_royale integer not null default 0,
  protocol_royale integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists campaign_runs (
  run_id text primary key,
  wallet text not null,
  campaign_id text not null,
  difficulty text not null,
  stage_index integer not null default 0,
  status text not null,
  prompt text,
  all_flawless boolean not null default true,
  reward_granted boolean not null default false,
  royale_reward integer not null default 0,
  deck_json jsonb not null default '[]'::jsonb,
  match_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  wallet text primary key,
  role text,
  username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists match_history (
  id bigserial primary key,
  wallet text not null,
  external_match_id text,
  opponent text not null,
  result text not null,
  reward text not null,
  nfts_won jsonb not null default '[]'::jsonb,
  mode text not null default 'multiplayer',
  created_at timestamptz not null default now()
);

create unique index if not exists ux_match_history_wallet_external
on match_history(wallet, external_match_id)
where external_match_id is not null;

create index if not exists idx_match_history_wallet_created
on match_history(wallet, created_at desc);

create table if not exists creator_campaigns (
  id text primary key,
  creator_wallet text not null,
  name text not null,
  theme text not null,
  min_deck_size integer not null default 5,
  entry_ticket_cost integer not null default 5,
  reward_pool integer not null default 0,
  base_royale_reward integer not null default 10,
  prize_preview text not null default '',
  status text not null default 'draft',
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_creator_campaigns_wallet
on creator_campaigns(creator_wallet, created_at desc);

create table if not exists creator_collections (
  id text primary key,
  creator_wallet text not null,
  name text not null,
  symbol text,
  description text,
  supply integer not null default 0,
  status text not null default 'draft',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_creator_collections_wallet
on creator_collections(creator_wallet, created_at desc);

create table if not exists campaign_chain_state (
  campaign_id text primary key,
  chain_mode text not null default 'offchain',
  program_id text,
  campaign_pda text,
  reward_vault_pda text,
  fee_vault_pda text,
  publish_signature text,
  status text not null default 'draft',
  last_error text,
  updated_at timestamptz not null default now()
);

create table if not exists campaign_run_chain (
  run_id text primary key,
  wallet text not null,
  campaign_id text not null,
  commitment_hash text not null,
  nonce bigint not null,
  status text not null default 'committed',
  finalize_signature text,
  claim_signature text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaign_run_chain_wallet
on campaign_run_chain(wallet, updated_at desc);

create table if not exists campaign_entry_chain (
  entry_id text primary key,
  wallet text not null,
  campaign_id text not null,
  status text not null default 'pending',
  pay_signature text,
  updated_at timestamptz not null default now()
);

create table if not exists campaign_stage_rewards (
  campaign_id text not null,
  stage_index integer not null,
  reward_name text not null,
  metadata_uri text not null,
  image_uri text,
  rarity text,
  supply_cap integer,
  status text not null default 'active',
  updated_at timestamptz not null default now(),
  primary key (campaign_id, stage_index)
);

create table if not exists campaign_run_rewards (
  id bigserial primary key,
  run_id text not null,
  campaign_id text not null,
  wallet text not null,
  stage_index integer not null,
  reward_name text not null,
  metadata_uri text not null,
  mint_tx text not null,
  minted_asset_id text,
  created_at timestamptz not null default now(),
  unique (run_id, stage_index)
);

create index if not exists idx_campaign_run_rewards_wallet
on campaign_run_rewards(wallet, created_at desc);

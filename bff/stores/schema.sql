-- Oman Air Experience API / BFF Relational Schema (PostgreSQL 15+)
-- Follows Level 1 & Level 2 Data & State Stores (FR-40, FR-42, L2 Audit & Analytics)

CREATE TABLE IF NOT EXISTS ibe_sessions (
  session_id TEXT PRIMARY KEY,
  internal_pss_token TEXT NOT NULL,
  authorized_rlocs JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ibe_carts (
  cart_id TEXT PRIMARY KEY,
  owner_session_id TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ibe_carts_owner ON ibe_carts (owner_session_id);

CREATE TABLE IF NOT EXISTS ibe_bookings (
  rloc TEXT PRIMARY KEY,
  owner_session_id TEXT,
  owner_member_id TEXT,
  status TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ibe_bookings_member ON ibe_bookings (owner_member_id);
CREATE INDEX IF NOT EXISTS idx_ibe_bookings_session ON ibe_bookings (owner_session_id);

CREATE TABLE IF NOT EXISTS ibe_loyalty_members (
  member_id TEXT PRIMARY KEY,
  household_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  claimed_pnrs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ibe_handoffs (
  token TEXT PRIMARY KEY,
  rloc TEXT NOT NULL,
  flow TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ibe_cms_state (
  id TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ibe_audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_session_id TEXT,
  actor_member_id TEXT,
  resource_id TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  trace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ibe_audit_created ON ibe_audit_logs (created_at DESC);

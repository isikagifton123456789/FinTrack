CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 64),
  client_name TEXT NOT NULL CHECK (char_length(client_name) BETWEEN 2 AND 64),
  base_currency TEXT NOT NULL CHECK (base_currency IN ('KES', 'USD')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portfolios_owner_created_idx ON portfolios (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL CHECK (char_length(instrument) BETWEEN 1 AND 20),
  type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL')),
  quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(24, 8) NOT NULL CHECK (unit_price > 0),
  trade_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seed_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS transactions_portfolio_date_idx ON transactions (portfolio_id, trade_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_portfolio_instrument_date_idx ON transactions (portfolio_id, instrument, trade_date);

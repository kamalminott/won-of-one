-- Create user_subscriptions table for storing subscription status
-- This table syncs with RevenueCat to track subscription state

CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_status TEXT NOT NULL DEFAULT 'none' CHECK (subscription_status IN ('active', 'expired', 'trial', 'none')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_trial BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  product_id TEXT,
  entitlement_id TEXT,
  revenuecat_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_is_active ON user_subscriptions(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only read their own subscription
CREATE POLICY "Users can view their own subscription"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Service role can insert/update (for webhooks)
-- Note: This requires service role key, not anon key
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE user_subscriptions IS 'Stores subscription status synced from RevenueCat';


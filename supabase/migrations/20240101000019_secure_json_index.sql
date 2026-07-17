-- Migration 019: Secure JSON Index (DB-004)
-- Replaces direct UNIQUE constraint on JSONB with MD5 hash of endpoint to avoid Postgres B-Tree size limits

ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_subscription_json_key;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx 
ON push_subscriptions ((md5(subscription_json->>'endpoint')));

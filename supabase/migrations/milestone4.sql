-- Milestone 4: Realtime Security
-- Drop existing custom policies if any
DROP POLICY IF EXISTS "Allow users to subscribe to their own session" ON realtime.messages;
DROP POLICY IF EXISTS "Allow match participants to subscribe to match channel" ON realtime.messages;
DROP POLICY IF EXISTS "Allow match participants to broadcast" ON realtime.messages;

-- 2. Allow users to subscribe (SELECT) to their own session channel
CREATE POLICY "Allow users to subscribe to their own session"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  topic = 'session:' || auth.uid()::text
);

-- 3. Allow users to subscribe (SELECT) to match channels where they are participants
CREATE POLICY "Allow match participants to subscribe to match channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  topic LIKE 'match:%' AND
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE ('match:' || m.id::text) = topic
    AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
  )
);

-- 4. Allow users to broadcast (INSERT) to match channels where they are participants
CREATE POLICY "Allow match participants to broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  topic LIKE 'match:%' AND
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE ('match:' || m.id::text) = topic
    AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
  )
);

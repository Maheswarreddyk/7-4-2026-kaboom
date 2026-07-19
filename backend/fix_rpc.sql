CREATE OR REPLACE FUNCTION public.matchmaker_create_reservation(p_initiator_id uuid, p_partner_id uuid, p_expires_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_lock_a record;
  v_lock_b record;
  v_reservation_id uuid;
BEGIN
  -- Acquire the global transaction lock for matchmaking (ID 8888)
  IF NOT pg_try_advisory_xact_lock(8888) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lock_contention');
  END IF;

  -- Atomic pre-lock: Transition both users to RESERVED if they are SEARCHING
  UPDATE visitor_sessions 
  SET status = 'RESERVED' 
  WHERE id = p_initiator_id AND status = 'SEARCHING'
  RETURNING id INTO v_lock_a;

  UPDATE visitor_sessions 
  SET status = 'RESERVED' 
  WHERE id = p_partner_id AND status = 'SEARCHING'
  RETURNING id INTO v_lock_b;

  -- If either lock failed, rollback and return
  IF v_lock_a IS NULL OR v_lock_b IS NULL THEN
    IF v_lock_a IS NOT NULL THEN
      UPDATE visitor_sessions SET status = 'SEARCHING' WHERE id = p_initiator_id;
    END IF;
    IF v_lock_b IS NOT NULL THEN
      UPDATE visitor_sessions SET status = 'SEARCHING' WHERE id = p_partner_id;
    END IF;
    RETURN jsonb_build_object('success', false, 'reason', 'Session already reserved');
  END IF;

  -- Both locked successfully, create the reservation
  INSERT INTO reservations (
    initiator_session_id, 
    partner_session_id, 
    status, 
    expires_at
  ) VALUES (
    p_initiator_id,
    p_partner_id,
    'pending',
    p_expires_at
  ) RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object('success', true, 'reservationId', v_reservation_id);
EXCEPTION
  WHEN unique_violation THEN
    -- Rollback session states
    UPDATE visitor_sessions SET status = 'SEARCHING' WHERE id IN (p_initiator_id, p_partner_id);
    RETURN jsonb_build_object('success', false, 'reason', 'Session already reserved (constraint)');
  WHEN OTHERS THEN
    UPDATE visitor_sessions SET status = 'SEARCHING' WHERE id IN (p_initiator_id, p_partner_id);
    RETURN jsonb_build_object('success', false, 'reason', SQLERRM);
END;
$function$;

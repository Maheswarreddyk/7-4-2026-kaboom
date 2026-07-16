ALTER TYPE match_end_reason ADD VALUE IF NOT EXISTS 'client_aborted_match';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'client_aborted_match';

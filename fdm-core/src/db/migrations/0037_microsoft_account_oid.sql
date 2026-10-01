-- Better Auth 1.7 identifies Microsoft accounts by the `oid` claim instead of `sub`.
-- Backfill account_id from the stored id_token (payload decoded without signature
-- verification, as the tokens are our own stored data). Problem rows are skipped
-- with a warning so the migration never aborts.
DO $$
DECLARE
  r RECORD;
  payload jsonb;
  b64 text;
  new_oid text;
  migrated integer := 0;
BEGIN
  FOR r IN
    SELECT id, account_id, id_token
    FROM "fdm-authn"."account"
    WHERE provider_id IN ('microsoft', 'microsoft-entra-id')
  LOOP
    payload := NULL;
    IF r.id_token IS NULL OR r.id_token = '' THEN
      RAISE WARNING 'microsoft account % skipped: no id_token', r.id;
      CONTINUE;
    END IF;

    BEGIN
      b64 := translate(split_part(r.id_token, '.', 2), '-_', '+/');
      b64 := b64 || repeat('=', (4 - length(b64) % 4) % 4);
      payload := convert_from(decode(b64, 'base64'), 'UTF8')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'microsoft account % skipped: undecodable id_token', r.id;
      CONTINUE;
    END;

    new_oid := payload ->> 'oid';
    IF new_oid IS NULL OR new_oid = '' THEN
      RAISE WARNING 'microsoft account % skipped: no oid claim', r.id;
      CONTINUE;
    END IF;

    IF r.account_id = new_oid THEN
      CONTINUE;
    END IF;

    IF payload ->> 'sub' IS DISTINCT FROM r.account_id THEN
      RAISE WARNING 'microsoft account % skipped: sub does not match account_id', r.id;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM "fdm-authn"."account"
      WHERE provider_id = 'microsoft' AND account_id = new_oid AND id <> r.id
    ) THEN
      RAISE WARNING 'microsoft account % skipped: oid already in use', r.id;
      CONTINUE;
    END IF;

    UPDATE "fdm-authn"."account"
    SET account_id = new_oid, updated_at = now()
    WHERE id = r.id;
    migrated := migrated + 1;
  END LOOP;

  RAISE NOTICE 'microsoft accounts migrated to oid: %', migrated;
END $$;
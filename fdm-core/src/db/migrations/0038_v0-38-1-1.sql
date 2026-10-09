-- Normalise the end date of fields (`b_end`) to the end of the last day the field is managed,
-- interpreted as a calendar date in Europe/Amsterdam (23:59:59.999 local time). An end date on
-- 1 January is moved to the end of 31 December of the previous year, so a field ended "on 1 January"
-- is no longer part of that calendar year. Rows where the normalised end date would not be after
-- the start date are skipped with a warning so the migration never aborts.
DO $$
DECLARE
  r RECORD;
  end_day date;
  new_end timestamptz;
  migrated integer := 0;
  skipped integer := 0;
BEGIN
  FOR r IN
    SELECT d.b_id, d.b_end, a.b_start
    FROM "fdm"."field_discarding" d
    LEFT JOIN "fdm"."field_acquiring" a ON a.b_id = d.b_id
    WHERE d.b_end IS NOT NULL
  LOOP
    end_day := (r.b_end AT TIME ZONE 'Europe/Amsterdam')::date;
    IF extract(month FROM end_day) = 1 AND extract(day FROM end_day) = 1 THEN
      end_day := end_day - 1;
    END IF;
    new_end := ((end_day + 1)::timestamp AT TIME ZONE 'Europe/Amsterdam') - interval '1 millisecond';

    IF new_end = r.b_end THEN
      CONTINUE;
    END IF;

    IF r.b_start IS NOT NULL AND r.b_start >= new_end THEN
      RAISE WARNING 'field % skipped: normalised b_end % is not after b_start %', r.b_id, new_end, r.b_start;
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    UPDATE "fdm"."field_discarding"
    SET b_end = new_end, updated = now()
    WHERE b_id = r.b_id;
    migrated := migrated + 1;
  END LOOP;

  RAISE NOTICE 'fields with normalised b_end: %', migrated;
  IF skipped > 0 THEN
    RAISE WARNING '% field(s) could not be normalised; resolve them manually (see warnings above)', skipped;
  END IF;
END $$;
--> statement-breakpoint
-- Normalise the end date of measures (`m_end`) in the same way: the end of the last day the
-- measure is applied (Europe/Amsterdam), with 1 January moved to 31 December of the previous year.
DO $$
DECLARE
  r RECORD;
  end_day date;
  new_end timestamptz;
  migrated integer := 0;
  skipped integer := 0;
BEGIN
  FOR r IN
    SELECT b_id, b_id_measure, m_start, m_end
    FROM "fdm"."measure_adopting"
    WHERE m_end IS NOT NULL
  LOOP
    end_day := (r.m_end AT TIME ZONE 'Europe/Amsterdam')::date;
    IF extract(month FROM end_day) = 1 AND extract(day FROM end_day) = 1 THEN
      end_day := end_day - 1;
    END IF;
    new_end := ((end_day + 1)::timestamp AT TIME ZONE 'Europe/Amsterdam') - interval '1 millisecond';

    IF new_end = r.m_end THEN
      CONTINUE;
    END IF;

    IF r.m_start IS NOT NULL AND new_end < r.m_start THEN
      RAISE WARNING 'measure % skipped: normalised m_end % is before m_start %', r.b_id_measure, new_end, r.m_start;
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    UPDATE "fdm"."measure_adopting"
    SET m_end = new_end, updated = now()
    WHERE b_id = r.b_id AND b_id_measure = r.b_id_measure;
    migrated := migrated + 1;
  END LOOP;

  RAISE NOTICE 'measures with normalised m_end: %', migrated;
  IF skipped > 0 THEN
    RAISE WARNING '% measure(s) could not be normalised; resolve them manually (see warnings above)', skipped;
  END IF;
END $$;

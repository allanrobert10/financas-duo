ALTER TABLE public.fixed_expenses
ADD COLUMN IF NOT EXISTS start_month integer,
ADD COLUMN IF NOT EXISTS start_year integer;

UPDATE public.fixed_expenses
SET
    start_month = COALESCE(start_month, EXTRACT(MONTH FROM COALESCE(created_at, now()))::int),
    start_year = COALESCE(start_year, EXTRACT(YEAR FROM COALESCE(created_at, now()))::int)
WHERE start_month IS NULL OR start_year IS NULL;

ALTER TABLE public.fixed_expenses
ALTER COLUMN start_month SET DEFAULT EXTRACT(MONTH FROM now())::int,
ALTER COLUMN start_year SET DEFAULT EXTRACT(YEAR FROM now())::int;

ALTER TABLE public.fixed_expenses
ALTER COLUMN start_month SET NOT NULL,
ALTER COLUMN start_year SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixed_expenses_start_month_check'
  ) THEN
    ALTER TABLE public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_start_month_check
    CHECK (start_month >= 1 AND start_month <= 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixed_expenses_start_year_check'
  ) THEN
    ALTER TABLE public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_start_year_check
    CHECK (start_year >= 2000 AND start_year <= 2200);
  END IF;
END;
$$;

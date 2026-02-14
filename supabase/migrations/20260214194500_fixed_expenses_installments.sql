ALTER TABLE public.fixed_expenses
ADD COLUMN IF NOT EXISTS is_installment boolean,
ADD COLUMN IF NOT EXISTS installments_count integer;

UPDATE public.fixed_expenses
SET is_installment = COALESCE(is_installment, false);

UPDATE public.fixed_expenses
SET installments_count = NULL
WHERE is_installment = false;

ALTER TABLE public.fixed_expenses
ALTER COLUMN is_installment SET DEFAULT false,
ALTER COLUMN is_installment SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixed_expenses_installments_count_range_check'
  ) THEN
    ALTER TABLE public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_installments_count_range_check
    CHECK (
      installments_count IS NULL OR (installments_count >= 2 AND installments_count <= 360)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixed_expenses_installments_consistency_check'
  ) THEN
    ALTER TABLE public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_installments_consistency_check
    CHECK (
      (is_installment = false AND installments_count IS NULL)
      OR (is_installment = true AND installments_count IS NOT NULL)
    );
  END IF;
END;
$$;

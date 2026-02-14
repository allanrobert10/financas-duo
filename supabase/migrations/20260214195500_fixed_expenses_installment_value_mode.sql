ALTER TABLE public.fixed_expenses
ADD COLUMN IF NOT EXISTS installment_value_mode text,
ADD COLUMN IF NOT EXISTS installment_total_amount numeric(12,2);

UPDATE public.fixed_expenses
SET installment_value_mode = CASE
  WHEN is_installment = true THEN COALESCE(installment_value_mode, 'per_installment')
  ELSE NULL
END;

UPDATE public.fixed_expenses
SET installment_total_amount = NULL
WHERE is_installment = false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixed_expenses_installment_value_mode_check'
  ) THEN
    ALTER TABLE public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_installment_value_mode_check
    CHECK (
      installment_value_mode IS NULL
      OR installment_value_mode IN ('per_installment', 'total')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixed_expenses_installment_total_amount_check'
  ) THEN
    ALTER TABLE public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_installment_total_amount_check
    CHECK (
      installment_total_amount IS NULL OR installment_total_amount >= 0
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fixed_expenses_installment_value_mode_consistency_check'
  ) THEN
    ALTER TABLE public.fixed_expenses
    ADD CONSTRAINT fixed_expenses_installment_value_mode_consistency_check
    CHECK (
      (is_installment = false AND installment_value_mode IS NULL AND installment_total_amount IS NULL)
      OR
      (
        is_installment = true
        AND installment_value_mode IS NOT NULL
        AND (
          (installment_value_mode = 'per_installment' AND installment_total_amount IS NULL)
          OR (installment_value_mode = 'total' AND installment_total_amount IS NOT NULL)
        )
      )
    );
  END IF;
END;
$$;

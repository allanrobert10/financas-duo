ALTER TABLE public.fixed_expense_occurrences
ADD COLUMN IF NOT EXISTS description text;

UPDATE public.fixed_expense_occurrences o
SET description = fe.description
FROM public.fixed_expenses fe
WHERE o.fixed_expense_id = fe.id
  AND (o.description IS NULL OR btrim(o.description) = '');

UPDATE public.fixed_expense_occurrences
SET description = ''
WHERE description IS NULL;

ALTER TABLE public.fixed_expense_occurrences
ALTER COLUMN description SET DEFAULT '',
ALTER COLUMN description SET NOT NULL;

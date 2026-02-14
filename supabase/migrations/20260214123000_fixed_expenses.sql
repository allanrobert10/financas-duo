-- Fixed expenses templates
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id),
    category_id uuid NOT NULL REFERENCES public.categories(id),
    account_id uuid REFERENCES public.accounts(id),
    card_id uuid REFERENCES public.cards(id),
    description text NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount >= 0),
    due_day integer NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fixed_expenses_payment_method_check CHECK (
        (account_id IS NOT NULL AND card_id IS NULL)
        OR (account_id IS NULL AND card_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_household_id
    ON public.fixed_expenses (household_id);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active
    ON public.fixed_expenses (household_id, is_active);

-- Monthly occurrences generated from templates
CREATE TABLE IF NOT EXISTS public.fixed_expense_occurrences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fixed_expense_id uuid NOT NULL REFERENCES public.fixed_expenses(id) ON DELETE CASCADE,
    household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    month integer NOT NULL CHECK (month >= 1 AND month <= 12),
    year integer NOT NULL CHECK (year >= 2000 AND year <= 2200),
    due_date date NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount >= 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_at timestamp with time zone,
    transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fixed_expense_occurrence_unique UNIQUE (fixed_expense_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_occurrences_household_period
    ON public.fixed_expense_occurrences (household_id, year, month);

CREATE INDEX IF NOT EXISTS idx_fixed_expense_occurrences_status
    ON public.fixed_expense_occurrences (household_id, status);

-- RLS
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expense_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY fixed_expenses_select
    ON public.fixed_expenses
    FOR SELECT
    USING (household_id = public.get_user_household_id());

CREATE POLICY fixed_expenses_insert
    ON public.fixed_expenses
    FOR INSERT
    WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY fixed_expenses_update
    ON public.fixed_expenses
    FOR UPDATE
    USING (household_id = public.get_user_household_id());

CREATE POLICY fixed_expenses_delete
    ON public.fixed_expenses
    FOR DELETE
    USING (household_id = public.get_user_household_id());

CREATE POLICY fixed_expense_occurrences_select
    ON public.fixed_expense_occurrences
    FOR SELECT
    USING (household_id = public.get_user_household_id());

CREATE POLICY fixed_expense_occurrences_insert
    ON public.fixed_expense_occurrences
    FOR INSERT
    WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY fixed_expense_occurrences_update
    ON public.fixed_expense_occurrences
    FOR UPDATE
    USING (household_id = public.get_user_household_id());

CREATE POLICY fixed_expense_occurrences_delete
    ON public.fixed_expense_occurrences
    FOR DELETE
    USING (household_id = public.get_user_household_id());

-- Keep "reset account" feature clearing fixed-expense data too
CREATE OR REPLACE FUNCTION public.reset_household_data(target_household_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND household_id = target_household_id
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Apenas o dono do lar pode zerar os dados.';
  END IF;

  DELETE FROM public.fixed_expense_occurrences WHERE household_id = target_household_id;
  DELETE FROM public.fixed_expenses WHERE household_id = target_household_id;
  DELETE FROM public.transactions WHERE household_id = target_household_id;
  DELETE FROM public.budgets WHERE household_id = target_household_id;
  DELETE FROM public.cards WHERE household_id = target_household_id;
  DELETE FROM public.accounts WHERE household_id = target_household_id;
  DELETE FROM public.categories WHERE household_id = target_household_id;
  DELETE FROM public.tags WHERE household_id = target_household_id;
  DELETE FROM public.household_invites WHERE household_id = target_household_id;
END;
$$;

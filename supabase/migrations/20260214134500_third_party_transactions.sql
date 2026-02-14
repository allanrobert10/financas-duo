-- Third-party transactions:
-- Keep in statements/invoices, but exclude from household balance and budgets.

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS is_third_party boolean NOT NULL DEFAULT false;

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS third_party_name text;

CREATE INDEX IF NOT EXISTS idx_transactions_household_third_party
    ON public.transactions (household_id, is_third_party);

NOTIFY pgrst, 'reload schema';

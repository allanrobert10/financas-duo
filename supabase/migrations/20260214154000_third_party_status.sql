-- Third-party reimbursement control on transactions.
-- Keeps the expense in invoice totals while allowing reembolso tracking.

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS third_party_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS third_party_paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_transactions_third_party_status
    ON public.transactions (household_id, is_third_party, third_party_status);

NOTIFY pgrst, 'reload schema';

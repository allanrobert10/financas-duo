import type { Database } from './supabase'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Household = Database['public']['Tables']['households']['Row']
export type Account = Database['public']['Tables']['accounts']['Row']
export type Card = Database['public']['Tables']['cards']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Budget = Database['public']['Tables']['budgets']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type TransactionTag = Database['public']['Tables']['transaction_tags']['Row']

export type AccountInsert = Database['public']['Tables']['accounts']['Insert']
export type CardInsert = Database['public']['Tables']['cards']['Insert']
export type TagInsert = Database['public']['Tables']['tags']['Insert']
export type BudgetInsert = Database['public']['Tables']['budgets']['Insert']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']

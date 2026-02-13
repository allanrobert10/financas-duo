export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            accounts: {
                Row: {
                    balance: number | null
                    color: string | null
                    created_at: string | null
                    household_id: string
                    icon: string | null
                    id: string
                    is_active: boolean | null
                    name: string
                    type: string
                }
                Insert: {
                    balance?: number | null
                    color?: string | null
                    created_at?: string | null
                    household_id: string
                    icon?: string | null
                    id?: string
                    is_active?: boolean | null
                    name: string
                    type: string
                }
                Update: {
                    balance?: number | null
                    color?: string | null
                    created_at?: string | null
                    household_id?: string
                    icon?: string | null
                    id?: string
                    is_active?: boolean | null
                    name?: string
                    type?: string
                }
                Relationships: []
            }
            budgets: {
                Row: {
                    amount: number
                    category_id: string
                    created_at: string | null
                    household_id: string
                    id: string
                    month: number
                    year: number
                }
                Insert: {
                    amount: number
                    category_id: string
                    created_at?: string | null
                    household_id: string
                    id?: string
                    month: number
                    year: number
                }
                Update: {
                    amount?: number
                    category_id?: string
                    created_at?: string | null
                    household_id?: string
                    id?: string
                    month?: number
                    year?: number
                }
                Relationships: []
            }
            cards: {
                Row: {
                    best_purchase_day: number | null
                    brand: string | null
                    closing_day: number
                    color: string | null
                    created_at: string | null
                    credit_limit: number | null
                    due_day: number
                    household_id: string
                    id: string
                    is_active: boolean | null
                    is_primary: boolean | null
                    last_four: string | null
                    name: string
                }
                Insert: {
                    best_purchase_day?: number | null
                    brand?: string | null
                    closing_day: number
                    color?: string | null
                    created_at?: string | null
                    credit_limit?: number | null
                    due_day: number
                    household_id: string
                    id?: string
                    is_active?: boolean | null
                    is_primary?: boolean | null
                    last_four?: string | null
                    name: string
                }
                Update: {
                    best_purchase_day?: number | null
                    brand?: string | null
                    closing_day?: number
                    color?: string | null
                    created_at?: string | null
                    credit_limit?: number | null
                    due_day?: number
                    household_id?: string
                    id?: string
                    is_active?: boolean | null
                    is_primary?: boolean | null
                    last_four?: string | null
                    name?: string
                }
                Relationships: []
            }
            categories: {
                Row: {
                    color: string | null
                    created_at: string | null
                    household_id: string
                    icon: string | null
                    id: string
                    name: string
                    type: string
                }
                Insert: {
                    color?: string | null
                    created_at?: string | null
                    household_id: string
                    icon?: string | null
                    id?: string
                    name: string
                    type: string
                }
                Update: {
                    color?: string | null
                    created_at?: string | null
                    household_id?: string
                    icon?: string | null
                    id?: string
                    name?: string
                    type?: string
                }
                Relationships: []
            }
            households: {
                Row: {
                    created_at: string | null
                    id: string
                    name: string
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    name?: string
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    created_at: string | null
                    email: string
                    full_name: string | null
                    household_id: string | null
                    id: string
                    role: string | null
                }
                Insert: {
                    avatar_url?: string | null
                    created_at?: string | null
                    email: string
                    full_name?: string | null
                    household_id?: string | null
                    id: string
                    role?: string | null
                }
                Update: {
                    avatar_url?: string | null
                    created_at?: string | null
                    email?: string
                    full_name?: string | null
                    household_id?: string | null
                    id?: string
                    role?: string | null
                }
                Relationships: []
            }
            tags: {
                Row: {
                    color: string | null
                    created_at: string | null
                    household_id: string
                    id: string
                    name: string
                }
                Insert: {
                    color?: string | null
                    created_at?: string | null
                    household_id: string
                    id?: string
                    name: string
                }
                Update: {
                    color?: string | null
                    created_at?: string | null
                    household_id?: string
                    id?: string
                    name?: string
                }
                Relationships: []
            }
            transaction_tags: {
                Row: {
                    tag_id: string
                    transaction_id: string
                }
                Insert: {
                    tag_id: string
                    transaction_id: string
                }
                Update: {
                    tag_id?: string
                    transaction_id?: string
                }
                Relationships: []
            }
            transactions: {
                Row: {
                    account_id: string | null
                    amount: number
                    card_id: string | null
                    category_id: string | null
                    created_at: string | null
                    date: string
                    description: string
                    household_id: string
                    id: string
                    is_recurring: boolean | null
                    notes: string | null
                    recurrence_type: string | null
                    type: string
                    user_id: string
                }
                Insert: {
                    account_id?: string | null
                    amount: number
                    card_id?: string | null
                    category_id?: string | null
                    created_at?: string | null
                    date?: string
                    description: string
                    household_id: string
                    id?: string
                    is_recurring?: boolean | null
                    notes?: string | null
                    recurrence_type?: string | null
                    type: string
                    user_id: string
                }
                Update: {
                    account_id?: string | null
                    amount?: number
                    card_id?: string | null
                    category_id?: string | null
                    created_at?: string | null
                    date?: string
                    description?: string
                    household_id?: string
                    id?: string
                    is_recurring?: boolean | null
                    notes?: string | null
                    recurrence_type?: string | null
                    type?: string
                    user_id?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_user_household_id: { Args: never; Returns: string }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

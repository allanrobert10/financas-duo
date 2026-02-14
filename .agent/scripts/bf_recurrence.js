const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xwenjdzsuugtkjwlnmmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3ZW5qZHpzdXVndGtqd2xubW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDcwNzQsImV4cCI6MjA4NjUyMzA3NH0.7aIqbntFt3wop5LcsdKTPzK5NEnXu7YPZtBrZH2gkVI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Get a valid profile to use for FKs
    const { data: profile } = await supabase.from('profiles').select('id, household_id').limit(1).single();

    if (!profile) {
        console.log('No profile found to test with.');
        return;
    }

    const valuesToTest = ['fixed', 'installment', 'monthly', 'weekly', 'yearly', 'daily', 'custom', 'Fixed', 'Installment', 'Monthly'];

    console.log('Testing recurrence_type values...');

    for (const val of valuesToTest) {
        const { error } = await supabase.from('transactions').insert({
            description: `Test Recurrence ${val}`,
            amount: 1,
            date: new Date().toISOString(),
            type: 'expense',
            category_id: null, // nullable?
            household_id: profile.household_id,
            user_id: profile.id,
            is_recurring: true,
            recurrence_type: val
        });

        if (error) {
            console.log(`❌ '${val}': ${error.message}`);
        } else {
            console.log(`✅ '${val}' SUCCESS!`);
            // Clean up
            await supabase.from('transactions').delete().eq('description', `Test Recurrence ${val}`);
        }
    }
}

run();

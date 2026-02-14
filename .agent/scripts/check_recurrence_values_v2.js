const { createClient } = require('@supabase/supabase-js');

// Use the credentials I just read
const supabaseUrl = 'https://xwenjdzsuugtkjwlnmmd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3ZW5qZHpzdXVndGtqd2xubW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDcwNzQsImV4cCI6MjA4NjUyMzA3NH0.7aIqbntFt3wop5LcsdKTPzK5NEnXu7YPZtBrZH2gkVI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('recurrence_type')
            .not('recurrence_type', 'is', null);

        if (error) {
            console.log('Error fetching data:', error.message);
        } else {
            if (data && data.length > 0) {
                const unique = [...new Set(data.map(d => d.recurrence_type))];
                console.log('Unique recurrence_type values in DB:', unique);
            } else {
                console.log('No recurring transactions found.');

                // If empty, try to fetch constraint info from information_schema again, hoping write_to_file handles JS correctly
                const { data: checks, error: chkErr } = await supabase
                    .from('information_schema.check_constraints')
                    .select('*')
                    .like('constraint_name', '%recurrence%');

                if (chkErr) console.log('Error checking constraints:', chkErr);
                else console.log('Found constraints:', JSON.stringify(checks, null, 2));
            }
        }
    } catch (err) {
        console.error('Script error:', err);
    }
}

run();

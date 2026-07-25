import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';

// Initialize immediately with hardcoded constants
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper for Realtime Subscriptions
export const subscribeToTable = (
    table: string, 
    callback: (payload: any) => void
) => {
    return supabase
        .channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
        .subscribe();
};

const isTableMissingError = (error: any) => {
    // 42P01 is Postgres code for "undefined_table"
    // "Could not find the table" is a PostgREST/Supabase specific error message for schema cache misses
    return (
        error.code === '42P01' || 
        error.message.includes('Could not find the table') || 
        (error.message.includes('relation') && error.message.includes('does not exist'))
    );
};

// Generic fetch
export const fetchTable = async (table: string) => {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
        if (!isTableMissingError(error)) {
            console.error(`Error fetching ${table}:`, error.message);
        }
        return null;
    }
    return data;
};

// Generic Upsert
export const upsertData = async (table: string, data: any) => {
    // Explicitly tell Supabase to merge if 'id' conflicts (prevents duplicates)
    // This requires the 'id' column to be a Primary Key or have a Unique constraint in Postgres
    const options = data.id ? { onConflict: 'id' } : undefined;
    
    const { error } = await supabase.from(table).upsert(data, options);
    if (error) {
        if (!isTableMissingError(error)) {
            console.error(`Error upserting to ${table}:`, error.message);
        }
    }
    return { error };
};

// Generic Delete
export const deleteData = async (table: string, id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error && !isTableMissingError(error)) {
        console.error(`Error deleting from ${table}:`, error.message);
    }
    return { error };
};

// Delete All (Clear Table)
export const clearTable = async (table: string) => {
    // Use .not('id', 'is', null) to match all rows regardless of ID type (UUID, Int, Text)
    // This requires the 'id' column to be not-null, which is standard for PKs.
    const { error } = await supabase.from(table).delete().not('id', 'is', null);
    
    if (error) {
        if (!isTableMissingError(error)) {
            console.error(`Error clearing ${table}:`, error.message);
            return { error };
        }
    }
    return { error: null };
};
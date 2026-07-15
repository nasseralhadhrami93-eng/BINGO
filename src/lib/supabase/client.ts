import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a single Supabase client for interacting with your database
// This client is initialized once and can be used for real-time subscriptions and standard queries.
export const supabase = createClient(supabaseUrl, supabaseKey);

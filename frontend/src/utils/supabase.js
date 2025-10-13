// Frontend doesn't need direct Supabase connection
// All database operations go through the backend API
// This file is just a placeholder if you need it later

export default null;

// If you want to add Supabase client for frontend in future:
/*
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
*/
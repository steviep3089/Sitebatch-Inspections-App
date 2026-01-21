import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://doeefinncekkahjgpcig.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvZWVmaW5uY2Vra2FoamdwY2lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjUwOTcsImV4cCI6MjA4MzM0MTA5N30.rFMIu0_nefOqkOgXPAuhYBk8owIGVfBChOmyWdQKj9c";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

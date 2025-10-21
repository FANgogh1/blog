import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qghxnulnxxtvaqupoxeo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnaHhudWxueHh0dmFxdXBveGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMzcwMzAsImV4cCI6MjA3NjYxMzAzMH0._RahoiQh9FBFhcvirKqvm4SDZ2dlK7rfZSCC02ZbSXM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
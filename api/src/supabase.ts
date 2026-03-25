import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error(
    "SUPABASE_URL is missing. \n" +
    "- Local development: Check api/.env \n" +
    "- Production (Render/Netlify): Add it to Environment Variables in your dashboard."
  );
}

if (!key) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is missing. \n" +
    "- Local development: Check api/.env \n" +
    "- Production (Render/Netlify): Add it to Environment Variables in your dashboard."
  );
}

export const supabase = createClient(url, key);
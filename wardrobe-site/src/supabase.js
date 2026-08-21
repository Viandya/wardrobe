import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Не заданы ключи Supabase. Создай файл .env по образцу .env.example и перезапусти npm run dev."
  );
}

export const supabase = createClient(url, key);

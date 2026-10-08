/**
 * Cliente de Supabase.
 *
 * Unico archivo autorizado a importar `@supabase/supabase-js`, igual que
 * `datos/almacen.ts` es el unico que toca `localStorage`. Nadie fuera de
 * `datos/api/*` importa esto directo — las pantallas piden datos a la API,
 * nunca al SDK.
 *
 * A diferencia de `datos/cliente.ts` (la frontera del MOCK de postura), esto es
 * backend real desde el dia uno: cuentas, antecedentes y el log de eventos no
 * son simulados.
 */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Revisa app/.env.local.",
  );
}

export const supabase = createClient(url, anonKey);

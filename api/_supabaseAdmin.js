import { createClient } from "@supabase/supabase-js";

const GLOBAL_CACHE_KEY = "__RISX_SUPABASE_ADMIN_CLIENT__";

function readAdminEnv() {
  const url = String(
    process.env.SUPABASE_URL ||
    process.env.RISX_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, serviceRoleKey };
}

export function hasSupabaseAdminEnv() {
  const { url, serviceRoleKey } = readAdminEnv();
  return !!(url && serviceRoleKey);
}

export function assertSupabaseAdminEnv() {
  const { url, serviceRoleKey } = readAdminEnv();
  if (!url) {
    throw new Error("Missing SUPABASE_URL (or RISX_SUPABASE_URL)");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return { url, serviceRoleKey };
}

export function getSupabaseAdmin() {
  if (globalThis[GLOBAL_CACHE_KEY]) return globalThis[GLOBAL_CACHE_KEY];

  const { url, serviceRoleKey } = assertSupabaseAdminEnv();
  const client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "risx-server-admin",
      },
    },
  });

  globalThis[GLOBAL_CACHE_KEY] = client;
  return client;
}

export async function withSupabaseAdmin(opName, fn) {
  const label = String(opName || "supabase_admin_op");
  try {
    const admin = getSupabaseAdmin();
    return await fn(admin);
  } catch (err) {
    const msg = String(err?.message || err || "unknown error");
    throw new Error(`[${label}] ${msg}`);
  }
}

export async function fetchOne(table, filterColumn, filterValue) {
  return withSupabaseAdmin(`fetchOne:${table}`, async (admin) => {
    const { data, error } = await admin
      .from(String(table))
      .select("*")
      .eq(String(filterColumn), filterValue)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  });
}

export async function insertOne(table, row, { returning = "*" } = {}) {
  return withSupabaseAdmin(`insertOne:${table}`, async (admin) => {
    const { data, error } = await admin
      .from(String(table))
      .insert(row)
      .select(returning)
      .single();
    if (error) throw error;
    return data;
  });
}

export async function upsertOne(table, row, { onConflict, returning = "*" } = {}) {
  return withSupabaseAdmin(`upsertOne:${table}`, async (admin) => {
    const query = admin
      .from(String(table))
      .upsert(row, onConflict ? { onConflict: String(onConflict) } : undefined)
      .select(returning)
      .single();
    const { data, error } = await query;
    if (error) throw error;
    return data;
  });
}


/**
 * Connection settings for the `pg` pool that reproduce how the previous `postgres` client connected, so changing
 * the client cannot change how the app reaches Supabase:
 *   no sslmode                      → plain connection (as before)
 *   sslmode=require / prefer / allow → encrypted, certificate not checked (as before)
 *   sslmode=verify-ca / verify-full, sslrootcert=system → encrypted and checked
 * The ssl parameters are taken out of the address: `pg` would otherwise read sslmode=require as "verify the
 * certificate", which Supabase's certificate does not pass with Node's default trust store.
 */
export function pgConnection(url: string): { connectionString: string; ssl: false | { rejectUnauthorized: boolean } } {
  const u = new URL(url);
  const mode = (u.searchParams.get("sslmode") ?? "").toLowerCase();
  const systemRoot = u.searchParams.get("sslrootcert") === "system";
  for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslpassword", "uselibpqcompat", "pgbouncer", "connection_limit", "pool_timeout"]) u.searchParams.delete(k);
  const ssl = systemRoot || mode === "verify-full" || mode === "verify-ca" ? { rejectUnauthorized: true } : mode === "require" || mode === "prefer" || mode === "allow" ? { rejectUnauthorized: false } : false;
  return { connectionString: u.toString(), ssl };
}

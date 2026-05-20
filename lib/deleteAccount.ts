import { supabase } from "./supabase";

/**
 * Permanently deletes the signed-in user's account via the `delete_account` RPC.
 * Run supabase/delete_account.sql in the Supabase SQL editor if the RPC is missing.
 */
export async function deleteAccount(): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { error: rpcError } = await supabase.rpc("delete_account");

  if (rpcError) {
    if (rpcError.code === "PGRST202" || rpcError.message.includes("delete_account")) {
      return {
        error:
          "Account deletion is not configured on the server yet. Run supabase/delete_account.sql in your Supabase SQL editor.",
      };
    }
    return { error: rpcError.message };
  }

  await supabase.auth.signOut();
  return { error: null };
}

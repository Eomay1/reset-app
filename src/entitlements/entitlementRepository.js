import { supabase } from "../supabaseClient";
import { normalizeEntitlementResponse } from "./entitlementState";

export async function fetchCurrentEntitlement() {
  const { data, error } = await supabase.rpc("get_current_consumer_entitlement");
  if (error) throw error;
  return normalizeEntitlementResponse(data);
}

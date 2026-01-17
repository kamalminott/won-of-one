import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (status: number, body: Record<string, unknown>) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { success: false, error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, {
      success: false,
      error: "Missing Supabase environment variables",
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return jsonResponse(401, { success: false, error: "Missing Authorization header" });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { success: false, error: "Unauthorized" });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.userId && body.userId !== user.id) {
    return jsonResponse(403, { success: false, error: "User ID mismatch" });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return jsonResponse(400, { success: false, error: deleteError.message });
  }

  return jsonResponse(200, { success: true });
});

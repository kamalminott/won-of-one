import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

type RevenueCatWebhookRequest = {
  api_version?: string;
  event?: RevenueCatWebhookEvent | null;
};

type RevenueCatWebhookEvent = {
  id?: string | null;
  type?: string | null;
  app_id?: string | null;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  entitlement_id?: string | null;
  entitlement_ids?: string[] | null;
  product_id?: string | null;
  period_type?: string | null;
  store?: string | null;
  environment?: string | null;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  cancel_reason?: string | null;
  expiration_reason?: string | null;
};

type SubscriptionRow = {
  user_id: string;
  subscription_status: "active" | "expired" | "trial" | "none";
  is_active: boolean;
  is_trial: boolean;
  expires_at: string | null;
  product_id: string | null;
  entitlement_id: string | null;
  revenuecat_user_id: string | null;
  updated_at: string;
};

const JSON_HEADERS = { "Content-Type": "application/json" };
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TRACKED_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "CANCELLATION",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_PAUSED",
  "EXPIRATION",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE",
  "TRANSFER",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "REFUND_REVERSED",
]);

const DIRECT_ACTIVE_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "REFUND_REVERSED",
]);

const response = (status: number, body: JsonRecord) =>
  new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });

const isUuid = (value?: string | null): value is string =>
  !!value && UUID_V4_REGEX.test(value);

const toIsoFromMs = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value).toISOString();
};

const parseAuthSecret = (value: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.startsWith("Bearer ") ? trimmed.slice(7).trim() : trimmed;
};

const isTrialPeriod = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  return normalized === "TRIAL" || normalized === "INTRO";
};

const firstEntitlementId = (event: RevenueCatWebhookEvent) => {
  if (Array.isArray(event.entitlement_ids) && event.entitlement_ids.length > 0) {
    const first = event.entitlement_ids.find((value) => typeof value === "string" && value.trim());
    if (first) return first;
  }

  return typeof event.entitlement_id === "string" && event.entitlement_id.trim()
    ? event.entitlement_id
    : null;
};

const getCandidateUserIds = (event: RevenueCatWebhookEvent) => {
  const values = new Set<string>();
  const maybeAdd = (value?: string | null) => {
    if (isUuid(value)) {
      values.add(value);
    }
  };

  maybeAdd(event.app_user_id);
  maybeAdd(event.original_app_user_id);
  (event.aliases ?? []).forEach((value) => maybeAdd(value));
  (event.transferred_from ?? []).forEach((value) => maybeAdd(value));
  (event.transferred_to ?? []).forEach((value) => maybeAdd(value));

  return Array.from(values);
};

const buildInactiveRow = (
  userId: string,
  event: RevenueCatWebhookEvent,
  statusOverride?: "expired" | "none"
): SubscriptionRow => {
  const expiresAt = toIsoFromMs(event.expiration_at_ms);
  const isExpired =
    statusOverride === "expired" ||
    event.type === "EXPIRATION" ||
    (expiresAt !== null && Date.parse(expiresAt) <= Date.now());

  return {
    user_id: userId,
    subscription_status: isExpired ? "expired" : "none",
    is_active: false,
    is_trial: false,
    expires_at: expiresAt,
    product_id: event.product_id ?? null,
    entitlement_id: firstEntitlementId(event),
    revenuecat_user_id:
      event.original_app_user_id ?? event.app_user_id ?? userId,
    updated_at: new Date().toISOString(),
  };
};

const buildRowFromEvent = (
  userId: string,
  event: RevenueCatWebhookEvent,
  mode: "default" | "transfer_from" | "transfer_to" = "default"
): SubscriptionRow => {
  if (mode === "transfer_from") {
    return buildInactiveRow(userId, event, "none");
  }

  const eventType = event.type?.toUpperCase() ?? "";
  const expiresAt = toIsoFromMs(event.expiration_at_ms);
  const hasFutureExpiry = expiresAt !== null && Date.parse(expiresAt) > Date.now();
  const isTrial = isTrialPeriod(event.period_type);
  const shouldBeActive =
    mode === "transfer_to" ||
    DIRECT_ACTIVE_EVENT_TYPES.has(eventType) ||
    ((eventType === "CANCELLATION" ||
      eventType === "BILLING_ISSUE" ||
      eventType === "SUBSCRIPTION_PAUSED") &&
      hasFutureExpiry);

  if (!shouldBeActive) {
    return buildInactiveRow(userId, event);
  }

  return {
    user_id: userId,
    subscription_status: isTrial ? "trial" : "active",
    is_active: true,
    is_trial: isTrial,
    expires_at: expiresAt,
    product_id: event.product_id ?? null,
    entitlement_id: firstEntitlementId(event),
    revenuecat_user_id:
      event.original_app_user_id ?? event.app_user_id ?? userId,
    updated_at: new Date().toISOString(),
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return response(405, { success: false, error: "Method not allowed" });
  }

  const webhookSecret = parseAuthSecret(Deno.env.get("REVENUECAT_WEBHOOK_AUTH"));
  const authorizationHeader = parseAuthSecret(req.headers.get("Authorization"));
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return response(500, {
      success: false,
      error: "Missing required environment variables",
    });
  }

  if (!authorizationHeader || authorizationHeader !== webhookSecret) {
    return response(401, { success: false, error: "Unauthorized" });
  }

  const payload = (await req.json().catch(() => null)) as RevenueCatWebhookRequest | null;
  const event = payload?.event ?? null;

  if (!event?.id || !event.type) {
    return response(400, { success: false, error: "Invalid RevenueCat webhook payload" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: existingEvent, error: existingEventError } = await admin
    .from("revenuecat_webhook_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingEventError) {
    console.error("RevenueCat webhook dedupe lookup failed", existingEventError);
    return response(500, { success: false, error: "Webhook dedupe lookup failed" });
  }

  if (existingEvent) {
    return response(200, { success: true, duplicate: true });
  }

  const candidateUserIds = getCandidateUserIds(event);
  const eventType = event.type.toUpperCase();

  if (TRACKED_EVENT_TYPES.has(eventType) && candidateUserIds.length > 0) {
    const transferredFrom = new Set((event.transferred_from ?? []).filter(isUuid));
    const transferredTo = new Set((event.transferred_to ?? []).filter(isUuid));

    for (const userId of candidateUserIds) {
      const mode =
        eventType === "TRANSFER" && transferredFrom.has(userId)
          ? "transfer_from"
          : eventType === "TRANSFER" && transferredTo.has(userId)
            ? "transfer_to"
            : "default";
      const row = buildRowFromEvent(userId, event, mode);

      const { error: upsertError } = await admin
        .from("user_subscriptions")
        .upsert(row, { onConflict: "user_id" });

      if (upsertError) {
        console.error("RevenueCat subscription upsert failed", {
          userId,
          eventId: event.id,
          eventType,
          error: upsertError,
        });
        return response(500, { success: false, error: "Subscription upsert failed" });
      }
    }
  }

  const { error: auditError } = await admin
    .from("revenuecat_webhook_events")
    .insert({
      event_id: event.id,
      event_type: eventType,
      app_user_id: event.app_user_id ?? null,
      environment: event.environment ?? null,
      payload: payload,
    });

  if (auditError) {
    console.error("RevenueCat webhook audit insert failed", auditError);
    return response(500, { success: false, error: "Webhook audit insert failed" });
  }

  return response(200, {
    success: true,
    processed: true,
    event_id: event.id,
    event_type: eventType,
    affected_users: candidateUserIds,
  });
});

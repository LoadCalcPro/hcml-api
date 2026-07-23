const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

const SITE_URL =
  process.env.SITE_URL ||
  "https://loadcalcpro.github.io/electrical-load-calculator/";

const CREATE_PASSWORD_URL =
  process.env.CREATE_PASSWORD_URL ||
  `${SITE_URL}create-password.html`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
  );
  process.exit(1);
}

if (!ADMIN_API_KEY) {
  console.warn(
    "ADMIN_API_KEY is not set. Manual member management routes will be disabled."
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Admin-Key"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

function cleanEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[.,;:\s]+$/g, "");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(email));
}

function isFakeEmail(email) {
  const domain = cleanEmail(email).split("@")[1];
  const blockedDomains = [
    "test.com",
    "example.com",
    "example.net",
    "example.org",
    "mailinator.com",
    "tempmail.com",
    "temp-mail.org",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "trashmail.com",
    "fakeinbox.com",
    "getnada.com"
  ];

  return blockedDomains.includes(domain);
}

function findEmailInPayload(body) {
  return (
    body?.email ||
    body?.customer_email ||
    body?.buyer_email ||
    body?.payer_email ||
    body?.customer?.email ||
    body?.buyer?.email ||
    body?.subscription?.customer_email ||
    body?.subscription?.customer?.email ||
    body?.data?.email ||
    body?.data?.customer_email ||
    body?.data?.customer?.email ||
    ""
  );
}

function findEventType(body) {
  return String(
    body?.event ||
      body?.event_type ||
      body?.type ||
      body?.webhook_event ||
      body?.data?.event ||
      ""
  )
    .trim()
    .toLowerCase();
}

function findProductName(body) {
  const directName =
    body?.product_name ||
    body?.product?.name ||
    body?.subscription?.product_name ||
    body?.data?.product_name ||
    body?.data?.product?.name;

  if (directName) {
    return String(directName).trim();
  }

  if (Array.isArray(body?.items) && body.items.length > 0) {
    return String(body.items[0]?.product_name || "").trim();
  }

  if (Array.isArray(body?.data?.items) && body.data.items.length > 0) {
    return String(body.data.items[0]?.product_name || "").trim();
  }

  return "";
}

function normalizeAccessType(value) {
  const text = String(value || "").trim().toLowerCase();

  if (
    text === "aic" ||
    text === "aic-calculator" ||
    text === "aic calculator" ||
    text.includes("available fault current")
  ) {
    return "aic";
  }

  if (
    text === "generator" ||
    text === "generator-nec2023" ||
    text === "optional-generator" ||
    text === "optional method generator calculator" ||
    text === "optional method & generator calculator" ||
    text.includes("optional method") ||
    text.includes("generator")
  ) {
    return "generator";
  }

  if (
    text === "both" ||
    text === "bundle" ||
    text.includes("two calculator") ||
    text.includes("2 calculator") ||
    text.includes("all calculator")
  ) {
    return "both";
  }

  return "";
}

function accessTypeFromProductName(productName) {
  const name = String(productName || "").trim().toLowerCase();

  if (!name) {
    return "";
  }

  if (
    name.includes("two calculator") ||
    name.includes("2 calculator") ||
    name.includes("all calculator") ||
    name.includes("electrical calculation suite")
  ) {
    return "both";
  }

  if (
    name === "aic calculator" ||
    name.includes("aic calculator") ||
    name.includes("available fault current")
  ) {
    return "aic";
  }

  if (
    name === "optional method generator calculator" ||
    name === "optional method & generator calculator" ||
    name.includes("optional method") ||
    name.includes("generator calculator")
  ) {
    return "generator";
  }

  if (
    name === "loadcalcpro professional membership" ||
    name === "professional monthly membership"
  ) {
    return "generator";
  }

  return "";
}

function requireAdminKey(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(503).json({
      success: false,
      message: "Manual member management is not configured."
    });
  }

  const providedKey = String(req.get("X-Admin-Key") || "").trim();

  if (!providedKey || providedKey !== ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized."
    });
  }

  next();
}

async function findMember(email) {
  const { data, error } = await supabase
    .from("members")
    .select("id, email, active, aic_access, generator_access, created_at")
    .eq("email", cleanEmail(email))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findAuthUserByEmail(email) {
  const clean = cleanEmail(email);
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const match = users.find(
      (user) => cleanEmail(user.email) === clean
    );

    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

async function inviteMemberToCreatePassword(email) {
  const clean = cleanEmail(email);
  const existingAuthUser = await findAuthUserByEmail(clean);

  // Existing users should use Forgot Password. This also prevents
  // duplicate Payhip webhook events from sending repeated invitations.
  if (existingAuthUser) {
    return {
      invited: false,
      reason: "auth_user_already_exists",
      userId: existingAuthUser.id
    };
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    clean,
    {
      redirectTo: CREATE_PASSWORD_URL,
      data: { app: "LoadCalcPro" }
    }
  );

  if (error) {
    throw error;
  }

  return {
    invited: true,
    reason: "invitation_sent",
    userId: data?.user?.id || null
  };
}

function getBearerToken(req) {
  const authorization = String(req.get("Authorization") || "").trim();

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

async function authenticatedUserFromRequest(req) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

function memberAccessValues(member) {
  const aicAccess = member?.aic_access === true;
  let generatorAccess = member?.generator_access === true;

  // Backward compatibility for original Generator memberships.
  if (
    member?.active === true &&
    aicAccess === false &&
    generatorAccess === false
  ) {
    generatorAccess = true;
  }

  return { aicAccess, generatorAccess };
}

async function setMemberAccess(email, accessType, enabled) {
  const clean = cleanEmail(email);

  if (!isValidEmail(clean)) {
    throw new Error("Invalid email address.");
  }

  const normalizedAccess = normalizeAccessType(accessType);

  if (!normalizedAccess) {
    throw new Error(
      "The Payhip product could not be matched to a calculator."
    );
  }

  const existingMember = await findMember(clean);
  const current = memberAccessValues(existingMember);

  let aicAccess = current.aicAccess;
  let generatorAccess = current.generatorAccess;

  if (normalizedAccess === "aic" || normalizedAccess === "both") {
    aicAccess = enabled;
  }

  if (
    normalizedAccess === "generator" ||
    normalizedAccess === "both"
  ) {
    generatorAccess = enabled;
  }

  const active = aicAccess || generatorAccess;

  if (existingMember) {
    const { data, error } = await supabase
      .from("members")
      .update({
        active,
        aic_access: aicAccess,
        generator_access: generatorAccess
      })
      .eq("id", existingMember.id)
      .select("id, email, active, aic_access, generator_access, created_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("members")
    .insert({
      email: clean,
      active,
      aic_access: aicAccess,
      generator_access: generatorAccess
    })
    .select("id, email, active, aic_access, generator_access, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function memberCanUseCalculator(member, accessType) {
  if (!member || member.active !== true) {
    return false;
  }

  const access = memberAccessValues(member);

  if (accessType === "aic") {
    return access.aicAccess;
  }

  if (accessType === "generator") {
    return access.generatorAccess;
  }

  if (accessType === "both") {
    return access.aicAccess && access.generatorAccess;
  }

  return access.aicAccess || access.generatorAccess;
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    app: "LoadCalcPro Access Server",
    database: "Supabase",
    calculatorAccess: "version-2-enabled"
  });
});

app.get("/health", async (req, res) => {
  try {
    const { error } = await supabase.from("members").select("id").limit(1);

    if (error) {
      throw error;
    }

    return res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Health check failed:", error);
    return res.status(500).json({
      status: "error",
      database: "not connected"
    });
  }
});

app.post("/api/v2/access", async (req, res) => {
  try {
    const authUser = await authenticatedUserFromRequest(req);

    if (!authUser?.email) {
      return res.status(401).json({
        active: false,
        authenticated: false,
        message: "Please sign in with your email and password."
      });
    }

    const requestedAccess =
      normalizeAccessType(req.body?.calculator) ||
      normalizeAccessType(req.body?.product);

    if (!requestedAccess) {
      return res.status(400).json({
        active: false,
        authenticated: true,
        message: "A valid calculator must be selected."
      });
    }

    const email = cleanEmail(authUser.email);
    const member = await findMember(email);

    if (!member || member.active !== true) {
      return res.status(403).json({
        active: false,
        authenticated: true,
        message: "Active membership not found."
      });
    }

    if (!memberCanUseCalculator(member, requestedAccess)) {
      const calculatorName =
        requestedAccess === "aic"
          ? "AIC Calculator"
          : requestedAccess === "generator"
            ? "Optional Method Generator Calculator"
            : "requested calculator";

      return res.status(403).json({
        active: false,
        authenticated: true,
        message: `Your membership does not include the ${calculatorName}.`
      });
    }

    const access = memberAccessValues(member);

    return res.json({
      active: true,
      authenticated: true,
      status: "active",
      access: true,
      allowed: true,
      message: "Access approved.",
      email,
      calculator: requestedAccess,
      aic_access: access.aicAccess,
      generator_access: access.generatorAccess
    });
  } catch (error) {
    console.error("Version 2 access check failed:", error);
    return res.status(500).json({
      active: false,
      authenticated: false,
      message: "Unable to verify membership right now."
    });
  }
});

app.post("/api/access", async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        active: false,
        message: "Please enter a valid email address."
      });
    }

    if (isFakeEmail(email)) {
      return res.status(400).json({
        active: false,
        message: "This email address cannot be used."
      });
    }

    const requestedAccess =
      normalizeAccessType(req.body?.calculator) ||
      normalizeAccessType(req.body?.product);

    const member = await findMember(email);

    if (!member || member.active !== true) {
      return res.status(403).json({
        active: false,
        message: "Active membership not found."
      });
    }

    if (
      requestedAccess &&
      !memberCanUseCalculator(member, requestedAccess)
    ) {
      const calculatorName =
        requestedAccess === "aic"
          ? "AIC Calculator"
          : "Optional Method Generator Calculator";

      return res.status(403).json({
        active: false,
        message: `Your membership does not include the ${calculatorName}.`
      });
    }

    const access = memberAccessValues(member);

    return res.json({
      active: true,
      status: "active",
      message: "Access approved.",
      email,
      aic_access: access.aicAccess,
      generator_access: access.generatorAccess
    });
  } catch (error) {
    console.error("Access check failed:", error);
    return res.status(500).json({
      active: false,
      message: "Unable to verify membership right now."
    });
  }
});

app.post("/payhip-webhook", async (req, res) => {
  try {
    console.log("Payhip webhook received.");

    const eventType = findEventType(req.body);
    const email = cleanEmail(findEmailInPayload(req.body));
    const productName = findProductName(req.body);
    const accessType = accessTypeFromProductName(productName);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "No valid email was found in the Payhip webhook."
      });
    }

    if (!accessType) {
      console.warn(
        "Webhook product was not recognized:",
        productName || "(missing product name)"
      );

      return res.json({
        success: true,
        action: "ignored_unrecognized_product",
        eventType,
        email,
        productName
      });
    }

    const activateEvents = [
      "paid",
      "sale.created",
      "sale_created",
      "subscription.created",
      "subscription_created",
      "subscription.activated",
      "subscription_activated",
      "subscription.payment_succeeded",
      "subscription_payment_succeeded"
    ];

    const deactivateEvents = [
      "refunded",
      "subscription.deleted",
      "subscription_deleted",
      "subscription.cancelled",
      "subscription.canceled",
      "subscription_canceled",
      "subscription_cancelled",
      "subscription.deactivated",
      "subscription_deactivated",
      "subscription.expired",
      "subscription_expired"
    ];

    if (activateEvents.includes(eventType)) {
      const member = await setMemberAccess(email, accessType, true);

      // New customers receive their create-password email. Existing
      // Supabase Auth users are detected and are not invited again.
      const invitation = await inviteMemberToCreatePassword(email);

      return res.json({
        success: true,
        action: "calculator_access_activated",
        email: member.email,
        productName,
        accessType,
        active: member.active,
        aic_access: member.aic_access,
        generator_access: member.generator_access,
        invitation
      });
    }

    if (deactivateEvents.includes(eventType)) {
      const member = await setMemberAccess(email, accessType, false);

      return res.json({
        success: true,
        action: "calculator_access_deactivated",
        email: member.email,
        productName,
        accessType,
        active: member.active,
        aic_access: member.aic_access,
        generator_access: member.generator_access
      });
    }

    return res.json({
      success: true,
      action: "ignored_event",
      eventType,
      email,
      productName,
      accessType
    });
  } catch (error) {
    console.error("Payhip webhook failed:", error);
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed."
    });
  }
});

app.post("/api/add-member", requireAdminKey, async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const accessType = normalizeAccessType(
      req.body?.access || req.body?.calculator || "generator"
    );

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email."
      });
    }

    if (isFakeEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "This email address cannot be used."
      });
    }

    const member = await setMemberAccess(email, accessType, true);

    return res.json({
      success: true,
      message: "Member access activated.",
      email: member.email,
      accessType,
      active: member.active,
      aic_access: member.aic_access,
      generator_access: member.generator_access
    });
  } catch (error) {
    console.error("Add-member failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to activate member."
    });
  }
});

app.post("/api/remove-member", requireAdminKey, async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const accessType = normalizeAccessType(
      req.body?.access || req.body?.calculator || "generator"
    );

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email."
      });
    }

    const existingMember = await findMember(email);

    if (!existingMember) {
      return res.json({
        success: true,
        message: "Member was not found.",
        email,
        active: false
      });
    }

    const member = await setMemberAccess(email, accessType, false);

    return res.json({
      success: true,
      message: "Member access deactivated.",
      email: member.email,
      accessType,
      active: member.active,
      aic_access: member.aic_access,
      generator_access: member.generator_access
    });
  } catch (error) {
    console.error("Remove-member failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to deactivate member."
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

app.listen(PORT, () => {
  console.log(`LoadCalcPro access server running on port ${PORT}`);
});

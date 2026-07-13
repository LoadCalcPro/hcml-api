const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
  );
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type"
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    cleanEmail(email)
  );
}

function isFakeEmail(email) {
  const clean = cleanEmail(email);
  const domain = clean.split("@")[1];

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

async function findMember(email) {
  const clean = cleanEmail(email);

  const { data, error } = await supabase
    .from("members")
    .select("id, email, active, created_at")
    .eq("email", clean)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function addOrReactivateMember(email) {
  const clean = cleanEmail(email);

  if (!isValidEmail(clean)) {
    throw new Error("Invalid email address.");
  }

  const existingMember = await findMember(clean);

  if (existingMember) {
    const { data, error } = await supabase
      .from("members")
      .update({
        active: true
      })
      .eq("id", existingMember.id)
      .select("id, email, active, created_at")
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
      active: true
    })
    .select("id, email, active, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function deactivateMember(email) {
  const clean = cleanEmail(email);

  if (!isValidEmail(clean)) {
    throw new Error("Invalid email address.");
  }

  const existingMember = await findMember(clean);

  if (!existingMember) {
    return null;
  }

  const { data, error } = await supabase
    .from("members")
    .update({
      active: false
    })
    .eq("id", existingMember.id)
    .select("id, email, active, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    app: "LoadCalcPro Access Server",
    database: "Supabase"
  });
});

app.get("/health", async (req, res) => {
  try {
    const { error } = await supabase
      .from("members")
      .select("id")
      .limit(1);

    if (error) {
      throw error;
    }

    return res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return res.status(500).json({
      status: "error",
      database: "not connected"
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

    const member = await findMember(email);

    if (!member || member.active !== true) {
      return res.status(403).json({
        active: false,
        message: "Active membership not found."
      });
    }

    return res.json({
      active: true,
      status: "active",
      message: "Access approved."
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
    console.log(
      "Payhip webhook received:",
      JSON.stringify(req.body, null, 2)
    );

    const eventType = findEventType(req.body);
    const email = cleanEmail(
      findEmailInPayload(req.body)
    );

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message:
          "No valid email was found in the Payhip webhook."
      });
    }

    const addEvents = [
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
      "subscription.deleted",
      "subscription_deleted",
      "subscription.cancelled",
      "subscription_canceled",
      "subscription_cancelled",
      "subscription.deactivated",
      "subscription_deactivated",
      "subscription.expired",
      "subscription_expired"
    ];

    if (addEvents.includes(eventType)) {
      const member =
        await addOrReactivateMember(email);

      return res.json({
        success: true,
        action: "member_activated",
        email: member.email,
        active: member.active
      });
    }

    if (deactivateEvents.includes(eventType)) {
      const member = await deactivateMember(email);

      return res.json({
        success: true,
        action: "member_deactivated",
        email,
        active: member ? member.active : false
      });
    }

    return res.json({
      success: true,
      action: "ignored",
      eventType,
      email
    });
  } catch (error) {
    console.error("Payhip webhook failed:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed."
    });
  }
});

/*
  These two routes are useful for testing.

  They should not be left publicly available permanently
  unless an admin password or other security check is added.
*/

app.post("/api/add-member", async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);

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

    const member =
      await addOrReactivateMember(email);

    return res.json({
      success: true,
      message: "Member activated.",
      email: member.email,
      active: member.active
    });
  } catch (error) {
    console.error("Add-member failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to add member."
    });
  }
});

app.post("/api/remove-member", async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email."
      });
    }

    const member = await deactivateMember(email);

    return res.json({
      success: true,
      message: member
        ? "Member deactivated."
        : "Member was not found.",
      email,
      active: false
    });
  } catch (error) {
    console.error("Remove-member failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to deactivate member."
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
  console.log(
    `LoadCalcPro access server running on port ${PORT}`
  );
});

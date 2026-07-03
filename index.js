const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    app: "LoadCalcPro Access Server"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
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

app.post("/api/access", (req, res) => {
  const email = cleanEmail(req.body.email);

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

  if (email !== "amitshamir497@gmail.com") {
    return res.status(403).json({
      active: false,
      message: "Membership not found."
    });
  }

  return res.json({
    active: true,
    status: "active",
    message: "Access approved."
  });
});

app.listen(PORT, () => {
  console.log(`LoadCalcPro access server running on port ${PORT}`);
});

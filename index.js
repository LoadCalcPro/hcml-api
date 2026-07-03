const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const MEMBERS_FILE = path.join(__dirname, "active_members.json");

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

function loadMembers() {
  try {
    if (!fs.existsSync(MEMBERS_FILE)) {
      fs.writeFileSync(
        MEMBERS_FILE,
        JSON.stringify(["amitshamir497@gmail.com"], null, 2)
      );
    }

    const data = fs.readFileSync(MEMBERS_FILE, "utf8");
    return JSON.parse(data).map(cleanEmail);
  } catch (error) {
    console.error("Error loading members:", error);
    return ["amitshamir497@gmail.com"];
  }
}

function saveMembers(members) {
  fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2));
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    app: "LoadCalcPro Access Server"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

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

  const members = loadMembers();

  if (!members.includes(email)) {
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

app.post("/api/add-member", (req, res) => {
  const email = cleanEmail(req.body.email);

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email."
    });
  }

  const members = loadMembers();

  if (!members.includes(email)) {
    members.push(email);
    saveMembers(members);
  }

  res.json({
    success: true,
    message: "Member added.",
    email
  });
});

app.post("/api/remove-member", (req, res) => {
  const email = cleanEmail(req.body.email);

  const members = loadMembers();
  const updatedMembers = members.filter(member => member !== email);

  saveMembers(updatedMembers);

  res.json({
    success: true,
    message: "Member removed.",
    email
  });
});

app.listen(PORT, () => {
  console.log(`LoadCalcPro access server running on port ${PORT}`);
});

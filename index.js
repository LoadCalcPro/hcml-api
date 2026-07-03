const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Home route - stops missing index.html error
app.get("/", (req, res) => {
  res.json({
    status: "LoadCalcPro API running",
    service: "hcml-api"
  });
});

// Temporary approved email list from Render Environment
// Example Render variable:
// APPROVED_EMAILS=your@email.com,customer@email.com
function getApprovedEmails() {
  return (process.env.APPROVED_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

// Calculator access check
app.post("/api/access", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const calculator = String(req.body.calculator || "generator-nec2023");

  if (!email || !email.includes("@")) {
    return res.status(400).json({
      active: false,
      message: "Please enter a valid email address."
    });
  }

  const approvedEmails = getApprovedEmails();

  if (approvedEmails.includes(email)) {
    return res.json({
      active: true,
      calculator,
      message: "Access approved."
    });
  }

  return res.status(403).json({
    active: false,
    calculator,
    message: "No active membership found for this email."
  });
});

// Keep old submit route
app.post("/submit", (req, res) => {
  res.json({
    success: true,
    message: "Form submitted successfully",
    received: req.body
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

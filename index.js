const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.options("*", cors());

app.use(express.json());

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
  const email = String(req.body.email || "").trim().toLowerCase();

  if (email === "amitshamir497@gmail.com") {
    return res.json({
      active: true,
      status: "active",
      message: "Access approved."
    });
  }

  return res.status(403).json({
    active: false,
    message: "Membership not found."
  });
});

app.listen(PORT, () => {
  console.log(`LoadCalcPro access server running on port ${PORT}`);
});

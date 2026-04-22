const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Example API route
app.post("/submit", (req, res) => {
  try {
    const data = req.body;

    console.log("Received form data:", data);

    res.json({
      success: true,
      message: "Form submitted successfully",
      received: data
    });
  } catch (error) {
    console.error("Error in /submit:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Main route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

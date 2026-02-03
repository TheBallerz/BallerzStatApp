const express = require("express");

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({ ok: true, message: "backend is alive" });
  });
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
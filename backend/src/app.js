const organizationRoutes = require("./routes/organizationRoutes");
const tenantRoutes = require("./routes/tenantRoutes");
const boardRoutes = require("./routes/boardRoutes");
const taskRoutes = require("./routes/taskRoutes");
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const columnRoutes = require("./routes/columnRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "100kb" }));
app.use("/api/organizations", organizationRoutes);
app.use("/api/organizations", tenantRoutes);
app.use("/api/tenants", boardRoutes);
app.use("/api/tenants", columnRoutes);
app.use("/api/tenants", taskRoutes);

app.get("/", (req, res) => {
  res.json({
    name: "Collaborative Kanban API",
    status: "running",
    version: "1.0.0"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Kanban API is running"
  });
});

app.use("/api/auth", authRoutes);

module.exports = app;

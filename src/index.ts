import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./auth/routes";
import { workspaceRoutes } from "./routes/workspaces";
import { categoryRoutes } from "./routes/categories";
import { accountRoutes } from "./routes/accounts";
import { transactionRoutes } from "./routes/transactions";
import { invoiceRoutes } from "./routes/invoices";
import { dashboardRoutes } from "./routes/dashboard";
import { documentRoutes } from "./routes/documents";

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }))
  .use(authRoutes)
  .use(workspaceRoutes)
  .use(categoryRoutes)
  .use(accountRoutes)
  .use(transactionRoutes)
  .use(invoiceRoutes)
  .use(dashboardRoutes)
  .use(documentRoutes)
  .get("/", () => ({
    message: "NovaJournal API",
    version: "1.0.0",
    status: "operational",
  }))

  // Health check
  .get("/health", () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }))

  .listen(8080);

console.log(
  `🚀 NovaJournal API running at http://${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 API Documentation: http://localhost:8080/api/docs`);

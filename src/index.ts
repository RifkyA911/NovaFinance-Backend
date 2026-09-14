import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./auth/routes";
import { workspaceRoutes } from "./routes/workspaces";
import { categoryRoutes } from "./routes/categories";
import { accountRoutes } from "./routes/accounts";
import { transactionRoutes } from "./routes/transactions";
import { invoiceRoutes } from "./routes/invoices";
import { dashboardRoutes } from "./routes/dashboard";
import { aiRoutes } from "./routes/ai";
import { documentRoutes, apiDocumentRoutes } from "./routes/documents";

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: 'NovaJournal API',
        version: '1.0.0',
        description: 'Personal finance tracking API with AI-powered document analysis',
      },
      tags: [
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Workspaces', description: 'Workspace management' },
        { name: 'Categories', description: 'Category management' },
        { name: 'Accounts', description: 'Account management' },
        { name: 'Transactions', description: 'Transaction management' },
        { name: 'Invoices', description: 'Invoice management' },
        { name: 'Dashboard', description: 'Dashboard data' },
        { name: 'AI', description: 'AI-powered features' },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter your session token from login response',
          },
        },
      },
    },
  }))
  .use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-captcha-token'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }))
  .use(authRoutes)
  .use(workspaceRoutes)
  .use(categoryRoutes)
  .use(accountRoutes)
  .use(transactionRoutes)
  .use(invoiceRoutes)
  .use(dashboardRoutes)
  .use(aiRoutes)
  .use(documentRoutes)
  .use(apiDocumentRoutes)
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
  .onError(({ code, error }) => {
    console.error('Elysia Error:', code, error);
  })

  .listen(8080);

console.log(
  `🚀 NovaJournal API running at http://${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 API Documentation: http://localhost:8080/swagger`);

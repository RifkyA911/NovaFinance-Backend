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
import { goalRoutes } from "./routes/goals";
import { logRoutes } from "./routes/logs";

const app = new Elysia()
  .use(swagger({
    exclude: ['/documents', /^\/documents(\/.*)?$/],
    documentation: {
      info: {
        title: 'NovaJournal Financial Core Engine & Bookkeeping API',
        version: '1.2.0',
        description: 'High-performance personal & enterprise financial accounting API with multi-workspace support, granular RBAC (Owner, Admin, Staff, Viewer), multi-provider AI document intelligence (Gemini OCR, Groq, DeepSeek, Claude), double-entry ledger reconciliation, and Model Context Protocol (MCP) tool interfaces.',
        contact: {
          name: 'NovaJournal Engineering Team',
          url: 'http://localhost:3000',
        },
      },
      tags: [
        { name: 'Auth', description: 'Authentication, BetterAuth session tokens, and identity management' },
        { name: 'Workspaces', description: 'Multi-workspace lifecycle, role delegation, and collaborator governance' },
        { name: 'Categories', description: 'Custom & preset income/expense classification hierarchy' },
        { name: 'Accounts', description: 'Multi-currency liquidity vaults, bank accounts, and e-wallets' },
        { name: 'Transactions', description: 'Double-entry bookkeeping, income/expense logging, and reconciliation' },
        { name: 'Goals', description: 'Financial goals, wishlist tracking, priority reordering, and savings velocity' },
        { name: 'Invoices', description: 'Client billing, receivables tracking, itemized quotes, and payment statuses' },
        { name: 'Dashboard', description: 'Aggregated financial metrics, cashflow trends, and balance projections' },
        { name: 'Documents', description: 'MinIO S3 receipt upload, Gemini OCR extraction, and transaction linking' },
        { name: 'AI', description: 'Multi-provider AI financial insights, stress tests, and automated audit checks' },
        { name: 'Logs', description: 'Tamper-evident audit trails, governance events, and immutable system activity' },
        { name: 'System', description: 'Service health check, operational diagnostics, and system timestamp' },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter session token or Bearer JWT token',
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
  .use(goalRoutes)
  .use(invoiceRoutes)
  .use(dashboardRoutes)
  .use(aiRoutes)
  .use(documentRoutes)
  .use(apiDocumentRoutes)
  .use(logRoutes)
  .get("/", () => ({
    message: "NovaJournal API",
    version: "1.0.0",
    status: "operational",
  }), {
    detail: {
      tags: ['System'],
      summary: 'API index',
      description: 'Get API service name, version, and operational status.',
    },
  })

  // Health check
  .get("/health", () => ({
    status: "healthy",
    timestamp: new Date().toISOString(),
  }), {
    detail: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Check service health status and current timestamp.',
    },
  })
  .onError(({ code, error }) => {
    console.error('Elysia Error:', code, error);
  })

  .listen(8080);

console.log(
  `🚀 NovaJournal API running at http://${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 API Documentation: http://localhost:8080/swagger`);

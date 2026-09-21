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
import { menuRoutes } from "./routes/menus";
import { userRoutes } from "./routes/user";

const app = new Elysia()
  .use(swagger({
    exclude: ['/documents', /^\/documents(\/.*)?$/],
    documentation: {
      info: {
        title: 'NovaFinance Financial Core Engine & Bookkeeping API',
        version: '1.3.0',
        description: 'High-performance personal & enterprise financial accounting API with multi-workspace support, granular RBAC (Owner, Admin, Staff, Viewer), multi-provider AI document intelligence (Gemini OCR, Groq, DeepSeek, Claude), double-entry ledger reconciliation, RabbitMQ asynchronous event broker, and Model Context Protocol (MCP) tool interfaces.',
        contact: {
          name: 'NovaFinance Engineering Team',
          url: 'http://localhost:3000',
        },
      },
      tags: [
        { name: 'Auth', description: 'Authentication, BetterAuth session tokens, and identity management' },
        { name: 'User', description: 'User profile management, personal preferences, and MinIO avatar storage' },
        { name: 'Workspaces', description: 'Multi-workspace lifecycle, role delegation, and collaborator governance' },
        { name: 'Menus', description: 'Dynamic navigation menu visibility, custom labels, and sidebar order' },
        { name: 'Categories', description: 'Custom & preset income/expense classification hierarchy' },
        { name: 'Accounts', description: 'Multi-currency liquidity vaults, bank accounts, and e-wallets' },
        { name: 'Transactions', description: 'Double-entry bookkeeping, income/expense logging, and reconciliation' },
        { name: 'Goals', description: 'Financial goals, wishlist tracking, priority reordering, and savings velocity' },
        { name: 'Invoices', description: 'Client billing, receivables tracking, itemized quotes, and payment statuses' },
        { name: 'Dashboard', description: 'Aggregated financial metrics, cashflow trends, and balance projections' },
        { name: 'Documents', description: 'MinIO S3 receipt upload, Gemini OCR extraction, and transaction linking' },
        { name: 'AI', description: 'Multi-provider AI financial insights, stress tests, and automated audit checks' },
        { name: 'Logs', description: 'Tamper-evident audit trails, governance events, and immutable system activity' },
        { name: 'Broker', description: 'RabbitMQ message broker event streams and asynchronous background task queues' },
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
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3050', 'http://127.0.0.1:3050'],
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
  .use(menuRoutes)
  .use(userRoutes)
  .get("/", () => ({
    message: "NovaFinance API",
    version: "1.3.0",
    status: "operational",
    docs: "/swagger",
  }), {
    detail: {
      tags: ['System'],
      summary: 'API index',
      description: 'Get API service name, version, documentation link, and operational status.',
    },
  })

  // Health check
  .get("/health", () => ({
    status: "healthy",
    version: "1.3.0",
    timestamp: new Date().toISOString(),
  }), {
    detail: {
      tags: ['System'],
      summary: 'Health check',
      description: 'Check service health status, current API version, and server timestamp.',
    },
  })

  // Message Broker status
  .get("/api/broker/status", () => {
    const brokerUrl = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
    const mgmtUrl = process.env.RABBITMQ_MANAGEMENT_URL || "http://localhost:15672";
    return {
      success: true,
      data: {
        broker: "RabbitMQ",
        version: "3.x",
        amqpUrl: brokerUrl.replace(/:[^:]*@/, ":***@"),
        managementWebUI: mgmtUrl,
        supportedQueues: [
          "novafinance.documents.ocr",
          "novafinance.invoices.pdf",
          "novafinance.reports.export",
          "novafinance.audit.events",
        ],
        status: "configured",
      },
    };
  }, {
    detail: {
      tags: ['Broker'],
      summary: 'Get message broker operational status',
      description: 'Check status of connected RabbitMQ message broker instance, active AMQP connection endpoint, and registered job queues.',
    },
  })
  .onError(({ code, error }) => {
    console.error('Elysia Error:', code, error);
  })

  .listen(8080);

console.log(
  `🚀 NovaFinance API running at http://${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 API Documentation: http://localhost:8080/swagger`);

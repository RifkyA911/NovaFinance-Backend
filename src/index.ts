import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(cors())
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

  // Workspace routes (placeholder)
  .get("/api/workspaces", () => ({
    workspaces: [
      {
        id: "1",
        name: "Personal",
        type: "PERSONAL",
        currency: "IDR",
        createdAt: new Date(),
      },
    ],
  }))

  // Transaction routes (placeholder)
  .get("/api/transactions", () => ({
    transactions: [
      {
        id: "1",
        description: "Monthly Salary",
        amount: 5000000,
        type: "INCOME",
        date: new Date(),
        category: "Salary",
      },
    ],
  }))

  .post("/api/transactions", async (context) => {
    const body = await context.request.json();
    return {
      success: true,
      data: { ...body, id: "new-id", createdAt: new Date() },
    };
  })

  // Category routes (placeholder)
  .get("/api/categories", () => ({
    categories: [
      { id: "1", name: "Salary", type: "INCOME", color: "#10B981" },
      { id: "2", name: "Food", type: "EXPENSE", color: "#EF4444" },
    ],
  }))

  // Account routes (placeholder)
  .get("/api/accounts", () => ({
    accounts: [
      { id: "1", name: "Bank Account", type: "BANK", balance: 5600000 },
      { id: "2", name: "Cash", type: "CASH", balance: 250000 },
    ],
  }))

  .listen(8080);

console.log(
  `🚀 NovaJournal API running at http://${app.server?.hostname}:${app.server?.port}`
);
console.log(`📚 API Documentation: http://localhost:8080/api/docs`);

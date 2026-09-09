import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./config";
import * as schema from "../db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.account,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-min-32-chars-long",
  trustedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  advanced: {
    useSecureCookies: false,
  },
});

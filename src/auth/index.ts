import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import bcrypt from "bcryptjs";
import { db } from "./config";
import * as authSchema from "../db/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 6,
    password: {
      hash: async (password) => await bcrypt.hash(password, 10),
      verify: async ({ hash, password }) => await bcrypt.compare(password, hash),
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-min-32-chars-long",
  trustedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  advanced: {
    useSecureCookies: false,
    disableCSRFCheck: true,
    cookiePrefix: 'better-auth',
  },
});

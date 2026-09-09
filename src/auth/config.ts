import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'novajournal',
});

export const db = drizzle(pool);

export async function signUp(email: string, password: string, name: string) {
  const hashedPassword = password; // TODO: Add bcrypt hashing
  const [user] = await db.insert(schema.users).values({
    email,
    name,
    passwordHash: hashedPassword,
  }).returning();
  return user;
}

export async function signIn(email: string, password: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user || user.passwordHash !== password) {
    return null;
  }
  // Create session
  const [session] = await db.insert(schema.sessions).values({
    userId: user.id,
    token: generateToken(),
    expiresAt: new Date(Date.now() + 60 * 60 * 24 * 7 * 1000), // 7 days
  }).returning();
  return { user, session };
}

export async function getSession(token: string) {
  const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.token, token));
  if (!session || new Date(session.expiresAt) < new Date()) {
    return null;
  }
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.userId));
  return { user, session };
}

export async function signOut(token: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  return { success: true };
}

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

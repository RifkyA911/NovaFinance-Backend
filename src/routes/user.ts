import { Elysia, t } from "elysia";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { requireAuth } from "../middleware/auth";
import { db } from "../auth/config";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

// MinIO S3 Client
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "minio",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "minio123",
  },
  forcePathStyle: true,
});

const BUCKET_NAME = "novajournal-documents";

export const userRoutes = new Elysia({ prefix: "/api/user" })
  // ── 1. GET User Profile ────────────────────────────────────────────────
  .get("/profile", async ({ headers, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || "Unauthorized", code: "UNAUTHORIZED" };
    }

    try {
      const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, authResult.user.id))
        .limit(1);

      if (!currentUser) {
        set.status = 404;
        return { success: false, error: "User not found", code: "NOT_FOUND" };
      }

      return {
        success: true,
        data: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          image: currentUser.image,
          jobTitle: currentUser.jobTitle || "",
          department: currentUser.department || "",
          phone: currentUser.phone || "",
          bio: currentUser.bio || "",
          timezone: currentUser.timezone || "Asia/Jakarta",
          lang: currentUser.lang || "id",
          createdAt: currentUser.createdAt,
          updatedAt: currentUser.updatedAt,
        },
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message || "Failed to fetch profile", code: "INTERNAL_ERROR" };
    }
  }, {
    detail: {
      tags: ["User"],
      summary: "Get current user profile",
      description: "Retrieve profile information and avatar for authenticated user from PostgreSQL database.",
      security: [{ BearerAuth: [] }],
    },
  })

  // ── 2. PUT Update User Profile ─────────────────────────────────────────
  .put("/profile", async ({ headers, body, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || "Unauthorized", code: "UNAUTHORIZED" };
    }

    try {
      const updatePayload: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) updatePayload.name = body.name;
      if (body.jobTitle !== undefined) updatePayload.jobTitle = body.jobTitle;
      if (body.department !== undefined) updatePayload.department = body.department;
      if (body.phone !== undefined) updatePayload.phone = body.phone;
      if (body.bio !== undefined) updatePayload.bio = body.bio;
      if (body.timezone !== undefined) updatePayload.timezone = body.timezone;
      if (body.lang !== undefined) updatePayload.lang = body.lang;
      if (body.image !== undefined) updatePayload.image = body.image;

      const [updatedUser] = await db
        .update(users)
        .set(updatePayload)
        .where(eq(users.id, authResult.user.id))
        .returning();

      return {
        success: true,
        message: "Profile updated successfully",
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          image: updatedUser.image,
          jobTitle: updatedUser.jobTitle || "",
          department: updatedUser.department || "",
          phone: updatedUser.phone || "",
          bio: updatedUser.bio || "",
          timezone: updatedUser.timezone || "Asia/Jakarta",
          lang: updatedUser.lang || "id",
        },
      };
    } catch (error: any) {
      set.status = 500;
      return { success: false, error: error.message || "Failed to update profile", code: "INTERNAL_ERROR" };
    }
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      jobTitle: t.Optional(t.String()),
      department: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      bio: t.Optional(t.String()),
      timezone: t.Optional(t.String()),
      lang: t.Optional(t.String()),
      image: t.Optional(t.String()),
    }),
    detail: {
      tags: ["User"],
      summary: "Update user profile",
      description: "Update personal profile information in PostgreSQL database.",
      security: [{ BearerAuth: [] }],
    },
  })

  // ── 3. POST Upload Avatar to MinIO S3 & Update Database ───────────────
  .post("/avatar", async ({ headers, body, set }) => {
    const authResult = await requireAuth(headers);
    if (authResult.error || !authResult.user) {
      set.status = authResult.status || 401;
      return { success: false, error: authResult.error || "Unauthorized", code: "UNAUTHORIZED" };
    }

    try {
      let fileBuffer: Buffer;
      let contentType = "image/webp";
      let extension = "webp";

      // Support base64 JSON payload
      if (body.dataUrl) {
        const matches = body.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          contentType = matches[1];
          fileBuffer = Buffer.from(matches[2], "base64");
          if (contentType.includes("gif")) extension = "gif";
          else if (contentType.includes("png")) extension = "png";
          else if (contentType.includes("jpeg") || contentType.includes("jpg")) extension = "jpg";
          else extension = "webp";
        } else {
          // If raw base64 without prefix
          fileBuffer = Buffer.from(body.dataUrl, "base64");
        }
      } else if (body.file && typeof body.file === "object" && "arrayBuffer" in body.file) {
        // Multipart File upload
        const fileObj = body.file as File;
        contentType = fileObj.type || "image/webp";
        if (contentType.includes("gif") || fileObj.name?.endsWith(".gif")) extension = "gif";
        else if (contentType.includes("png")) extension = "png";
        else if (contentType.includes("jpeg") || contentType.includes("jpg")) extension = "jpg";
        else extension = "webp";
        const arr = await fileObj.arrayBuffer();
        fileBuffer = Buffer.from(arr);
      } else {
        set.status = 400;
        return { success: false, error: "No image file or dataUrl provided", code: "VALIDATION_ERROR" };
      }

      const filename = `avatar-${authResult.user.id}-${Date.now()}.${extension}`;
      // Structured MinIO Key: NovaFinance/users/{userId}/avatars/{filename}
      const s3Key = `NovaFinance/users/${authResult.user.id}/avatars/${filename}`;

      // Upload to MinIO S3
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: contentType,
          ContentLength: fileBuffer.length,
        })
      );

      // Construct publicly accessible URL via backend proxy or MinIO
      const avatarUrl = `http://localhost:8080/api/user/avatar/${filename}`;

      // Update user.image in PostgreSQL database
      const [updatedUser] = await db
        .update(users)
        .set({
          image: avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, authResult.user.id))
        .returning();

      return {
        success: true,
        message: "Avatar uploaded to MinIO and saved to database successfully",
        avatarUrl,
        data: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          image: updatedUser.image,
        },
      };
    } catch (error: any) {
      console.error("Avatar upload failed:", error);
      set.status = 500;
      return { success: false, error: error.message || "Failed to upload avatar", code: "UPLOAD_ERROR" };
    }
  }, {
    body: t.Object({
      dataUrl: t.Optional(t.String()),
      file: t.Optional(t.Any()),
    }),
    detail: {
      tags: ["User"],
      summary: "Upload profile avatar to MinIO S3",
      description: "Uploads avatar image (GIF, WebP, PNG, JPG) to MinIO S3 structured storage NovaFinance/users/{userId}/avatars/ and persists image URL in PostgreSQL database.",
      security: [{ BearerAuth: [] }],
    },
  })

  // ── 4. GET Stream Avatar from MinIO S3 ──────────────────────────────────
  .get("/avatar/:filename", async ({ params, set }) => {
    try {
      // Extract userId from filename if available (avatar-{userId}-{timestamp}.ext)
      const parts = params.filename.split("-");
      let primaryKey = `NovaFinance/avatars/${params.filename}`;
      let secondaryKey = `avatars/${params.filename}`;
      if (parts.length >= 3 && parts[0] === "avatar") {
        const userId = parts.slice(1, parts.length - 1).join("-");
        primaryKey = `NovaFinance/users/${userId}/avatars/${params.filename}`;
        secondaryKey = `users/${userId}/avatars/${params.filename}`;
      }

      let response;
      try {
        response = await s3Client.send(new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: primaryKey,
        }));
      } catch {
        try {
          response = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: secondaryKey,
          }));
        } catch {
          // Fallback to legacy root path avatars/{filename}
          response = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `avatars/${params.filename}`,
          }));
        }
      }
      const contentType = response.ContentType || "image/webp";
      set.headers["Content-Type"] = contentType;
      set.headers["Cache-Control"] = "public, max-age=31536000, immutable";

      // Convert stream to Buffer
      const streamToBuffer = async (stream: any): Promise<Buffer> => {
        return new Promise((resolve, reject) => {
          const chunks: any[] = [];
          stream.on("data", (chunk: any) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
      };

      if (response.Body) {
        const buf = await streamToBuffer(response.Body);
        return new Response(new Uint8Array(buf), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      set.status = 404;
      return { success: false, error: "Avatar image not found" };
    } catch (error) {
      set.status = 404;
      return { success: false, error: "Avatar not found in storage" };
    }
  }, {
    params: t.Object({
      filename: t.String(),
    }),
    detail: {
      tags: ["User"],
      summary: "Serve avatar image from MinIO S3",
      description: "Stream binary avatar image stored in MinIO S3 with immutable cache headers.",
    },
  });

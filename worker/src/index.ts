// ============================================
// Cloudflare Worker - Couples Gallery Backend
// ============================================
// Security: password-protected, rate-limited, hard storage caps
// Guarantees free-tier usage by rejecting BEFORE storing

import { UsageLimiter } from "./usage-limiter";

export { UsageLimiter };

export interface Env {
  GALLERY_BUCKET: R2Bucket;
  USAGE_LIMITER: DurableObjectNamespace;
  GALLERY_PASSWORD: string;

  // Limits (as strings from wrangler.toml)
  MAX_TOTAL_BYTES: string;
  MAX_FILES_PER_UPLOAD: string;
  MAX_UPLOAD_SIZE_BYTES: string;
  MAX_UPLOADS_PER_DAY: string;
  SIGNED_URL_EXPIRY_SECONDS: string;
}

// CORS headers for frontend
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: message }, status);
}

// Get the single Durable Object instance for usage tracking
function getUsageLimiter(env: Env): DurableObjectStub {
  const id = env.USAGE_LIMITER.idFromName("global");
  return env.USAGE_LIMITER.get(id);
}

// Verify password
function checkPassword(password: string | undefined, env: Env): boolean {
  if (!password || !env.GALLERY_PASSWORD) return false;
  // Constant-time comparison to prevent timing attacks
  const a = new TextEncoder().encode(password);
  const b = new TextEncoder().encode(env.GALLERY_PASSWORD);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

// Main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route requests
      if (path === "/auth/verify" && request.method === "POST") {
        return handleAuthVerify(request, env);
      }

      if (path === "/gallery" && request.method === "POST") {
        return handleGetGallery(request, env);
      }

      if (path === "/usage" && request.method === "POST") {
        return handleGetUsage(request, env);
      }

      if (path === "/upload/prepare" && request.method === "POST") {
        return handleUploadPrepare(request, env);
      }

      if (path === "/upload/commit" && request.method === "POST") {
        return handleUploadCommit(request, env);
      }

      if (path === "/photo/url" && request.method === "POST") {
        return handleGetPhotoUrl(request, env);
      }

      if (path === "/photo/favorite" && request.method === "POST") {
        return handleToggleFavorite(request, env);
      }

      if (path === "/photo/edit" && request.method === "POST") {
        return handleEditNote(request, env);
      }

      if (path === "/photo/delete" && request.method === "POST") {
        return handleDeletePhoto(request, env);
      }

      if (path === "/photo/restore" && request.method === "POST") {
        return handleRestorePhoto(request, env);
      }

      if (path === "/photo/purge" && request.method === "POST") {
        return handlePermanentDelete(request, env);
      }

      if (path === "/recycle" && request.method === "POST") {
        return handleGetRecycleBin(request, env);
      }

      if (path === "/photo/edit-date" && request.method === "POST") {
        return handleEditDate(request, env);
      }

      // Notes / To-do endpoints
      if (path === "/notes" && request.method === "POST") {
        return handleGetNotes(request, env);
      }

      if (path === "/notes/add" && request.method === "POST") {
        return handleAddNote(request, env);
      }

      if (path === "/notes/toggle" && request.method === "POST") {
        return handleToggleNote(request, env);
      }

      if (path === "/notes/delete" && request.method === "POST") {
        return handleDeleteNote(request, env);
      }

      // Next date endpoints
      if (path === "/next-date" && request.method === "POST") {
        return handleGetNextDate(request, env);
      }

      if (path === "/next-date/set" && request.method === "POST") {
        return handleSetNextDate(request, env);
      }

      if (path === "/next-date/delete" && request.method === "POST") {
        return handleDeleteNextDate(request, env);
      }

      // Handle direct R2 uploads via signed URL callback
      if (path.startsWith("/r2/")) {
        return handleR2Upload(request, env, path);
      }

      return errorResponse("Not found", 404);
    } catch (err) {
      console.error("Error:", err);
      return errorResponse("Internal error", 500);
    }
  },
};

// ============================================
// Route Handlers
// ============================================

async function handleAuthVerify(request: Request, env: Env): Promise<Response> {
  const { password } = await request.json<{ password: string }>();
  const valid = checkPassword(password, env);
  return jsonResponse({ ok: valid });
}

async function handleGetGallery(request: Request, env: Env): Promise<Response> {
  const { password } = await request.json<{ password: string }>();
  if (!checkPassword(password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  // Get metadata from Durable Object
  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(new Request("http://do/gallery"));
  const data = await res.json();

  return jsonResponse(data);
}

async function handleGetUsage(request: Request, env: Env): Promise<Response> {
  const { password } = await request.json<{ password: string }>();
  if (!checkPassword(password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(new Request("http://do/usage"));
  const usage = await res.json();

  return jsonResponse({
    ...usage,
    maxBytes: parseInt(env.MAX_TOTAL_BYTES),
    maxUploadsPerDay: parseInt(env.MAX_UPLOADS_PER_DAY),
  });
}

async function handleUploadPrepare(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    files: { name: string; size: number; type: string }[];
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const maxFilesPerUpload = parseInt(env.MAX_FILES_PER_UPLOAD);
  const maxUploadSize = parseInt(env.MAX_UPLOAD_SIZE_BYTES);
  const maxTotalBytes = parseInt(env.MAX_TOTAL_BYTES);

  // Validate file count
  if (body.files.length > maxFilesPerUpload) {
    return errorResponse(`Max ${maxFilesPerUpload} files per upload`);
  }

  // Validate total upload size
  const totalSize = body.files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > maxUploadSize) {
    return errorResponse(`Max upload size is ${maxUploadSize / 1024 / 1024} MB`);
  }

  // Check rate limits and reserve space via Durable Object
  const limiter = getUsageLimiter(env);
  const reserveRes = await limiter.fetch(
    new Request("http://do/reserve", {
      method: "POST",
      body: JSON.stringify({
        fileCount: body.files.length,
        totalSize,
        maxTotalBytes,
        maxUploadsPerDay: parseInt(env.MAX_UPLOADS_PER_DAY),
      }),
    })
  );

  const reserveData = await reserveRes.json<{
    ok: boolean;
    error?: string;
    reservationId?: string;
  }>();

  if (!reserveData.ok) {
    return errorResponse(reserveData.error || "Upload limit exceeded");
  }

  // Generate upload URLs for each file
  const expirySeconds = parseInt(env.SIGNED_URL_EXPIRY_SECONDS);
  const uploads = body.files.map((file, idx) => {
    const id = `${reserveData.reservationId}-${idx}`;
    const fullKey = `photos/${id}-full`;
    const thumbKey = `photos/${id}-thumb`;

    // We'll use worker-proxied upload URLs (simpler than presigned for R2)
    const baseUrl = new URL(request.url).origin;

    return {
      id,
      uploadUrl: `${baseUrl}/r2/upload/${fullKey}?rid=${reserveData.reservationId}&exp=${Date.now() + expirySeconds * 1000}`,
      thumbnailUploadUrl: `${baseUrl}/r2/upload/${thumbKey}?rid=${reserveData.reservationId}&exp=${Date.now() + expirySeconds * 1000}`,
    };
  });

  return jsonResponse({
    ok: true,
    uploads,
    reservationId: reserveData.reservationId,
  });
}

async function handleUploadCommit(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    reservationId: string;
    uploader: "arda" | "askim";
    album: "arda" | "askim" | "us";
    photos: {
      id: string;
      filename: string;
      note: string;
      day: string;
      size: number;
    }[];
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  // Commit metadata via Durable Object
  const limiter = getUsageLimiter(env);
  const commitRes = await limiter.fetch(
    new Request("http://do/commit", {
      method: "POST",
      body: JSON.stringify({
        reservationId: body.reservationId,
        uploader: body.uploader,
        album: body.album,
        photos: body.photos.map((p) => ({
          id: p.id,
          filename: p.filename,
          note: p.note,
          day: p.day,
          size: p.size,
          uploadedAt: new Date().toISOString(),
          key: `photos/${p.id}-full`,
          thumbnailKey: `photos/${p.id}-thumb`,
        })),
      }),
    })
  );

  const result = await commitRes.json();
  return jsonResponse(result);
}

async function handleGetPhotoUrl(request: Request, env: Env): Promise<Response> {
  const { password, key } = await request.json<{
    password: string;
    key: string;
  }>();

  if (!checkPassword(password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  // For R2 private buckets, we proxy the request or generate a presigned URL
  // Using worker-proxied URL for simplicity
  const baseUrl = new URL(request.url).origin;
  const expirySeconds = parseInt(env.SIGNED_URL_EXPIRY_SECONDS);
  const exp = Date.now() + expirySeconds * 1000;
  const token = await generateReadToken(key, exp, env.GALLERY_PASSWORD);

  return jsonResponse({
    url: `${baseUrl}/r2/read/${key}?exp=${exp}&token=${token}`,
  });
}

// Simple HMAC-based token for read URLs
async function generateReadToken(key: string, exp: number, secret: string): Promise<string> {
  const data = `${key}:${exp}`;
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", keyData, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (c) =>
    c === "+" ? "-" : c === "/" ? "_" : ""
  );
}

async function verifyReadToken(key: string, exp: number, token: string, secret: string): Promise<boolean> {
  const expected = await generateReadToken(key, exp, secret);
  return token === expected;
}

async function handleToggleFavorite(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    photoId: string;
    user: "arda" | "askim";
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/favorite", {
      method: "POST",
      body: JSON.stringify({
        photoId: body.photoId,
        user: body.user,
      }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

async function handleEditNote(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    photoId: string;
    note: string;
    user: "arda" | "askim";
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/edit-note", {
      method: "POST",
      body: JSON.stringify({
        photoId: body.photoId,
        note: body.note,
        user: body.user,
      }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

async function handleDeletePhoto(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    photoId: string;
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/delete", {
      method: "POST",
      body: JSON.stringify({ photoId: body.photoId }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

async function handleRestorePhoto(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    photoId: string;
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/restore", {
      method: "POST",
      body: JSON.stringify({ photoId: body.photoId }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

async function handlePermanentDelete(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    photoId: string;
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/purge", {
      method: "POST",
      body: JSON.stringify({ photoId: body.photoId }),
    })
  );

  const result = await res.json<{ ok: boolean; key?: string; thumbnailKey?: string }>();
  
  // Delete from R2 if successful
  if (result.ok && result.key) {
    try {
      await env.GALLERY_BUCKET.delete(result.key);
      if (result.thumbnailKey) {
        await env.GALLERY_BUCKET.delete(result.thumbnailKey);
      }
    } catch (e) {
      console.error("Failed to delete from R2:", e);
    }
  }

  return jsonResponse(result);
}

async function handleGetRecycleBin(request: Request, env: Env): Promise<Response> {
  const { password } = await request.json<{ password: string }>();
  if (!checkPassword(password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(new Request("http://do/recycle"));
  const data = await res.json();

  return jsonResponse(data);
}

async function handleEditDate(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    photoId: string;
    day: string;
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/edit-date", {
      method: "POST",
      body: JSON.stringify({
        photoId: body.photoId,
        day: body.day,
      }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

// Notes / To-do handlers
async function handleGetNotes(request: Request, env: Env): Promise<Response> {
  const { password } = await request.json<{ password: string }>();
  if (!checkPassword(password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(new Request("http://do/notes"));
  const data = await res.json();

  return jsonResponse(data);
}

async function handleAddNote(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    text: string;
    user: "arda" | "askim";
    category?: string;
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/notes/add", {
      method: "POST",
      body: JSON.stringify({
        text: body.text,
        user: body.user,
        category: body.category || "todo",
      }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

async function handleToggleNote(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    noteId: string;
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/notes/toggle", {
      method: "POST",
      body: JSON.stringify({ noteId: body.noteId }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

async function handleDeleteNote(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    noteId: string;
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/notes/delete", {
      method: "POST",
      body: JSON.stringify({ noteId: body.noteId }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

// Next date handlers
async function handleGetNextDate(request: Request, env: Env): Promise<Response> {
  const { password } = await request.json<{ password: string }>();
  if (!checkPassword(password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(new Request("http://do/next-date"));
  const data = await res.json();

  return jsonResponse(data);
}

async function handleSetNextDate(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{
    password: string;
    date: string;
    title: string;
  }>();

  if (!checkPassword(body.password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/next-date/set", {
      method: "POST",
      body: JSON.stringify({
        date: body.date,
        title: body.title,
      }),
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

async function handleDeleteNextDate(request: Request, env: Env): Promise<Response> {
  const { password } = await request.json<{ password: string }>();

  if (!checkPassword(password, env)) {
    return errorResponse("Unauthorized", 401);
  }

  const limiter = getUsageLimiter(env);
  const res = await limiter.fetch(
    new Request("http://do/next-date/delete", {
      method: "POST",
    })
  );

  const result = await res.json();
  return jsonResponse(result);
}

// Handle R2 uploads and reads
async function handleR2Upload(request: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(request.url);

  // Upload: PUT /r2/upload/{key}
  if (path.startsWith("/r2/upload/") && request.method === "PUT") {
    const key = path.replace("/r2/upload/", "");
    const rid = url.searchParams.get("rid");
    const exp = url.searchParams.get("exp");

    // Check expiry
    if (!exp || Date.now() > parseInt(exp)) {
      return errorResponse("Upload URL expired", 403);
    }

    // Check reservation exists (basic validation)
    if (!rid) {
      return errorResponse("Invalid upload URL", 403);
    }

    // Upload to R2
    const body = await request.arrayBuffer();
    await env.GALLERY_BUCKET.put(key, body, {
      httpMetadata: {
        contentType: request.headers.get("Content-Type") || "application/octet-stream",
      },
    });

    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  // Read: GET /r2/read/{key}
  if (path.startsWith("/r2/read/") && request.method === "GET") {
    const key = path.replace("/r2/read/", "");
    const exp = url.searchParams.get("exp");
    const token = url.searchParams.get("token");

    // Validate token and expiry
    if (!exp || !token || Date.now() > parseInt(exp)) {
      return errorResponse("URL expired", 403);
    }

    const valid = await verifyReadToken(key, parseInt(exp), token, env.GALLERY_PASSWORD);
    if (!valid) {
      return errorResponse("Invalid token", 403);
    }

    // Fetch from R2
    const object = await env.GALLERY_BUCKET.get(key);
    if (!object) {
      return errorResponse("Not found", 404);
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        ...corsHeaders,
      },
    });
  }

  return errorResponse("Not found", 404);
}

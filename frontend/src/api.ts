// ============================================
// API Client for Cloudflare Worker Backend
// ============================================

import type {
  GalleryData,
  UploadPrepareRequest,
  UploadPrepareResponse,
  UploadCommitRequest,
  UploadCommitResponse,
  UsageStats,
  ToggleFavoriteRequest,
  Uploader,
} from "./types";

// In production, this will be your Cloudflare Worker URL
// For local dev, you can use wrangler dev on port 8787
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8787";

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// Verify password (lightweight check)
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const res = await fetchApi<{ ok: boolean }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Get gallery data (albums, photos, notes)
export async function getGallery(password: string): Promise<GalleryData> {
  return fetchApi<GalleryData>("/gallery", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

// Get usage stats (for showing remaining space)
export async function getUsage(password: string): Promise<UsageStats> {
  return fetchApi<UsageStats>("/usage", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

// Prepare upload: get signed URLs
export async function prepareUpload(
  req: UploadPrepareRequest
): Promise<UploadPrepareResponse> {
  return fetchApi<UploadPrepareResponse>("/upload/prepare", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Commit upload: finalize metadata after files uploaded to R2
export async function commitUpload(
  req: UploadCommitRequest
): Promise<UploadCommitResponse> {
  return fetchApi<UploadCommitResponse>("/upload/commit", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Get signed read URL for a photo
export async function getSignedUrl(
  password: string,
  key: string
): Promise<string> {
  const res = await fetchApi<{ url: string }>("/photo/url", {
    method: "POST",
    body: JSON.stringify({ password, key }),
  });
  return res.url;
}

// Upload a file directly to the signed URL (PUT to R2)
export async function uploadToSignedUrl(
  url: string,
  file: Blob,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

// Toggle favorite status for a photo
export async function toggleFavorite(
  req: ToggleFavoriteRequest
): Promise<{ favoritedBy: Uploader[] }> {
  return fetchApi<{ favoritedBy: Uploader[] }>("/photo/favorite", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

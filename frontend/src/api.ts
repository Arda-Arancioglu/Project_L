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
  EditNoteRequest,
  DeletePhotoRequest,
  RestorePhotoRequest,
  EditDateRequest,
  NoteItem,
  NextDateInfo,
  Uploader,
  PhotoMeta,
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

// Edit photo note
export async function editNote(
  req: EditNoteRequest
): Promise<{ note: string; noteBy: Uploader }> {
  return fetchApi<{ note: string; noteBy: Uploader }>("/photo/edit", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Soft delete photo (move to recycle bin)
export async function deletePhoto(
  req: DeletePhotoRequest
): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>("/photo/delete", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Restore photo from recycle bin
export async function restorePhoto(
  req: RestorePhotoRequest
): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>("/photo/restore", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Permanently delete photo
export async function purgePhoto(
  password: string,
  photoId: string
): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>("/photo/purge", {
    method: "POST",
    body: JSON.stringify({ password, photoId }),
  });
}

// Get recycle bin photos
export async function getRecycleBin(
  password: string
): Promise<{ photos: PhotoMeta[] }> {
  return fetchApi<{ photos: PhotoMeta[] }>("/recycle", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

// Edit photo date
export async function editDate(
  req: EditDateRequest
): Promise<{ day: string }> {
  return fetchApi<{ day: string }>("/photo/edit-date", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// Notes / To-do API
export async function getNotes(
  password: string
): Promise<{ notes: NoteItem[] }> {
  return fetchApi<{ notes: NoteItem[] }>("/notes", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function addNote(
  password: string,
  text: string,
  user: Uploader,
  category: string = "todo"
): Promise<{ note: NoteItem }> {
  return fetchApi<{ note: NoteItem }>("/notes/add", {
    method: "POST",
    body: JSON.stringify({ password, text, user, category }),
  });
}

export async function toggleNote(
  password: string,
  noteId: string
): Promise<{ done: boolean }> {
  return fetchApi<{ done: boolean }>("/notes/toggle", {
    method: "POST",
    body: JSON.stringify({ password, noteId }),
  });
}

export async function deleteNote(
  password: string,
  noteId: string
): Promise<{ ok: boolean }> {
  return fetchApi<{ ok: boolean }>("/notes/delete", {
    method: "POST",
    body: JSON.stringify({ password, noteId }),
  });
}

// Next date API
export async function getNextDate(
  password: string
): Promise<{ nextDate: NextDateInfo | null }> {
  return fetchApi<{ nextDate: NextDateInfo | null }>("/next-date", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function setNextDate(
  password: string,
  date: string,
  title: string
): Promise<{ nextDate: NextDateInfo }> {
  return fetchApi<{ nextDate: NextDateInfo }>("/next-date/set", {
    method: "POST",
    body: JSON.stringify({ password, date, title }),
  });
}

export async function deleteNextDate(
  password: string
): Promise<{ ok: boolean; nextDate: null }> {
  return fetchApi<{ ok: boolean; nextDate: null }>("/next-date/delete", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

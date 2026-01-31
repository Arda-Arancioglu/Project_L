// ============================================
// Couples Gallery - Shared Types
// ============================================

export interface PhotoMeta {
  id: string;
  filename: string;
  note: string;
  uploadedAt: string; // ISO date
  day: string; // YYYY-MM-DD
  size: number; // bytes
  thumbnailKey: string;
  fullKey: string;
}

export interface DayAlbum {
  day: string; // YYYY-MM-DD
  photos: PhotoMeta[];
}

export interface GalleryData {
  albums: DayAlbum[];
  totalSize: number;
  totalPhotos: number;
}

export interface UploadPrepareRequest {
  password: string;
  files: { name: string; size: number; type: string }[];
}

export interface UploadPrepareResponse {
  ok: boolean;
  error?: string;
  uploads?: {
    id: string;
    uploadUrl: string;
    thumbnailUploadUrl: string;
  }[];
  reservationId?: string;
}

export interface UploadCommitRequest {
  password: string;
  reservationId: string;
  photos: {
    id: string;
    filename: string;
    note: string;
    day: string;
    size: number;
  }[];
}

export interface UploadCommitResponse {
  ok: boolean;
  error?: string;
}

export interface UsageStats {
  totalBytes: number;
  totalPhotos: number;
  maxBytes: number;
  uploadsToday: number;
  maxUploadsPerDay: number;
}

// ============================================
// Couples Gallery - Shared Types
// ============================================

export type Uploader = "arda" | "askim";
export type Album = "arda" | "askim" | "us";

export interface PhotoMeta {
  id: string;
  filename: string;
  note: string;
  noteBy?: Uploader; // who wrote the note
  key: string; // R2 key for full image
  thumbnailKey?: string; // R2 key for thumbnail
  uploadedAt: string; // ISO date
  day: string; // YYYY-MM-DD
  size: number; // bytes
  uploader?: Uploader;
  album?: Album;
  favoritedBy?: Uploader[]; // who favorited this photo
  deletedAt?: string; // ISO date - if set, photo is in recycle bin
}

export interface GalleryData {
  photos: PhotoMeta[];
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
  uploader: Uploader;
  album: Album;
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

export interface ToggleFavoriteRequest {
  password: string;
  photoId: string;
  user: Uploader;
}

export interface EditNoteRequest {
  password: string;
  photoId: string;
  note: string;
  user: Uploader;
}

export interface DeletePhotoRequest {
  password: string;
  photoId: string;
}

export interface RestorePhotoRequest {
  password: string;
  photoId: string;
}

export interface UsageStats {
  totalBytes: number;
  totalPhotos: number;
  maxBytes: number;
  uploadsToday: number;
  maxUploadsPerDay: number;
}

// Notes / To-do list
export type NoteCategory = "all" | "travel" | "todo" | "food";

export interface NoteItem {
  id: string;
  text: string;
  done: boolean;
  category: NoteCategory;
  createdAt: string;
  createdBy: Uploader;
}

// Next date countdown
export interface NextDateInfo {
  date: string; // ISO date
  title: string;
}

export interface EditDateRequest {
  password: string;
  photoId: string;
  day: string;
}

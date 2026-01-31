// ============================================
// Utility Functions
// ============================================

// Generate a simple unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Format bytes to human readable
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Format date for display
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Get today's date as YYYY-MM-DD
export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Create thumbnail from image file (client-side)
export async function createThumbnail(
  file: File,
  maxSize = 300
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not create thumbnail"));
        },
        "image/jpeg",
        0.7
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };

    img.src = url;
  });
}

// Session storage for password (not localStorage for extra safety)
const PASSWORD_KEY = "couples_gallery_pw";

export function savePassword(pw: string): void {
  sessionStorage.setItem(PASSWORD_KEY, pw);
}

export function getPassword(): string | null {
  return sessionStorage.getItem(PASSWORD_KEY);
}

export function clearPassword(): void {
  sessionStorage.removeItem(PASSWORD_KEY);
}

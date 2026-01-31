import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { prepareUpload, uploadToSignedUrl, commitUpload, getUsage } from "../api";
import { generateId, formatBytes, getTodayStr, createThumbnail } from "../utils";
import type { UsageStats, Uploader, Album } from "../types";
import "./Upload.css";

interface Props {
  password: string;
  currentUser: Uploader;
}

interface PendingFile {
  id: string;
  file: File;
  note: string;
  day: string;
  preview: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
}

export default function Upload({ password, currentUser }: Props) {
  const navigate = useNavigate();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [album, setAlbum] = useState<Album>("us");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (password) {
      getUsage(password).then(setUsage).catch(console.error);
    }
  }, [password]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const newFiles: PendingFile[] = [];
    const today = getTodayStr();

    for (const file of Array.from(selected)) {
      if (!file.type.startsWith("image/")) continue;

      newFiles.push({
        id: generateId(),
        file,
        note: "",
        day: today,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: "pending",
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateFile = (id: string, updates: Partial<PendingFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);
  const remainingSpace = usage ? usage.maxBytes - usage.totalBytes : 0;
  const canUpload =
    files.length > 0 &&
    totalSize < remainingSpace &&
    files.length <= 100 &&
    totalSize <= 500 * 1024 * 1024;

  const handleUpload = async () => {
    if (!password || !canUpload) return;

    setUploading(true);
    setError("");

    try {
      // 1. Prepare: get signed URLs
      const prepareRes = await prepareUpload({
        password,
        files: files.map((f) => ({
          name: f.file.name,
          size: f.file.size,
          type: f.file.type,
        })),
      });

      if (!prepareRes.ok || !prepareRes.uploads || !prepareRes.reservationId) {
        throw new Error(prepareRes.error || "Yükleme hazırlığı başarısız");
      }

      // 2. Upload each file (full + thumbnail)
      for (let i = 0; i < files.length; i++) {
        const pf = files[i];
        const upload = prepareRes.uploads[i];

        updateFile(pf.id, { status: "uploading" });

        try {
          // Upload full image
          await uploadToSignedUrl(
            upload.uploadUrl,
            pf.file,
            pf.file.type,
            (pct) => updateFile(pf.id, { progress: pct * 0.8 })
          );

          // Create and upload thumbnail
          const thumbnail = await createThumbnail(pf.file);
          await uploadToSignedUrl(
            upload.thumbnailUploadUrl,
            thumbnail,
            "image/jpeg",
            (pct) => updateFile(pf.id, { progress: 80 + pct * 0.2 })
          );

          updateFile(pf.id, { status: "done", progress: 100 });
        } catch (err) {
          updateFile(pf.id, { status: "error" });
          console.error("Yükleme hatası:", pf.file.name, err);
        }
      }

      // 3. Commit metadata - find which ones succeeded
      const doneFiles = files.filter((f) => {
        const idx = files.findIndex((ff) => ff.id === f.id);
        return prepareRes.uploads![idx] && f.status !== "error";
      });

      if (doneFiles.length > 0) {
        await commitUpload({
          password,
          reservationId: prepareRes.reservationId,
          uploader: currentUser,
          album,
          photos: doneFiles.map((f) => ({
            id: prepareRes.uploads![files.findIndex((ff) => ff.id === f.id)].id,
            filename: f.file.name,
            note: f.note,
            day: f.day,
            size: f.file.size,
          })),
        });
      }

      // Clean up and go back
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      navigate("/gallery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme başarısız");
    }

    setUploading(false);
  };

  const userLabel = currentUser === "arda" ? "🩵 Arda" : "💗 Aşkım";

  return (
    <div className={`upload-page ${currentUser}`}>
      <header className="upload-header">
        <button className="back-btn" onClick={() => navigate("/")} disabled={uploading}>
          ← Geri
        </button>
        <h1>Fotoğraf Yükle</h1>
        <span className="upload-user">{userLabel}</span>
      </header>

      {usage && (
        <div className="usage-bar">
          <div className="usage-info">
            <span>Depolama: {formatBytes(usage.totalBytes)} / {formatBytes(usage.maxBytes)}</span>
            <span>
              Bugün: {usage.uploadsToday} / {usage.maxUploadsPerDay}
            </span>
          </div>
          <div className="usage-progress">
            <div
              className="usage-fill"
              style={{ width: `${(usage.totalBytes / usage.maxBytes) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Album Selection */}
      <div className="selection-group">
        <label className="selection-label">Albüm</label>
        <div className="album-toggle">
          <button
            className={`toggle-btn ${album === "us" ? "active" : ""}`}
            onClick={() => setAlbum("us")}
            disabled={uploading}
          >
            Biz
          </button>
          <button
            className={`toggle-btn ${album === "arda" ? "active" : ""}`}
            onClick={() => setAlbum("arda")}
            disabled={uploading}
          >
            Arda
          </button>
          <button
            className={`toggle-btn ${album === "askim" ? "active" : ""}`}
            onClick={() => setAlbum("askim")}
            disabled={uploading}
          >
            Aşkım
          </button>
        </div>
      </div>

      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
          id="file-input"
        />
        <label htmlFor="file-input" className="file-label">
          <div className="drop-zone">
            <span className="drop-icon">📷</span>
            <span>Click to select photos</span>
            <span className="drop-hint">or drag and drop</span>
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <>
          <div className="pending-summary">
            <span>{files.length} fotoğraf seçildi</span>
            <span>{formatBytes(totalSize)}</span>
            {totalSize > remainingSpace && (
              <span className="warning">⚠️ Alan yetersiz!</span>
            )}
          </div>

          <div className="pending-files">
            {files.map((pf) => (
              <div key={pf.id} className={`pending-file ${pf.status}`}>
                <img src={pf.preview} alt={pf.file.name} />

                <div className="file-info">
                  <input
                    type="text"
                    placeholder="Not ekle..."
                    value={pf.note}
                    onChange={(e) => updateFile(pf.id, { note: e.target.value })}
                    disabled={uploading}
                  />
                  <span className="file-size">{formatBytes(pf.file.size)}</span>
                </div>

                {pf.status === "uploading" && (
                  <div className="upload-progress">
                    <div
                      className="progress-fill"
                      style={{ width: `${pf.progress}%` }}
                    />
                  </div>
                )}

                {pf.status === "done" && <div className="status-icon">✅</div>}
                {pf.status === "error" && <div className="status-icon">❌</div>}

                {!uploading && (
                  <button
                    className="remove-btn"
                    onClick={() => removeFile(pf.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && <p className="upload-error">{error}</p>}

          <div className="upload-actions">
            <button
              className="upload-submit"
              onClick={handleUpload}
              disabled={!canUpload || uploading}
            >
              {uploading ? "Yükleniyor..." : `${files.length} Fotoğraf Yükle 💕`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

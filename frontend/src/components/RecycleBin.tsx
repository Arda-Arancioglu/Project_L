import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRecycleBin, getSignedUrl, restorePhoto, purgePhoto } from "../api";
import type { PhotoMeta, Uploader } from "../types";
import "./RecycleBin.css";

interface Props {
  password: string;
  currentUser: Uploader;
}

export function RecycleBin({ password, currentUser }: Props) {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMeta | null>(null);

  useEffect(() => {
    loadRecycleBin();
  }, [password]);

  async function loadRecycleBin() {
    try {
      setLoading(true);
      const data = await getRecycleBin(password);
      setPhotos(data.photos);

      // Load thumbnails
      const urls: Record<string, string> = {};
      await Promise.all(
        data.photos.map(async (photo) => {
          const thumbKey = photo.thumbnailKey || photo.key;
          urls[photo.id] = await getSignedUrl(password, thumbKey);
        })
      );
      setImageUrls(urls);
    } catch (err) {
      console.error("Failed to load recycle bin:", err);
    } finally {
      setLoading(false);
    }
  }

  function getDaysRemaining(deletedAt: string): number {
    const deleted = new Date(deletedAt).getTime();
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const remaining = thirtyDays - (now - deleted);
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  }

  async function handleRestore(photo: PhotoMeta) {
    try {
      await restorePhoto({ password, photoId: photo.id });
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setSelectedPhoto(null);
    } catch (err) {
      console.error("Failed to restore:", err);
    }
  }

  async function handlePermanentDelete(photo: PhotoMeta) {
    if (!confirm("Bu fotoğrafı kalıcı olarak silmek istediğine emin misin? Bu işlem geri alınamaz.")) {
      return;
    }
    try {
      await purgePhoto(password, photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setSelectedPhoto(null);
    } catch (err) {
      console.error("Failed to delete permanently:", err);
    }
  }

  async function openFullPhoto(photo: PhotoMeta) {
    const url = await getSignedUrl(password, photo.key);
    setImageUrls((prev) => ({ ...prev, [`full_${photo.id}`]: url }));
    setSelectedPhoto(photo);
  }

  const userLabel = currentUser === "arda" ? "🩵 Arda" : "💗 Aşkım";

  if (loading) {
    return (
      <div className="recycle-loading">
        <div className="spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className={`recycle-bin ${currentUser}`}>
      <header className="recycle-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Geri
        </button>
        <h1>🗑️ Çöp Kutusu</h1>
        <span className="recycle-user">{userLabel}</span>
      </header>

      <p className="recycle-info">
        Silinen fotoğraflar 30 gün sonra kalıcı olarak silinir.
      </p>

      {photos.length === 0 ? (
        <div className="recycle-empty">
          <p>Çöp kutusu boş 🎉</p>
        </div>
      ) : (
        <div className="recycle-grid">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="recycle-item"
              onClick={() => openFullPhoto(photo)}
            >
              <img src={imageUrls[photo.id]} alt={photo.filename} loading="lazy" />
              <div className="days-remaining">
                {getDaysRemaining(photo.deletedAt!)} gün
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="photo-modal" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedPhoto(null)}>
              ✕
            </button>
            <img
              src={imageUrls[`full_${selectedPhoto.id}`] || imageUrls[selectedPhoto.id]}
              alt={selectedPhoto.filename}
            />
            <div className="modal-info">
              <p className="deleted-date">
                Silinme: {new Date(selectedPhoto.deletedAt!).toLocaleDateString("tr-TR")}
              </p>
              <p className="remaining-time">
                {getDaysRemaining(selectedPhoto.deletedAt!)} gün içinde kalıcı silinecek
              </p>
              <div className="modal-actions">
                <button
                  className="restore-btn"
                  onClick={() => handleRestore(selectedPhoto)}
                >
                  ↩️ Geri Yükle
                </button>
                <button
                  className="purge-btn"
                  onClick={() => handlePermanentDelete(selectedPhoto)}
                >
                  🗑️ Kalıcı Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

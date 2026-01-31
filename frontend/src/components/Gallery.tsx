import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getGallery, getSignedUrl, toggleFavorite } from "../api";
import { formatBytes } from "../utils";
import type { GalleryData, PhotoMeta, Album, Uploader } from "../types";
import "./Gallery.css";

type AlbumFilter = Album | "all";

interface Props {
  password: string;
  currentUser: Uploader;
}

export default function Gallery({ password, currentUser }: Props) {
  const navigate = useNavigate();
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMeta | null>(null);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [albumFilter, setAlbumFilter] = useState<AlbumFilter>("all");

  const otherUser: Uploader = currentUser === "arda" ? "askim" : "arda";

  useEffect(() => {
    loadGallery();
  }, [password]);

  const loadGallery = async () => {
    if (!password) return;

    setLoading(true);
    try {
      const data = await getGallery(password);
      setGallery(data);

      // Load thumbnail URLs for all photos
      const urls: Record<string, string> = {};
      for (const photo of data.photos) {
        try {
          const thumbKey = photo.thumbnailKey || photo.key;
          urls[photo.id] = await getSignedUrl(password, thumbKey);
        } catch {
          // Skip failed thumbnails
        }
      }
      setThumbnailUrls(urls);
    } catch (err) {
      setError("Galeri yüklenemedi");
      console.error(err);
    }
    setLoading(false);
  };

  const openPhoto = async (photo: PhotoMeta) => {
    setSelectedPhoto(photo);
    setFullImageUrl(null);

    if (!password) return;

    try {
      const url = await getSignedUrl(password, photo.key);
      setFullImageUrl(url);
    } catch {
      setError("Fotoğraf yüklenemedi");
    }
  };

  const closePhoto = () => {
    setSelectedPhoto(null);
    setFullImageUrl(null);
  };

  const handleToggleFavorite = async (photo: PhotoMeta, user: Uploader) => {
    try {
      const result = await toggleFavorite({
        password,
        photoId: photo.id,
        user,
      });

      // Update local state
      if (gallery) {
        const updatedPhotos = gallery.photos.map((p) =>
          p.id === photo.id ? { ...p, favoritedBy: result.favoritedBy } : p
        );
        setGallery({ ...gallery, photos: updatedPhotos });
      }

      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto({ ...selectedPhoto, favoritedBy: result.favoritedBy });
      }
    } catch (err) {
      console.error("Favori değiştirilemedi:", err);
    }
  };

  const handleDownload = async (photo: PhotoMeta) => {
    try {
      const url = await getSignedUrl(password, photo.key);
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = photo.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("İndirme başarısız:", err);
    }
  };

  const getFilteredPhotos = (): PhotoMeta[] => {
    if (!gallery) return [];
    if (albumFilter === "all") return gallery.photos;
    return gallery.photos.filter((p) => p.album === albumFilter);
  };

  const getAlbumLabel = (album: AlbumFilter): string => {
    switch (album) {
      case "all": return "Tümü";
      case "arda": return "Arda";
      case "askim": return "Aşkım";
      case "us": return "Biz";
    }
  };

  const filteredPhotos = getFilteredPhotos();

  if (loading) {
    return (
      <div className="gallery-loading">
        <div className="spinner">💕</div>
        <p>Anılar yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gallery-error">
        <p>{error}</p>
        <button onClick={loadGallery}>Tekrar Dene</button>
      </div>
    );
  }

  return (
    <div className="gallery">
      <header className="gallery-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Geri
        </button>
        <h1>📸 Galeri</h1>
        <div className="header-stats">
          <span>{gallery?.photos.length || 0} fotoğraf</span>
          <span>{formatBytes(gallery?.totalSize || 0)}</span>
        </div>
      </header>

      {/* Album Filter Tabs */}
      <div className="album-tabs">
        {(["all", "us", "arda", "askim"] as AlbumFilter[]).map((album) => (
          <button
            key={album}
            className={`album-tab ${albumFilter === album ? "active" : ""}`}
            onClick={() => setAlbumFilter(album)}
          >
            {getAlbumLabel(album)}
          </button>
        ))}
      </div>

      {filteredPhotos.length === 0 ? (
        <div className="empty-gallery">
          <div className="empty-icon">📷</div>
          <h2>Fotoğraf yok</h2>
          <p>Bu albümde henüz fotoğraf yok</p>
          <button onClick={() => navigate("/upload")}>Fotoğraf Yükle 💝</button>
        </div>
      ) : (
        <div className="photo-grid">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              className="photo-card"
              onClick={() => openPhoto(photo)}
            >
              {thumbnailUrls[photo.id] ? (
                <img
                  src={thumbnailUrls[photo.id]}
                  alt={photo.note || photo.filename}
                  loading="lazy"
                />
              ) : (
                <div className="photo-placeholder">📷</div>
              )}
              <div className="photo-overlay">
                {photo.favoritedBy && photo.favoritedBy.length > 0 && (
                  <div className="photo-hearts">
                    {photo.favoritedBy.includes("arda") && <span>🩵</span>}
                    {photo.favoritedBy.includes("askim") && <span>💗</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="lightbox" onClick={closePhoto}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closePhoto}>
              ✕
            </button>
            {fullImageUrl ? (
              <img src={fullImageUrl} alt={selectedPhoto.note} />
            ) : (
              <div className="loading-full">Yükleniyor...</div>
            )}
            
            <div className="lightbox-info">
              {selectedPhoto.note && (
                <p className="lightbox-note">{selectedPhoto.note}</p>
              )}
              
              <div className="lightbox-meta">
                <span className="uploader-badge">
                  {selectedPhoto.uploader === "arda" ? "🩵 Arda yükledi" : "💗 Aşkım yükledi"}
                </span>
                <span>{formatBytes(selectedPhoto.size)}</span>
              </div>

              <div className="lightbox-actions">
                {/* Current user's favorite button - prominent */}
                <button
                  className={`heart-btn main-heart ${selectedPhoto.favoritedBy?.includes(currentUser) ? "active" : ""} ${currentUser}`}
                  onClick={() => handleToggleFavorite(selectedPhoto, currentUser)}
                >
                  {currentUser === "arda" ? "🩵" : "💗"} {selectedPhoto.favoritedBy?.includes(currentUser) ? "Beğendin" : "Beğen"}
                </button>
                
                {/* Show if partner liked it */}
                {selectedPhoto.favoritedBy?.includes(otherUser) && (
                  <span className="partner-liked">
                    {otherUser === "arda" ? "🩵 Arda beğendi" : "💗 Aşkım beğendi"}
                  </span>
                )}
                
                <button
                  className="download-btn"
                  onClick={() => handleDownload(selectedPhoto)}
                >
                  ⬇️ İndir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

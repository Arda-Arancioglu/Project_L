import { useState, useEffect } from "react";
import { getGallery, getSignedUrl } from "../api";
import { getPassword, formatDate, formatBytes } from "../utils";
import type { GalleryData, PhotoMeta } from "../types";
import "./Gallery.css";

interface Props {
  onUploadClick: () => void;
}

export default function Gallery({ onUploadClick }: Props) {
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMeta | null>(null);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    loadGallery();
  }, []);

  const loadGallery = async () => {
    const pw = getPassword();
    if (!pw) return;

    setLoading(true);
    try {
      const data = await getGallery(pw);
      setGallery(data);

      // Load thumbnail URLs for all photos
      const urls: Record<string, string> = {};
      for (const album of data.albums) {
        for (const photo of album.photos) {
          try {
            urls[photo.id] = await getSignedUrl(pw, photo.thumbnailKey);
          } catch {
            // Skip failed thumbnails
          }
        }
      }
      setThumbnailUrls(urls);
    } catch (err) {
      setError("Failed to load gallery");
      console.error(err);
    }
    setLoading(false);
  };

  const openPhoto = async (photo: PhotoMeta) => {
    setSelectedPhoto(photo);
    setFullImageUrl(null);

    const pw = getPassword();
    if (!pw) return;

    try {
      const url = await getSignedUrl(pw, photo.fullKey);
      setFullImageUrl(url);
    } catch {
      setError("Failed to load photo");
    }
  };

  const closePhoto = () => {
    setSelectedPhoto(null);
    setFullImageUrl(null);
  };

  if (loading) {
    return (
      <div className="gallery-loading">
        <div className="spinner">💕</div>
        <p>Loading our memories...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gallery-error">
        <p>{error}</p>
        <button onClick={loadGallery}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="gallery">
      <header className="gallery-header">
        <h1>💕 Our Gallery</h1>
        <div className="header-stats">
          <span>{gallery?.totalPhotos || 0} photos</span>
          <span>{formatBytes(gallery?.totalSize || 0)} used</span>
        </div>
        <button className="upload-btn" onClick={onUploadClick}>
          + Add Photos
        </button>
      </header>

      {!gallery?.albums.length ? (
        <div className="empty-gallery">
          <div className="empty-icon">📷</div>
          <h2>No photos yet!</h2>
          <p>Upload your first memories together</p>
          <button onClick={onUploadClick}>Upload Photos 💝</button>
        </div>
      ) : (
        <div className="albums">
          {gallery.albums.map((album) => (
            <section key={album.day} className="album">
              <h2 className="album-date">{formatDate(album.day)}</h2>
              <div className="photo-grid">
                {album.photos.map((photo) => (
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
                    {photo.note && (
                      <div className="photo-note-preview">{photo.note}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="lightbox" onClick={closePhoto}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closePhoto}>
              ×
            </button>
            {fullImageUrl ? (
              <img src={fullImageUrl} alt={selectedPhoto.note} />
            ) : (
              <div className="loading-full">Loading...</div>
            )}
            {selectedPhoto.note && (
              <div className="lightbox-note">{selectedPhoto.note}</div>
            )}
            <div className="lightbox-meta">
              <span>{formatDate(selectedPhoto.day)}</span>
              <span>{formatBytes(selectedPhoto.size)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Durable Object: Usage Limiter & Metadata Store
// ============================================
// Tracks usage, enforces rate limits, stores photo metadata
// Guarantees we never exceed free tier limits

type Uploader = "arda" | "askim";
type Album = "arda" | "askim" | "us";

interface PhotoMeta {
  id: string;
  filename: string;
  note: string;
  noteBy?: Uploader;
  uploadedAt: string;
  day: string;
  size: number;
  key: string;
  thumbnailKey: string;
  uploader?: Uploader;
  album?: Album;
  favoritedBy?: Uploader[];
  deletedAt?: string;
}

interface Reservation {
  id: string;
  fileCount: number;
  totalSize: number;
  createdAt: number;
  committed: boolean;
}

interface NoteItem {
  id: string;
  text: string;
  done: boolean;
  category: string;
  createdAt: string;
  createdBy: Uploader;
}

interface NextDateInfo {
  date: string;
  title: string;
}

interface StorageData {
  photos: PhotoMeta[];
  totalBytes: number;
  reservations: Record<string, Reservation>;
  dailyUploads: Record<string, number>; // date -> count
  notes: NoteItem[];
  nextDate: NextDateInfo | null;
}

export class UsageLimiter implements DurableObject {
  private state: DurableObjectState;
  private data: StorageData | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async loadData(): Promise<StorageData> {
    if (this.data) return this.data;

    this.data = (await this.state.storage.get<StorageData>("data")) || {
      photos: [],
      totalBytes: 0,
      reservations: {},
      dailyUploads: {},
      notes: [],
      nextDate: null,
    };

    return this.data;
  }

  private async saveData(): Promise<void> {
    if (this.data) {
      await this.state.storage.put("data", this.data);
    }
  }

  private getTodayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/gallery") {
      return this.handleGetGallery();
    }

    if (path === "/usage") {
      return this.handleGetUsage();
    }

    if (path === "/reserve" && request.method === "POST") {
      return this.handleReserve(request);
    }

    if (path === "/commit" && request.method === "POST") {
      return this.handleCommit(request);
    }

    if (path === "/favorite" && request.method === "POST") {
      return this.handleToggleFavorite(request);
    }

    if (path === "/edit-note" && request.method === "POST") {
      return this.handleEditNote(request);
    }

    if (path === "/delete" && request.method === "POST") {
      return this.handleSoftDelete(request);
    }

    if (path === "/restore" && request.method === "POST") {
      return this.handleRestore(request);
    }

    if (path === "/purge" && request.method === "POST") {
      return this.handlePermanentDelete(request);
    }

    if (path === "/recycle") {
      return this.handleGetRecycleBin();
    }

    if (path === "/edit-date" && request.method === "POST") {
      return this.handleEditDate(request);
    }

    // Notes routes
    if (path === "/notes") {
      return this.handleGetNotes();
    }

    if (path === "/notes/add" && request.method === "POST") {
      return this.handleAddNote(request);
    }

    if (path === "/notes/toggle" && request.method === "POST") {
      return this.handleToggleNote(request);
    }

    if (path === "/notes/delete" && request.method === "POST") {
      return this.handleDeleteNote(request);
    }

    // Next date routes
    if (path === "/next-date") {
      return this.handleGetNextDate();
    }

    if (path === "/next-date/set" && request.method === "POST") {
      return this.handleSetNextDate(request);
    }

    if (path === "/next-date/delete" && request.method === "POST") {
      return this.handleDeleteNextDate();
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleGetGallery(): Promise<Response> {
    const data = await this.loadData();

    // Auto-purge photos deleted more than 30 days ago
    await this.autoPurgeOldDeleted();

    // Filter out deleted photos and sort by uploadedAt (newest first)
    const photos = data.photos
      .filter((p) => !p.deletedAt)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return Response.json({
      photos,
      totalSize: data.totalBytes,
      totalPhotos: photos.length,
    });
  }

  private async autoPurgeOldDeleted(): Promise<void> {
    const data = await this.loadData();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let changed = false;

    data.photos = data.photos.filter((p) => {
      if (p.deletedAt) {
        const deletedTime = new Date(p.deletedAt).getTime();
        if (deletedTime < thirtyDaysAgo) {
          // Photo should be purged - subtract from total
          data.totalBytes -= p.size;
          changed = true;
          return false;
        }
      }
      return true;
    });

    if (changed) {
      await this.saveData();
    }
  }

  private async handleGetUsage(): Promise<Response> {
    const data = await this.loadData();
    const today = this.getTodayKey();

    return Response.json({
      totalBytes: data.totalBytes,
      totalPhotos: data.photos.length,
      uploadsToday: data.dailyUploads[today] || 0,
    });
  }

  private async handleReserve(request: Request): Promise<Response> {
    const body = await request.json<{
      fileCount: number;
      totalSize: number;
      maxTotalBytes: number;
      maxUploadsPerDay: number;
    }>();

    const data = await this.loadData();
    const today = this.getTodayKey();

    // Check daily upload limit
    const todayUploads = data.dailyUploads[today] || 0;
    if (todayUploads >= body.maxUploadsPerDay) {
      return Response.json({
        ok: false,
        error: `Daily upload limit reached (${body.maxUploadsPerDay} uploads/day)`,
      });
    }

    // Calculate reserved space from pending reservations
    const pendingReserved = Object.values(data.reservations)
      .filter((r) => !r.committed && Date.now() - r.createdAt < 3600000) // 1 hour timeout
      .reduce((sum, r) => sum + r.totalSize, 0);

    // Check storage limit
    const projectedTotal = data.totalBytes + pendingReserved + body.totalSize;
    if (projectedTotal > body.maxTotalBytes) {
      const remaining = body.maxTotalBytes - data.totalBytes - pendingReserved;
      return Response.json({
        ok: false,
        error: `Not enough storage. ${Math.max(0, Math.floor(remaining / 1024 / 1024))} MB remaining.`,
      });
    }

    // Create reservation
    const reservationId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    data.reservations[reservationId] = {
      id: reservationId,
      fileCount: body.fileCount,
      totalSize: body.totalSize,
      createdAt: Date.now(),
      committed: false,
    };

    // Increment daily counter
    data.dailyUploads[today] = todayUploads + 1;

    // Clean up old reservations (more than 2 hours old)
    const cutoff = Date.now() - 7200000;
    for (const [id, res] of Object.entries(data.reservations)) {
      if (res.createdAt < cutoff) {
        delete data.reservations[id];
      }
    }

    // Clean up old daily counters (more than 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoKey = weekAgo.toISOString().slice(0, 10);
    for (const dateKey of Object.keys(data.dailyUploads)) {
      if (dateKey < weekAgoKey) {
        delete data.dailyUploads[dateKey];
      }
    }

    await this.saveData();

    return Response.json({
      ok: true,
      reservationId,
    });
  }

  private async handleCommit(request: Request): Promise<Response> {
    const body = await request.json<{
      reservationId: string;
      uploader: Uploader;
      album: Album;
      photos: Omit<PhotoMeta, "uploader" | "album" | "favoritedBy">[];
    }>();

    const data = await this.loadData();

    // Validate reservation
    const reservation = data.reservations[body.reservationId];
    if (!reservation) {
      return Response.json({
        ok: false,
        error: "Invalid or expired reservation",
      });
    }

    if (reservation.committed) {
      return Response.json({
        ok: false,
        error: "Reservation already committed",
      });
    }

    // Add photos to storage with uploader and album
    const photosWithMeta: PhotoMeta[] = body.photos.map((p) => ({
      ...p,
      uploader: body.uploader,
      album: body.album,
      favoritedBy: [],
    }));
    
    data.photos.push(...photosWithMeta);

    // Update total size
    const addedSize = body.photos.reduce((sum, p) => sum + p.size, 0);
    data.totalBytes += addedSize;

    // Mark reservation as committed
    reservation.committed = true;

    await this.saveData();

    return Response.json({ ok: true });
  }

  private async handleToggleFavorite(request: Request): Promise<Response> {
    const body = await request.json<{
      photoId: string;
      user: Uploader;
    }>();

    const data = await this.loadData();

    const photo = data.photos.find((p) => p.id === body.photoId);
    if (!photo) {
      return Response.json({
        ok: false,
        error: "Photo not found",
      });
    }

    // Initialize favoritedBy if not exists
    if (!photo.favoritedBy) {
      photo.favoritedBy = [];
    }

    // Toggle favorite
    const index = photo.favoritedBy.indexOf(body.user);
    if (index >= 0) {
      photo.favoritedBy.splice(index, 1);
    } else {
      photo.favoritedBy.push(body.user);
    }

    await this.saveData();

    return Response.json({
      ok: true,
      favoritedBy: photo.favoritedBy,
    });
  }

  private async handleEditNote(request: Request): Promise<Response> {
    const body = await request.json<{
      photoId: string;
      note: string;
      user: Uploader;
    }>();

    const data = await this.loadData();

    const photo = data.photos.find((p) => p.id === body.photoId);
    if (!photo) {
      return Response.json({
        ok: false,
        error: "Photo not found",
      });
    }

    photo.note = body.note;
    photo.noteBy = body.user;

    await this.saveData();

    return Response.json({
      ok: true,
      note: photo.note,
      noteBy: photo.noteBy,
    });
  }

  private async handleSoftDelete(request: Request): Promise<Response> {
    const body = await request.json<{ photoId: string }>();

    const data = await this.loadData();

    const photo = data.photos.find((p) => p.id === body.photoId);
    if (!photo) {
      return Response.json({
        ok: false,
        error: "Photo not found",
      });
    }

    photo.deletedAt = new Date().toISOString();

    await this.saveData();

    return Response.json({ ok: true });
  }

  private async handleRestore(request: Request): Promise<Response> {
    const body = await request.json<{ photoId: string }>();

    const data = await this.loadData();

    const photo = data.photos.find((p) => p.id === body.photoId);
    if (!photo) {
      return Response.json({
        ok: false,
        error: "Photo not found",
      });
    }

    delete photo.deletedAt;

    await this.saveData();

    return Response.json({ ok: true });
  }

  private async handlePermanentDelete(request: Request): Promise<Response> {
    const body = await request.json<{ photoId: string }>();

    const data = await this.loadData();

    const photoIndex = data.photos.findIndex((p) => p.id === body.photoId);
    if (photoIndex === -1) {
      return Response.json({
        ok: false,
        error: "Photo not found",
      });
    }

    const photo = data.photos[photoIndex];
    data.photos.splice(photoIndex, 1);
    data.totalBytes -= photo.size;

    await this.saveData();

    return Response.json({
      ok: true,
      key: photo.key,
      thumbnailKey: photo.thumbnailKey,
    });
  }

  private async handleGetRecycleBin(): Promise<Response> {
    const data = await this.loadData();

    // Get only deleted photos, sorted by deletedAt (newest first)
    const deletedPhotos = data.photos
      .filter((p) => p.deletedAt)
      .sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

    return Response.json({
      photos: deletedPhotos,
    });
  }

  private async handleEditDate(request: Request): Promise<Response> {
    const body = await request.json<{
      photoId: string;
      day: string;
    }>();

    const data = await this.loadData();

    const photo = data.photos.find((p) => p.id === body.photoId);
    if (!photo) {
      return Response.json({
        ok: false,
        error: "Photo not found",
      });
    }

    photo.day = body.day;
    // Also update uploadedAt to match the new day
    photo.uploadedAt = new Date(body.day).toISOString();

    await this.saveData();

    return Response.json({
      ok: true,
      day: photo.day,
    });
  }

  // Notes handlers
  private async handleGetNotes(): Promise<Response> {
    const data = await this.loadData();
    if (!data.notes) data.notes = [];

    return Response.json({
      notes: data.notes,
    });
  }

  private async handleAddNote(request: Request): Promise<Response> {
    const body = await request.json<{
      text: string;
      user: Uploader;
      category?: string;
    }>();

    const data = await this.loadData();
    if (!data.notes) data.notes = [];

    const newNote: NoteItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: body.text,
      done: false,
      category: body.category || "todo",
      createdAt: new Date().toISOString(),
      createdBy: body.user,
    };

    data.notes.unshift(newNote);
    await this.saveData();

    return Response.json({
      ok: true,
      note: newNote,
    });
  }

  private async handleToggleNote(request: Request): Promise<Response> {
    const body = await request.json<{ noteId: string }>();

    const data = await this.loadData();
    if (!data.notes) data.notes = [];

    const note = data.notes.find((n) => n.id === body.noteId);
    if (!note) {
      return Response.json({
        ok: false,
        error: "Note not found",
      });
    }

    note.done = !note.done;
    await this.saveData();

    return Response.json({
      ok: true,
      done: note.done,
    });
  }

  private async handleDeleteNote(request: Request): Promise<Response> {
    const body = await request.json<{ noteId: string }>();

    const data = await this.loadData();
    if (!data.notes) data.notes = [];

    const index = data.notes.findIndex((n) => n.id === body.noteId);
    if (index === -1) {
      return Response.json({
        ok: false,
        error: "Note not found",
      });
    }

    data.notes.splice(index, 1);
    await this.saveData();

    return Response.json({ ok: true });
  }

  // Next date handlers
  private async handleGetNextDate(): Promise<Response> {
    const data = await this.loadData();

    return Response.json({
      nextDate: data.nextDate || null,
    });
  }

  private async handleSetNextDate(request: Request): Promise<Response> {
    const body = await request.json<{
      date: string;
      title: string;
    }>();

    const data = await this.loadData();

    data.nextDate = {
      date: body.date,
      title: body.title,
    };

    await this.saveData();

    return Response.json({
      ok: true,
      nextDate: data.nextDate,
    });
  }

  private async handleDeleteNextDate(): Promise<Response> {
    const data = await this.loadData();

    data.nextDate = null;

    await this.saveData();

    return Response.json({
      ok: true,
      nextDate: null,
    });
  }
}

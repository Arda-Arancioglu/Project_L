// ============================================
// Durable Object: Usage Limiter & Metadata Store
// ============================================
// Tracks usage, enforces rate limits, stores photo metadata
// Guarantees we never exceed free tier limits

interface PhotoMeta {
  id: string;
  filename: string;
  note: string;
  uploadedAt: string;
  day: string;
  size: number;
  thumbnailKey: string;
  fullKey: string;
}

interface Reservation {
  id: string;
  fileCount: number;
  totalSize: number;
  createdAt: number;
  committed: boolean;
}

interface StorageData {
  photos: PhotoMeta[];
  totalBytes: number;
  reservations: Record<string, Reservation>;
  dailyUploads: Record<string, number>; // date -> count
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

    return new Response("Not found", { status: 404 });
  }

  private async handleGetGallery(): Promise<Response> {
    const data = await this.loadData();

    // Group photos by day
    const albumMap = new Map<string, PhotoMeta[]>();
    for (const photo of data.photos) {
      const existing = albumMap.get(photo.day) || [];
      existing.push(photo);
      albumMap.set(photo.day, existing);
    }

    // Sort albums by day (newest first)
    const albums = Array.from(albumMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, photos]) => ({
        day,
        photos: photos.sort(
          (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        ),
      }));

    return Response.json({
      albums,
      totalSize: data.totalBytes,
      totalPhotos: data.photos.length,
    });
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
      photos: PhotoMeta[];
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

    // Add photos to storage
    data.photos.push(...body.photos);

    // Update total size
    const addedSize = body.photos.reduce((sum, p) => sum + p.size, 0);
    data.totalBytes += addedSize;

    // Mark reservation as committed
    reservation.committed = true;

    await this.saveData();

    return Response.json({ ok: true });
  }
}

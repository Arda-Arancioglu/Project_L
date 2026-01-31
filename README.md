# 💕 Couples Gallery

A private, password-protected photo gallery for couples. Built with React + Cloudflare Workers + R2.

**100% free tier guarantee** - hard limits prevent any surprise billing.

---

## 📋 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE PAGES                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    React Frontend                            │   │
│  │  • Password Gate (session-based)                             │   │
│  │  • Gallery View (albums by day, lazy loading)                │   │
│  │  • Upload Page (photos + notes, client-side thumbnails)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTPS API Calls
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CLOUDFLARE WORKER                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  • Password verification (constant-time comparison)          │   │
│  │  • Upload preparation (signed URLs, validation)              │   │
│  │  • Hard limit enforcement BEFORE storage                     │   │
│  │  • Signed read URLs with expiry + HMAC                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│              ┌───────────────┴───────────────┐                      │
│              ▼                               ▼                      │
│  ┌─────────────────────┐       ┌─────────────────────────┐         │
│  │   Durable Object    │       │      Cloudflare R2      │         │
│  │  (UsageLimiter)     │       │   (Object Storage)      │         │
│  │                     │       │                         │         │
│  │  • Usage tracking   │       │  • photos/{id}-full     │         │
│  │  • Rate limiting    │       │  • photos/{id}-thumb    │         │
│  │  • Photo metadata   │       │                         │         │
│  │  • Reservations     │       │  (Private, no public    │         │
│  └─────────────────────┘       │   access - signed URLs  │         │
│                                │   only)                 │         │
│                                └─────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Security & Cost Safety

| Protection | Implementation |
|------------|----------------|
| **Password Gate** | Single shared password, constant-time comparison |
| **Hard Storage Cap** | 9.5 GB limit (R2 free tier = 10 GB) |
| **Rate Limiting** | 50 uploads/day max |
| **Upload Size Limit** | 500 MB per batch, 100 files max |
| **Signed URLs** | HMAC-signed with 1-hour expiry |
| **No Public Access** | R2 bucket is private, all reads via worker |
| **Reservation System** | Space reserved before upload, prevents overflow |

**Result:** Even if password leaks, costs stay at $0.

---

## 🚀 Setup Instructions

### Step 1: Create Cloudflare Account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up (free, no credit card required)

### Step 2: Create R2 Bucket

1. In Cloudflare dashboard → **R2 Object Storage**
2. Click **Create bucket**
3. Name it: `couples-gallery`
4. Leave all settings as default (private)
5. Click **Create bucket**

### Step 3: Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### Step 4: Deploy Worker

```bash
cd worker
npm install

# Set your secret password (pick a long, random string!)
wrangler secret put GALLERY_PASSWORD
# Enter your password when prompted

# Deploy
npm run deploy
```

Note the worker URL: `https://couples-gallery-worker.<your-subdomain>.workers.dev`

### Step 5: Configure Frontend

1. Create `.env` file in `frontend/`:

```env
VITE_API_URL=https://couples-gallery-worker.<your-subdomain>.workers.dev
```

### Step 6: Deploy Frontend to Cloudflare Pages

```bash
cd frontend
npm install
npm run build

# Option A: Via Wrangler
npx wrangler pages deploy dist --project-name=couples-gallery

# Option B: Via Dashboard
# 1. Go to Cloudflare Dashboard → Pages
# 2. Create project → Connect to Git (or direct upload)
# 3. Build settings: npm run build, output: dist
```

---

## 🔧 Configuration

### Worker Limits (wrangler.toml)

```toml
[vars]
MAX_TOTAL_BYTES = "10200547328"       # ~9.5 GB
MAX_FILES_PER_UPLOAD = "100"
MAX_UPLOAD_SIZE_BYTES = "524288000"   # 500 MB
MAX_UPLOADS_PER_DAY = "50"
SIGNED_URL_EXPIRY_SECONDS = "3600"    # 1 hour
```

### Changing the Password

```bash
cd worker
wrangler secret put GALLERY_PASSWORD
# Enter new password
```

---

## 📦 Metadata Schema

Photos are stored in the Durable Object with this structure:

```typescript
interface PhotoMeta {
  id: string;           // Unique ID (timestamp + random)
  filename: string;     // Original filename
  note: string;         // User's note for this photo
  uploadedAt: string;   // ISO timestamp
  day: string;          // YYYY-MM-DD (for album grouping)
  size: number;         // File size in bytes
  thumbnailKey: string; // R2 key: photos/{id}-thumb
  fullKey: string;      // R2 key: photos/{id}-full
}
```

---

## 💻 Local Development

### Run Worker Locally

```bash
cd worker
npm install
npm run dev
# Runs on http://localhost:8787
```

For local dev, you'll need to set the password:
```bash
# Create .dev.vars file
echo 'GALLERY_PASSWORD="your-dev-password"' > .dev.vars
```

### Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 📊 Free Tier Limits (Cloudflare)

| Service | Free Tier | Our Usage |
|---------|-----------|-----------|
| **R2 Storage** | 10 GB | ≤9.5 GB (hard capped) |
| **R2 Operations** | 1M Class A, 10M Class B/month | Minimal for 2 users |
| **Workers** | 100K requests/day | Minimal for 2 users |
| **Workers KV/DO** | 1GB storage | Minimal (metadata only) |
| **Pages** | Unlimited sites, 500 builds/month | 1 site |

**Guaranteed free forever** for personal couple use.

---

## 🔐 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/verify` | POST | - | Verify password |
| `/gallery` | POST | Password | Get all albums/photos |
| `/usage` | POST | Password | Get storage stats |
| `/upload/prepare` | POST | Password | Get signed upload URLs |
| `/upload/commit` | POST | Password | Finalize upload metadata |
| `/photo/url` | POST | Password | Get signed read URL |
| `/r2/upload/{key}` | PUT | Signed | Direct R2 upload |
| `/r2/read/{key}` | GET | Signed | Direct R2 read |

---

## 🎨 Features

- 🔒 **Password protected** - Single shared password for both of you
- 📅 **Day-based albums** - Photos grouped by date
- 📝 **Photo notes** - Add a memory/note to each photo
- 🖼️ **Thumbnails** - Fast loading with lazy load
- 📱 **Mobile friendly** - Responsive design
- 💾 **Secure storage** - Private R2 bucket, signed URLs only
- ⚡ **Serverless** - No running servers, pay nothing
- 🚫 **Hard limits** - Cannot exceed free tier, ever

---

## 📁 Project Structure

```
Her/
├── frontend/               # React (Vite) frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── PasswordGate.tsx   # Login screen
│   │   │   ├── Gallery.tsx        # Photo gallery
│   │   │   └── Upload.tsx         # Upload page
│   │   ├── api.ts                 # API client
│   │   ├── types.ts               # TypeScript types
│   │   ├── utils.ts               # Helpers
│   │   └── App.tsx                # Main app
│   └── package.json
│
├── worker/                 # Cloudflare Worker backend
│   ├── src/
│   │   ├── index.ts               # Main worker
│   │   └── usage-limiter.ts       # Durable Object
│   ├── wrangler.toml              # Config + limits
│   └── package.json
│
└── README.md
```

---

## ❤️ Made with love

Happy Valentine's Day! 💕

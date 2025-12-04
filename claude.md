# FUC.MOE URL Shortener

A serverless URL shortening service built on Cloudflare Workers with a static Astro frontend.

## What It Does

This is a URL shortening service that allows users to:
- Generate short URLs from long URLs with auto-generated hashes
- Create custom short URLs with user-defined slugs (e.g., `fuc.moe/go+https://google.com`)
- Redirect short URLs to their original destinations
- Preserve query parameters and URL fragments during shortening

The service uses a deterministic hashing algorithm that generates consistent short codes for the same URL, with collision handling built in.

## Technology Stack

### Backend (Cloudflare Worker)
- **Cloudflare Workers**: Serverless edge computing platform
- **TypeScript**: Strictly typed with ES2021 target
- **Cloudflare KV**: Key-value storage for URL mappings
- **Wrangler**: Cloudflare Workers CLI tool for deployment

### Frontend (Static Site)
- **Astro**: Static site generator (v4.11.5+)
- **TypeScript**: For type safety
- **jQuery**: (v3.7.1) For DOM manipulation and AJAX
- **CSS**: Component-scoped styles with Astro

### Testing
- **Vitest**: Testing framework
- **@cloudflare/vitest-pool-workers**: Cloudflare Workers testing integration
- **Custom Mock KV**: In-memory KV implementation for tests

### Build Tools
- **pnpm**: Package manager (v10.11.0)
- **npm-run-all**: For running parallel dev servers
- **Prettier**: Code formatting

## Project Structure

```
/shortener/
├── src/                          # Cloudflare Worker source
│   ├── index.ts                  # Main worker logic (API + redirects)
│   └── utils.ts                  # URL hashing utilities
├── astro/                        # Static site frontend
│   ├── src/
│   │   ├── components/           # Astro components
│   │   │   ├── PageHeader.astro  # Header with branding
│   │   │   ├── ShortenerForm.astro  # URL input form
│   │   │   └── ResultDisplay.astro  # Shows shortened URL
│   │   ├── layouts/
│   │   │   └── BaseLayout.astro  # Base HTML layout
│   │   ├── pages/
│   │   │   └── index.astro       # Main page
│   │   └── styles/
│   │       └── global.css        # Global styles
│   ├── public/                   # Static assets
│   └── astro.config.mjs          # Astro configuration
├── test/                         # Test files
│   ├── index.spec.ts             # Worker tests
│   └── utils/
│       └── mockKV.ts             # Mock KV storage
├── dist/                         # Built static files (deployed)
├── wrangler.jsonc                # Cloudflare Worker config
└── vitest.config.mts             # Test configuration
```

## How It Works

### Architecture

**Two-Tier Architecture:**
1. **Static Frontend**: Astro builds a static HTML/CSS/JS site served from Cloudflare's edge
2. **Serverless Backend**: Cloudflare Worker handles API requests and redirects

### URL Shortening Process

```
User enters URL → ShortenerForm.astro submits → Worker receives request
                                                 ↓
                                         Hash URL or use custom slug
                                                 ↓
                                         Check KV for collisions
                                                 ↓
                                         Store mapping in KV
                                                 ↓
                                         Return short hash
                                                 ↓
ResultDisplay.astro ← JSON response ← Frontend receives hash
```

### Redirect Process

```
User visits short URL → Worker checks KV → 301 redirect to original URL
                                     ↓
                            (404 if not found)
```

## Key Components

### URL Hashing Algorithm (`src/utils.ts`)

- Uses DJB2 hash algorithm (modified) to hash URLs
- Encodes hash into a 4-character string using base-59 encoding
- Character set: `abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ123456789`
  - Excludes ambiguous characters like 0, O, l, I
- Collision handling: Tries up to 10 offsets if hash collision occurs

### Worker Logic (`src/index.ts`)

Three main operations:

1. **handlePlusUrl**: Creates short URL with custom slug (format: `slug+https://example.com`)
2. **handleHashing**: Auto-generates hash for URL
3. **handleRedirect**: Redirects short URLs to original destinations

### Frontend Components

- **ShortenerForm.astro**:
  - Accepts URL and optional custom slug
  - Makes AJAX request to worker
  - Validates URL format
  - Prevents self-referential shortening

- **ResultDisplay.astro**:
  - Shows shortened URL with clickable link
  - Copy-to-clipboard functionality
  - Fade-in animation on success

## Development Setup

### Prerequisites

- Node.js (compatible with pnpm v10.11.0)
- pnpm package manager
- Cloudflare account (for deployment)

### Development Commands

```bash
pnpm dev           # Run both Astro and Worker dev servers in parallel
pnpm build         # Build Astro static site to dist/
pnpm deploy        # Build + deploy Worker to Cloudflare
pnpm test          # Run Vitest tests
```

### Development Environment

- **Astro dev server**: `localhost:4321`
- **Worker dev server**: `localhost:8787`
- Vite proxy routes API requests from Astro dev server to Worker
- Hot reload for both frontend and backend

## Configuration

### Cloudflare Worker (`wrangler.jsonc`)

- Main entry: `src/index.ts`
- Compatibility date: 2025-03-03
- KV namespace binding: `KV`
- Static assets: Served from `./dist` directory (Astro build output)
- Observability enabled

### Astro (`astro/astro.config.mjs`)

- Static site generation (SSG)
- Output directory: `../dist` (shared with Wrangler)
- Dev proxy: Routes API calls to Worker dev server at `localhost:8787`

## Key Design Decisions

1. **Deterministic Hashing**: Same URL always gets same hash (benefits caching)
2. **Collision Handling**: Tries 10 hash offsets before giving up
3. **Edge Computing**: Uses Cloudflare's global network for low latency
4. **Static + Serverless**: Minimal hosting costs, maximum performance
5. **KV Storage**: Globally distributed key-value store for URL mappings
6. **Custom Slugs**: Users can create memorable short URLs

## Security Features

- Prevents shortening URLs from the same domain (anti-loop protection)
- URL validation before shortening
- No database, no user accounts (stateless)

## Testing

- Mock KV implementation for unit tests
- Tests cover:
  - Auto-hashing
  - Custom slugs
  - Redirects
  - 404 handling
  - Collision handling
  - Query parameter preservation

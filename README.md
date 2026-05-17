# Birceflix

Film keşfet, filtrele (dil, ülke, kategori, platform, puan, yıl), Google ile giriş yap, izlediklerini DB'de sakla.
Tamamen static, Cloudflare Pages'e deploy edilebilir. API anahtarları Cloudflare Pages Functions üzerinden gizlenir.

**Stack**
- Vite + React 19 + TypeScript + Tailwind v4
- Cloudflare Pages + Pages Functions (`/functions/api/*`)
- Supabase (Auth + Postgres)
- TMDB (arama, keşif, watch providers, yorumlar) + OMDb (ödüller, IMDB rating)

## Özellikler
- 🔍 Arama + filtreler: orijinal dil, yapım ülkesi, kategori, yıl aralığı, min. puan, süre, sıralama
- 📺 Platform filtresi: Netflix / Disney+ / Prime / BluTV vs. (TMDB watch providers, ülke bazlı)
- 🎬 Detay: özet, kadro, oyuncular, yayında olduğu platformlar
- 🏆 Ödül özeti (OMDb) + detaylı liste için IMDB sayfası linki
- ★ Hem TMDB hem IMDB puanı
- ✅ "İzledim" işareti — Supabase'de saklanır, cihazlar arası senkron
- 📱 Mobil-öncelikli responsive UI, koyu tema

## İlk kurulum

### 1. API anahtarlarını al
- **TMDB** → https://www.themoviedb.org/settings/api → "Developer" başvurusu, anında onaylanır.
- **OMDb** → https://www.omdbapi.com/apikey.aspx → email ile ücretsiz key.

### 2. Supabase projesi kur
1. https://supabase.com → Yeni proje (ücretsiz).
2. **SQL Editor** → `supabase/schema.sql` içeriğini yapıştır ve çalıştır.
3. **Authentication → Providers → Google** → Aç. Google Cloud Console'da bir OAuth client ID oluştur (web app, redirect URI = `https://<project>.supabase.co/auth/v1/callback`).
4. **Authentication → URL Configuration → Site URL** → dev için `http://localhost:5173`, prod için Cloudflare domain'in.
5. **Project Settings → API** → `Project URL` ve `anon public` key'i kopyala.

### 3. Local env
```bash
cp .env.example .env.local
cp .dev.vars.example .dev.vars
```
Doldur:
- `.env.local` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEFAULT_WATCH_REGION` (default `TR`)
- `.dev.vars` → `TMDB_API_KEY`, `OMDB_API_KEY` (Pages Functions için, server-side)

### 4. Geliştirme

İki seçenek var:

**A) Vite tek başına** — daha hızlı, ama `/api/*` çalışmaz (TMDB/OMDb çağrıları başarısız olur):
```bash
npm run dev
```

**B) Wrangler ile birlikte** — gerçek Cloudflare ortamı + API çalışır:
```bash
npm run dev:cf
```

Önerilen: önce `npm run dev:cf` ile her şeyi test et.

## Cloudflare Pages'e deploy

### İlk deploy (CLI)
```bash
npm run deploy
```
Wrangler seni Cloudflare'a yönlendirir, projeyi oluşturur.

### Sonraki deploy'lar
- **Git üzerinden otomatik (önerilir):** Repo'yu GitHub'a push'la, Cloudflare dashboard'da `Pages → Create → Connect to Git`. Build ayarları:
  - Framework preset: `Vite`
  - Build command: `npm run build`
  - Build output: `dist`
  - Functions directory (otomatik algılanır): `functions`
- **Environment variables** (Pages → Project → Settings):
  - `TMDB_API_KEY` (encrypted)
  - `OMDB_API_KEY` (encrypted)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_DEFAULT_WATCH_REGION` (örn. `TR`)

> `VITE_` prefix'li env'ler build sırasında bundle'a gömülür (frontend), diğerleri runtime'da Functions'a verilir (server-side, gizli kalır).

## Mimari notları

- **TMDB → birincil kaynak.** Arama, filtreleme, detay, yorumlar, watch providers hep TMDB.
- **OMDb → enrichment.** Detay sayfası açılınca, TMDB'nin döndüğü `imdb_id` ile OMDb'ye sor → `Awards`, `imdbRating` çek. OMDb'nin günlük 1000 limiti var, bu yüzden sadece detay sayfasında çağrılır (liste/kart çekme sırasında değil).
- **IMDB rating filtresi gotcha.** TMDB discover sadece TMDB'nin puanıyla filtreliyor. Min. puan slider'ı `vote_average.gte` parametresine bağlı; IMDB rating kartta görüntüleme amaçlı (detay sayfasında).
- **Yorumlar TMDB'den.** IMDB yorumları için API yok. TMDB'nin kullanıcı yorumları (genelde İngilizce, sınırlı sayı) gösteriliyor.
- **RLS.** `watched_movies` tablosunda Row Level Security açık; her kullanıcı sadece kendi satırlarını görür/düzenler. Frontend `anon key` ile çağırır, RLS her şeyi koruyor.

## Yapı

```
movie-tracker/
├── functions/api/          # Cloudflare Pages Functions (API proxy)
│   ├── _shared.ts          #   ortak: env tipi, tmdb/omdb fetch yardımcıları
│   ├── discover.ts         #   GET /api/discover
│   ├── search.ts           #   GET /api/search?q=...
│   ├── movie/[id].ts       #   GET /api/movie/:id (detay + ödül + platformlar + yorumlar)
│   ├── providers.ts        #   GET /api/providers?region=TR
│   └── genres.ts           #   GET /api/genres
├── src/
│   ├── lib/
│   │   ├── api.ts          # frontend API client + tipler
│   │   ├── supabase.ts     # supabase client
│   │   ├── watched.ts      # izlediklerim CRUD
│   │   └── constants.ts    # diller, ülkeler, sort seçenekleri
│   ├── hooks/useAuth.ts
│   ├── components/
│   │   ├── AuthButton.tsx
│   │   ├── SearchBar.tsx
│   │   ├── FilterPanel.tsx
│   │   └── MovieCard.tsx
│   ├── pages/
│   │   ├── Discover.tsx
│   │   ├── Watched.tsx
│   │   └── MovieDetailPage.tsx
│   ├── Layout.tsx          # header + nav + watched state
│   ├── App.tsx             # router
│   ├── main.tsx
│   └── index.css           # Tailwind + tema
├── supabase/schema.sql
├── wrangler.toml
├── .env.example
└── .dev.vars.example
```

## Güvenlik

- **Secret'ler asla commit edilmez.** `.env.local`, `.dev.vars`, `.wrangler/` `.gitignore`'da; sadece `*.example` dosyaları repo'da.
- **API anahtarları server-side.** `TMDB_API_KEY` ve `OMDB_API_KEY` Pages Functions üzerinden çağrılır, frontend bundle'ında görünmez. Sızdırırsa TMDB/OMDb dashboard'undan rotate et.
- **Supabase anon key herkese açıktır** (zaten frontend'te). Güvenliği RLS sağlar — `watched_movies` tablosunda her kullanıcı yalnız kendi satırlarını görür/yazar (`supabase/schema.sql`).
- **OAuth redirect URL whitelist.** Supabase Auth → URL Configuration'da yalnızca kendi domain'lerin tanımlı olmalı.
- **Bağımlılıklar.** `npm audit` periyodik çalıştırılması önerilir.

Bir sızıntı şüphesi varsa: ilgili anahtarı sağlayıcıdan rotate et, ardından Cloudflare Pages env'lerini ve `.dev.vars`'ı güncelle.

## Sonraki adımlar
- Sonsuz scroll (şu an sayfa butonu)
- Kişisel puanlama + not (`my_rating`, `notes` zaten DB'de hazır)
- Dizi desteği (TMDB `/tv/*` endpoint'leri)
- Watchlist (istek üzerine eklenir)

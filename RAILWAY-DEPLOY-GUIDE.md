# Railway Deployment Guide

## Keuntungan Railway

✅ Support Docker native
✅ Built-in PostgreSQL & Redis
✅ No sleep (always on)
✅ Easy multi-service deployment
✅ Auto-deploy from GitHub
✅ Better than Render untuk project ini

❌ No free tier (~$5-10/month)
❌ Crawler tetap harus local/VPS

---

## Arsitektur

```
Frontend (Vercel) → API (Railway) → Redis (Railway) → Scoring (Railway)
                                                    ↓
                                              Crawler (Local/VPS)
```

---

## Step 1: Setup Railway Account

1. Login ke [railway.app](https://railway.app)
2. Sign up dengan GitHub
3. Verify email
4. Add payment method (required, tapi hanya bayar usage)

---

## Step 2: Create New Project

1. Dashboard → "New Project"
2. Pilih "Deploy from GitHub repo"
3. Connect repository kamu
4. Railway akan auto-detect services

---

## Step 3: Add Services

### A. Add PostgreSQL

1. Project → "New" → "Database" → "PostgreSQL"
2. Railway akan auto-provision
3. Copy `DATABASE_URL` (auto-generated)

### B. Add Redis

1. Project → "New" → "Database" → "Redis"
2. Railway akan auto-provision
3. Copy `REDIS_URL` (auto-generated)

---

## Step 4: Deploy API Service

1. Project → "New" → "GitHub Repo"
2. Select your repo
3. Configure:
   ```
   Service Name: api
   Root Directory: backend/api
   Build: Dockerfile
   ```
4. Environment Variables:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   PORT=${{PORT}}
   CRAWLER_QUEUE=linkedin_profiles
   SCORING_QUEUE=scoring_queue
   ```
5. Deploy

---

## Step 5: Deploy Scoring Worker

1. Project → "New" → "GitHub Repo"
2. Select same repo
3. Configure:
   ```
   Service Name: scoring
   Root Directory: backend/scoring
   Build: Dockerfile
   ```
4. Environment Variables:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   SCORING_QUEUE=scoring_queue
   CRAWLER_QUEUE=crawler_queue
   DEFAULT_REQUIREMENTS_ID=desk_collection
   ```
5. Deploy

---

## Step 6: Deploy Frontend ke Vercel

1. Login ke [vercel.com](https://vercel.com)
2. New Project → Import GitHub repo
3. Configure:
   ```
   Framework: Next.js
   Root Directory: frontend
   ```
4. Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
   NEXT_PUBLIC_API_URL=https://api-production-xxxx.up.railway.app
   ```
5. Deploy

---

## Step 7: Setup Crawler (Local/VPS)

Crawler TIDAK bisa di Railway (butuh Chrome).

### Option A: Local

```bash
cd backend/crawler
nano .env

# Edit:
REDIS_URL=redis://default:password@host:port
# Atau tetap pakai RabbitMQ jika mau

./start-all.sh start-visible
```

### Option B: VPS

Deploy dengan Docker di VPS.

---

## Railway vs Render Comparison

| Feature | Railway | Render |
|---------|---------|--------|
| Free Tier | ❌ No | ✅ Yes (with sleep) |
| Docker Support | ✅ Excellent | ✅ Good |
| Built-in DB | ✅ PostgreSQL | ❌ No |
| Built-in Redis | ✅ Yes | ❌ No |
| Sleep | ❌ Always on | ✅ Sleep after 15min |
| Multi-service | ✅ Easy | ⚠️ Manual |
| Price | ~$5-10/mo | $0 or $7/mo per service |

---

## Estimated Costs

Railway pricing (pay-as-you-go):

| Service | Usage | Cost/Month |
|---------|-------|------------|
| API | ~100 hours | ~$2 |
| Scoring | ~100 hours | ~$2 |
| PostgreSQL | 1GB | ~$1 |
| Redis | 256MB | ~$1 |
| **Total** | | **~$6-8/month** |

**Catatan:**
- Railway kasih $5 credit gratis per bulan
- Jadi bisa jadi gratis atau cuma $1-3/bulan

---

## Alternative: Pakai Supabase + CloudAMQP

Jika mau hemat, bisa tetap pakai:
- ✅ Supabase (database) - Free
- ✅ CloudAMQP (RabbitMQ) - Free
- ✅ Railway cuma untuk API + Scoring

Ini akan lebih murah (~$3-5/bulan).

---

## Next Steps

1. ✅ Setup Railway account
2. ✅ Create project
3. ✅ Add PostgreSQL & Redis
4. ✅ Deploy API & Scoring
5. ✅ Deploy Frontend ke Vercel
6. ✅ Setup Crawler di local/VPS

---

## Troubleshooting

### Build Failed
- Check Dockerfile path benar
- Check root directory benar
- Check logs di Railway dashboard

### Service Not Starting
- Check environment variables
- Check PORT variable
- Check logs

### Database Connection Failed
- Check DATABASE_URL benar
- Check PostgreSQL service running
- Run migrations

---

**Railway lebih simple dan powerful untuk project ini! 🚀**

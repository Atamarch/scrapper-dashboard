# 🚀 Quick Deploy Guide

Deploy dalam 15 menit!

## Prerequisites

- [ ] GitHub account
- [ ] Supabase account (free)
- [ ] Render account (free)
- [ ] Vercel account (free)

---

## 🎯 Quick Steps

### 1️⃣ Setup Database (5 min)

```bash
1. Login ke supabase.com
2. Create new project
3. SQL Editor → Run backend/api/supabase_migration.sql
4. Copy API keys (Project Settings → API)
```

### 2️⃣ Deploy Backend (5 min)

```bash
1. Login ke render.com
2. New Web Service → Connect GitHub
3. Configure:
   - Root Directory: backend/api
   - Runtime: Docker
   - Plan: Free
4. Add environment variables (see .env.production.example)
5. Deploy!
```

### 3️⃣ Deploy Frontend (5 min)

```bash
1. Login ke vercel.com
2. Import Project → Connect GitHub
3. Configure:
   - Root Directory: frontend
   - Framework: Next.js
4. Add environment variables (see .env.production.example)
5. Deploy!
```

---

## ✅ Verification

```bash
# Test API
curl https://your-api.onrender.com/health

# Test Frontend
open https://your-app.vercel.app
```

---

## 📚 Full Guide

See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) for detailed instructions.

---

## 💰 Cost

**Total: $0/month** (Free tier)

- Frontend (Vercel): $0
- Backend (Render): $0
- Database (Supabase): $0

⚠️ Render free tier sleeps after 15 min (cold start ~30s)

Upgrade to Starter ($7/month) for no sleep.

---

## 🆘 Issues?

1. Check [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)
2. Check service logs
3. Verify environment variables

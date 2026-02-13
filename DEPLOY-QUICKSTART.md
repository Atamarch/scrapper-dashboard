# ⚡ Quick Deploy ke Vercel (5 Menit)

Panduan super cepat deploy frontend ke Vercel.

---

## 🚀 Step-by-Step (5 Menit)

### 1️⃣ Push ke GitHub (1 menit)

```bash
# Pastikan di root project
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

---

### 2️⃣ Import ke Vercel (2 menit)

1. Buka: https://vercel.com/new
2. Login dengan GitHub
3. Klik **"Import"** pada repository Anda
4. **Root Directory:** Ketik `frontend` ✅
5. Centang **"Include source files outside of the Root Directory"** ✅
6. Klik **"Continue"**

---

### 3️⃣ Set Environment Variables (1 menit)

Scroll ke bawah, tambahkan 2 variables ini:

**Variable 1:**
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project.supabase.co
```

**Variable 2:**
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: your-anon-key-here
```

**Cara dapat Supabase credentials:**
- Buka: https://supabase.com/dashboard
- Pilih project → Settings → API
- Copy **URL** dan **anon public** key

---

### 4️⃣ Deploy! (1 menit)

1. Klik **"Deploy"**
2. Tunggu 2-3 menit ☕
3. Selesai! 🎉

URL Anda: `https://your-project.vercel.app`

---

## ✅ Test Dashboard

Buka URL Vercel Anda dan test:

- ✅ Homepage: `/`
- ✅ Admin Login: `/admin`
- ✅ Dashboard: `/admin/dashboard`
- ✅ Scheduler: `/admin/dashboard/scheduler`

---

## 🔄 Update Dashboard

Setiap kali ada perubahan:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Vercel akan **auto deploy** dalam 2-3 menit! 🚀

---

## 🐛 Troubleshooting

### Build Failed?

**Cek build di local:**
```bash
cd frontend
npm run build
```

Perbaiki error, lalu push lagi.

---

### Environment Variables Tidak Ketemu?

1. Vercel Dashboard → Project → Settings
2. Environment Variables
3. Tambahkan variables
4. Klik **"Redeploy"**

---

### Masih Error?

Lihat panduan lengkap: [DEPLOY.md](DEPLOY.md)

---

## 📝 Checklist

- [ ] Code sudah di-push ke GitHub
- [ ] Supabase URL dan Key sudah disiapkan
- [ ] Build berhasil di local (`npm run build`)
- [ ] Environment variables sudah ditambahkan di Vercel
- [ ] Deploy berhasil
- [ ] Dashboard bisa diakses

---

**Selesai! Dashboard Anda sudah online! 🎉**

URL: `https://your-project.vercel.app`

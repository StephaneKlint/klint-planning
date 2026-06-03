# 🚀 Setup Guide - CCI Planning Claude Design

## ✅ What I've Created Locally

```
✅ Monorepo structure (pnpm workspaces)
✅ Next.js 15 config (frontend package)
✅ TypeScript strict mode (tsconfig)
✅ Tailwind CSS setup
✅ Vercel deployment config (vercel.json)
✅ .env.example template
✅ .gitignore for Node/Next.js
✅ README.md with architecture docs
✅ Git initialized + first commit
```

**Repo location:** `/Users/stephanedurand/CCI_Planning_Claude_Design`

---

## 🔗 YOUR TURN - 3 Quick Steps (5 minutes total)

### **STEP 1: Create GitHub Repo** (1 minute)

Go to **https://github.com/new** and create:
- **Repository name:** `CCI_Planning_Claude_Design`
- **Visibility:** Public
- **Initialize:** NO (we already have git)

Then copy the HTTPS URL and run:

```bash
cd /Users/stephanedurand/CCI_Planning_Claude_Design

git remote add origin https://github.com/StephaneKlint/CCI_Planning_Claude_Design.git
git branch -M main
git push -u origin main
```

### **STEP 2: Create Neon Database** (1 minute)

Go to **https://console.neon.tech**:

1. Sign up / Log in
2. **Create new project**
   - **Project name:** `CCI_Planning_Claude_Design`
   - **Region:** EU (closest to you)
   - **Database:** `cci_planning`
3. Copy the connection string (PostgreSQL tab)
4. Save as `DATABASE_URL` in your notes

### **STEP 3: Create Vercel Project** (1 minute)

Go to **https://vercel.com/new**:

1. Sign in with GitHub
2. **Import Git Repository**
   - Select: `CCI_Planning_Claude_Design`
3. **Configure:**
   - Framework preset: **Next.js**
   - Root directory: `packages/frontend`
4. **Environment Variables:**
   - `DATABASE_URL` = (paste from Neon)
   - `NEXT_PUBLIC_API_BASE` = `https://cci-planning-claude-design.vercel.app`
5. **Deploy**

---

## 📋 Your Credentials Checklist

Once done, save these somewhere safe:

```
GitHub:
├── Repo URL: https://github.com/StephaneKlint/CCI_Planning_Claude_Design
└── Clone: git clone https://github.com/StephaneKlint/CCI_Planning_Claude_Design.git

Neon:
├── Project ID: [from dashboard]
├── API Key: [if needed later]
└── DATABASE_URL: postgresql://user:password@...

Vercel:
├── Project URL: https://cci-planning-claude-design.vercel.app
├── Dashboard: https://vercel.com/dashboard
└── Env vars configured: ✅
```

---

## ✨ After Setup - What's Next

Once you've done those 3 steps, **tell me "✅ Done"** and I will:

1. **Create NEW SESSION 12** with:
   - Model: `Sonnet 4.6` (token optimized)
   - Architecture reference loaded
   - Ready for your Claude Design handoff

2. **In Session 12:**
   - You paste the Claude Design prompt
   - I setup Next.js app structure
   - Create database schema (migrations)
   - Implement collaborative sync
   - Deploy to Vercel

---

## 🤔 Questions?

If you get stuck on any step:
- **GitHub:** Repo creation doesn't work? → [GitHub Docs](https://docs.github.com/en/get-started/quickstart/create-a-repo)
- **Neon:** Can't find connection string? → Check "Connection" tab, select "Pooled"
- **Vercel:** Deploy failing? → Check build logs, make sure root directory is set to `packages/frontend`

---

## 🎯 Estimated Timeline

- Step 1 (GitHub): **1 min**
- Step 2 (Neon): **2 min**
- Step 3 (Vercel): **2 min**
- **Total: ~5 minutes** ⏱️

**Then we launch Session 12!** 🚀

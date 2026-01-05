# 🚀 Quick Start Guide - Chore Points App

## Your App is Ready to Test! ✅

Your database is configured and migrations are complete. You can start testing immediately.

---

## Start the App (30 seconds)

1. **Open Terminal** and navigate to the project:
   ```bash
   cd /Users/mingfeiy/chore-points-app
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** to:
   ```
   http://localhost:3000
   ```

That's it! The app is now running.

---

## Quick Test Flow (5 minutes)

### Step 1: Create Parent Account (1 min)
1. Click **"Get Started"**
2. Fill in:
   - Name: `Test Parent`
   - Email: `parent@test.com`
   - Password: `password123`
   - Role: **Parent**
3. Click **Sign Up**
4. Click **"Create New Family"**
5. Family name: `Test Family`
6. **IMPORTANT**: Copy the invite code shown!

### Step 2: Create Chores (1 min)
1. Click **"Chores"** card
2. Click **"+ Add Chore"**
3. Add these:
   - `Make bed` - 10 points
   - `Wash dishes` - 15 points
   - `Do homework` - 25 points

### Step 3: Create Rewards (1 min)
1. Go back, click **"Rewards"** card
2. Click **"+ Add Reward"**
3. Add these:
   - `Extra screen time` - 50 points
   - `Choose dinner` - 75 points
   - `New toy` - 200 points

### Step 4: Create Kid Account (1 min)
1. Open **new incognito/private window**
2. Go to `http://localhost:3000`
3. Click **Sign Up**
4. Fill in:
   - Name: `Test Kid`
   - Email: `kid@test.com`
   - Password: `password123`
   - Role: **Kid**
5. **Paste your invite code**
6. Click **Join Family**

### Step 5: Award Points (1 min)
1. **In parent window**, click **"Points Ledger"**
2. Select `Test Kid`
3. Click **"+ Add Points"**
4. Select chore: `Make bed`
5. Note: `Good job!`
6. Click **Add Entry**
7. Repeat to give more points (60+ total)

### Step 6: Test Redemption (1 min)
1. **In kid window**, click **"Redeem Rewards"**
2. Find `Extra screen time` (50 points)
3. Click **"Redeem"**
4. **In parent window**, go to **"Rewards"**
5. You'll see pending request
6. Click **"Approve"**
7. Check Points Ledger - points deducted!

**🎉 You've tested the complete workflow!**

---

## View Your Data

Want to see the database directly?

```bash
npx prisma studio
```

Opens at `http://localhost:5555` - you can view/edit all data.

---

## Stop the Server

In the terminal where `npm run dev` is running:
- Press `Ctrl + C`

---

## Next Steps

✅ **App is working!** You've verified all core features.

**For detailed testing**: See [TESTING_GUIDE.md](./TESTING_GUIDE.md)

**For feature status**: See [FEATURE_STATUS.md](./FEATURE_STATUS.md)

**Want to add features?** See "Recommended Next Steps" in FEATURE_STATUS.md

---

## Troubleshooting

### Can't connect to database?
- Check `.env` file has correct `DATABASE_URL`
- Test connection: `npx prisma db pull`

### Port 3000 already in use?
- Kill the process: `lsof -ti:3000 | xargs kill -9`
- Or use different port: `npm run dev -- -p 3001`

### Changes not showing?
- Hard refresh: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
- Check terminal for errors

### "Prisma Client" errors?
- Regenerate: `npx prisma generate`

---

## Summary

✅ **Database**: Connected to Neon PostgreSQL
✅ **Migrations**: Up to date
✅ **Environment**: Configured
✅ **Ready to test**: Yes!

**Just run `npm run dev` and open `http://localhost:3000`**

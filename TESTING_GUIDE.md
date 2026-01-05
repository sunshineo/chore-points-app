# Chore Points App - Testing Guide

## Current Implementation Status

### ✅ Completed Features

#### 1. **Authentication System**
- [x] Email/password signup
- [x] Email/password login
- [x] NextAuth.js integration
- [x] Session management
- [x] Protected routes

#### 2. **Family Management**
- [x] Create new family
- [x] Generate unique invite codes
- [x] Join existing family with invite code
- [x] Family isolation (users only see their family's data)

#### 3. **User Roles & Permissions**
- [x] Parent role
- [x] Kid role
- [x] Role-based access control
- [x] Different dashboards for each role

#### 4. **Chores Management (Parent Only)**
- [x] Create chores
- [x] Edit chores
- [x] Delete chores
- [x] Set default point values
- [x] Activate/deactivate chores
- [x] View chores list

#### 5. **Points Ledger (Parent Only)**
- [x] Select kid from dropdown
- [x] View kid's total points
- [x] View complete points history
- [x] Add points (with or without chore association)
- [x] Edit point entries
- [x] Delete point entries
- [x] Add notes to entries
- [x] Audit trail (created by, updated by)
- [x] View redemption-related deductions

#### 6. **Rewards System (Parent)**
- [x] Create rewards
- [x] Edit rewards
- [x] Delete rewards
- [x] Set point costs
- [x] Add reward images (URLs)
- [x] View rewards catalog
- [x] View pending redemption requests
- [x] Approve redemptions (deducts points automatically)
- [x] Deny redemptions

#### 7. **Kid Dashboard**
- [x] View own points total
- [x] View points history
- [x] View available rewards
- [x] Request reward redemptions
- [x] View own current points balance
- [x] See redemption status

#### 8. **Database & Backend**
- [x] PostgreSQL database
- [x] Prisma ORM
- [x] Complete schema with relationships
- [x] API routes for all operations
- [x] Data validation
- [x] Error handling

---

## How to Test the Application

### Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL database** - You need one of these:
   - Local PostgreSQL installation
   - Free cloud database from [Neon](https://neon.tech)
   - Free cloud database from [Supabase](https://supabase.com)
   - [Vercel Postgres](https://vercel.com/storage/postgres)

### Step 1: Environment Setup

1. Navigate to the project directory:
   ```bash
   cd /Users/mingfeiy/chore-points-app
   ```

2. Check if `.env` file exists and has the required variables:
   ```bash
   cat .env
   ```

   You should see (with your actual values):
   ```
   DATABASE_URL="postgresql://..."
   NEXTAUTH_SECRET="..."
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. If `.env` doesn't exist, copy from example:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add:
   - Your PostgreSQL connection string for `DATABASE_URL`
   - A secret key for `NEXTAUTH_SECRET` (generate with: `openssl rand -base64 32`)

### Step 2: Database Setup

1. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

2. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

   This will create all the necessary tables.

3. (Optional) View your database:
   ```bash
   npx prisma studio
   ```

   This opens a visual database browser at http://localhost:5555

### Step 3: Start the Development Server

```bash
npm run dev
```

The app should now be running at **http://localhost:3000**

### Step 4: Testing Workflow

#### Test 1: Create Parent Account

1. Open http://localhost:3000
2. Click "Get Started" or "Sign Up"
3. Fill in:
   - Name: "Test Parent"
   - Email: "parent@test.com"
   - Password: "password123"
   - Role: Select "Parent"
4. Click "Sign Up"
5. You should be redirected to the family setup page

#### Test 2: Create Family

1. After signing up, you'll see "Create or Join Family"
2. Click "Create New Family"
3. Enter family name: "Test Family"
4. Click "Create Family"
5. **Important**: Copy the invite code shown - you'll need it for adding kids!

#### Test 3: Create Chores (as Parent)

1. From dashboard, click "Chores"
2. Click "+ Add Chore"
3. Add some test chores:
   - "Make bed" - 10 points
   - "Wash dishes" - 15 points
   - "Take out trash" - 20 points
   - "Do homework" - 25 points
4. Verify chores appear in the list

#### Test 4: Create Rewards (as Parent)

1. From dashboard, click "Rewards"
2. Click "+ Add Reward"
3. Add some test rewards:
   - "30 minutes extra screen time" - 50 points
   - "Choose dinner" - 75 points
   - "Sleep over at friend's" - 150 points
   - "New toy" - 200 points
4. (Optional) Add image URLs for rewards
5. Verify rewards appear in catalog

#### Test 5: Create Kid Account

1. Open a **new incognito/private browser window**
2. Go to http://localhost:3000
3. Click "Sign Up"
4. Fill in:
   - Name: "Test Kid"
   - Email: "kid@test.com"
   - Password: "password123"
   - Role: Select "Kid"
5. Click "Sign Up"
6. You should see "Join a Family"
7. **Paste the invite code** from Step 2
8. Click "Join Family"

#### Test 6: Award Points (as Parent)

1. Go back to the parent browser window
2. Click "Points Ledger" from dashboard
3. Select "Test Kid" from dropdown
4. Click "+ Add Points"
5. Test adding points:
   - Select a chore: "Make bed"
   - It should auto-fill 10 points
   - Add note: "Good job!"
   - Click "Add Entry"
6. Test manual points:
   - Click "+ Add Points" again
   - Leave chore blank
   - Enter 50 points
   - Add note: "Bonus for being helpful"
   - Click "Add Entry"
7. Verify total points show correctly (should be 60)

#### Test 7: View Points (as Kid)

1. Go to kid browser window
2. Click "My Points"
3. Verify you see:
   - Total points: 60
   - Points history showing both entries
4. Click "Redeem Rewards"
5. Verify you see available rewards
6. Rewards costing more than 60 points should show "Not enough points"

#### Test 8: Request Redemption (as Kid)

1. Still in kid browser
2. Find "30 minutes extra screen time" (50 points)
3. Click "Redeem"
4. Confirm the redemption
5. You should see "Redemption requested!"

#### Test 9: Approve Redemption (as Parent)

1. Go back to parent browser
2. Click "Rewards" from dashboard
3. You should see "Pending Redemption Requests (1)"
4. You should see the kid's request for screen time
5. Click "Approve"
6. Confirm approval
7. Go to "Points Ledger"
8. Verify kid now has 10 points (60 - 50)
9. Verify there's a negative entry showing the redemption

#### Test 10: Test Insufficient Points (as Kid)

1. In kid browser, go to "Redeem Rewards"
2. Try to redeem "Choose dinner" (75 points)
3. Button should be disabled or show "Not enough points"
4. Kid only has 10 points, not enough for 75-point reward

#### Test 11: Edit and Delete

As parent:
1. **Edit a chore**: Go to Chores → Click Edit → Change points → Save
2. **Delete a chore**: Click Delete → Confirm
3. **Edit a point entry**: Go to Ledger → Click Edit → Change values → Save
4. **Delete a point entry**: Click Delete → Confirm (only for non-redemption entries)
5. **Edit a reward**: Go to Rewards → Click Edit → Change values → Save
6. **Delete a reward**: Click Delete → Confirm

#### Test 12: Deny Redemption (as Parent)

1. In kid browser, request another redemption
2. In parent browser, go to Rewards
3. Click "Deny" instead of Approve
4. Verify request disappears
5. Verify kid's points were NOT deducted

### Step 5: Test Multiple Kids

1. Create another kid account (use a different email)
2. Join with same invite code
3. Award different points to each kid
4. Verify parent can switch between kids in Points Ledger
5. Verify each kid only sees their own points

---

## Common Issues & Solutions

### Issue: "Database connection failed"
**Solution**: Check your `DATABASE_URL` in `.env` file. Make sure your PostgreSQL database is running and accessible.

### Issue: "Invalid credentials" when logging in
**Solution**: Make sure you're using the exact email and password you signed up with. Passwords are case-sensitive.

### Issue: "Page not found" or 404 errors
**Solution**: Make sure the dev server is running (`npm run dev`). Check the terminal for any errors.

### Issue: "Prisma Client is not generated"
**Solution**: Run `npx prisma generate` to generate the Prisma client.

### Issue: Changes not showing up
**Solution**:
1. Check browser console for errors (F12)
2. Try hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. Check terminal for server errors

### Issue: Invite code doesn't work
**Solution**:
1. Make sure you copied the entire code
2. Code is case-sensitive
3. Check if parent account properly created a family
4. View database with `npx prisma studio` to verify family exists

---

## Database Inspection

To view your data directly:

```bash
npx prisma studio
```

This opens a GUI at http://localhost:5555 where you can:
- View all users
- See families and invite codes
- Check points entries
- View redemptions
- Manually edit/delete data if needed

---

## API Endpoints

You can also test the API directly:

### Authentication
- `POST /api/auth/signup` - Create account
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

### Family
- `GET /api/family` - Get current family
- `POST /api/family` - Create family
- `POST /api/family/join` - Join family
- `GET /api/family/kids` - Get all kids in family

### Chores
- `GET /api/chores` - List chores
- `POST /api/chores` - Create chore
- `PUT /api/chores/[id]` - Update chore
- `DELETE /api/chores/[id]` - Delete chore

### Points
- `GET /api/points?kidId={id}` - Get kid's points
- `POST /api/points` - Add points
- `PUT /api/points/[id]` - Update entry
- `DELETE /api/points/[id]` - Delete entry

### Rewards
- `GET /api/rewards` - List rewards
- `POST /api/rewards` - Create reward
- `PUT /api/rewards/[id]` - Update reward
- `DELETE /api/rewards/[id]` - Delete reward

### Redemptions
- `GET /api/redemptions` - List redemptions
- `POST /api/redemptions` - Request redemption
- `PUT /api/redemptions/[id]/approve` - Approve
- `PUT /api/redemptions/[id]/deny` - Deny

---

## Known Limitations

1. **No password reset** - If you forget password, you'll need to delete user from database
2. **No email verification** - Any email can be used, doesn't need to be real
3. **No OAuth** - Google/Apple login not configured (would need API keys)
4. **No notifications** - Parents don't get notified of new redemption requests
5. **No profile editing** - Can't change name/email after signup
6. **No family management** - Can't remove members or change family name
7. **Single currency** - Only one type of points, no multiple currencies
8. **No recurring chores** - No automated daily/weekly chore assignments
9. **No chore completion tracking** - Kids can't mark chores as done themselves

---

## Next Steps / Future Enhancements

Potential features to add:
- [ ] Dashboard statistics and charts
- [ ] Kid self-service chore completion
- [ ] Recurring/scheduled chores
- [ ] Point spending history charts
- [ ] Export data to CSV
- [ ] Email notifications for redemptions
- [ ] Photo upload for rewards (not just URLs)
- [ ] Multiple families per user
- [ ] Family settings management
- [ ] User profile editing
- [ ] Password reset flow
- [ ] Activity feed/timeline
- [ ] Achievement badges
- [ ] Point bonuses/multipliers
- [ ] Chore categories
- [ ] Calendar view of completed chores

---

## Tech Stack Reference

- **Frontend**: Next.js 14+ (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v5
- **Deployment**: Ready for Vercel

---

## Quick Test Checklist

Use this checklist for a complete test run:

- [ ] Parent signup
- [ ] Create family
- [ ] Save invite code
- [ ] Kid signup
- [ ] Join family with code
- [ ] Create 3+ chores
- [ ] Create 3+ rewards
- [ ] Award points for chore
- [ ] Award bonus points
- [ ] View points as kid
- [ ] Request redemption
- [ ] Approve redemption (verify points deducted)
- [ ] Request another redemption
- [ ] Deny redemption (verify points NOT deducted)
- [ ] Edit chore
- [ ] Edit reward
- [ ] Edit point entry
- [ ] Delete point entry
- [ ] Test with 2 kids
- [ ] Switch between kids in ledger
- [ ] Verify each kid sees only their data

---

## Support

If you run into issues:
1. Check the terminal for error messages
2. Check browser console (F12) for frontend errors
3. Use `npx prisma studio` to inspect database
4. Check the `.env` file is configured correctly
5. Verify database migrations ran successfully

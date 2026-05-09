# Weekly App Bug & Feature Audit — jason-workout-app

**Live App:** jason-workout-app.vercel.app  
**Repo:** JSNARITECH/jason-workout-app  
**Supabase Project ID:** fnjjfnsdxibjbzldfgit

## Weekly Audit Workflow

### Step 1: Pull Open Backlog
```sql
SELECT * FROM app_bugs WHERE status = 'open' ORDER BY priority DESC, created_at ASC;
```

### Step 2: For Each Open Bug
1. Read the `description` and `affected_area`
2. Pull the relevant section of the live app code from the repo
3. Determine if it's already been fixed in the current codebase (may have been fixed without the table being updated)
4. **If already fixed:**
   ```sql
   UPDATE app_bugs SET status = 'resolved', resolved_date = CURRENT_DATE, resolution_notes = '[what you found]' WHERE bug_id = '[id]'
   ```
5. **If not fixed:** Fix it, push to main, then update the record to resolved

### Step 3: After All Fixes Pushed
- Bump the app version in `app_versions` table
- Run quick smoke test: 
  - Does the app load?
  - Can a workout be logged?
  - Do PRs display correctly?

### Step 4: Final Report
Output this format exactly:
```
WEEKLY BUG AUDIT — [date]
Fixed this session: [list]
Already resolved (table updated): [list]
Still open (blocked/deferred): [list]
New issues found: [list]
Current app version: [version]
```

## Priority Order
1. **critical** ← Always first
2. **high**
3. **medium**
4. **low**

## ⚠️ Security Alert
**Never skip BUG-SEC-1 (RLS)** — that is always the first fix if still open.

---

**Process:** One paste per week. Claude Code handles the full loop — audit → fix → push → update Supabase → report. 🔥

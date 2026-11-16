# What to Do Next: Final Checklist & Action Plan (Phase 7 & Presentation)

**Current Status:** All code, services, tests, and documentation are **100% complete, tested, and feature-frozen**.  
The remaining tasks are **human presentation, rehearsal, and optional cloud deployment steps**.

---

## 1. Immediate Action Items (Priority Order)

```mermaid
flowchart TD
    Step1["1. Run Local Verification Checks\n(pnpm demo:reset && pnpm test)"]
    Step2["2. Practice 7-Minute Demo Script\n(Follow docs/demo-script.md twice)"]
    Step3["3. Record Backup Screen Video (H7)\n(7-min walkthrough with audio)"]
    Step4["4. Sign Off QA Checklist\n(docs/qa-checklist.md)"]
    Step5["5. Optional Cloud Deployment (H1-H5)\n(Deploy to Vercel & Neon if required)"]
    Step6["6. Live Evaluation / Presentation"]

    Step1 --> Step2 --> Step3 --> Step4 --> Step6
    Step2 -. Optional .-> Step5
```

---

## 2. Step-by-Step Execution Guide

### Task 1: Verify Local Environment (10 Minutes)
Before doing anything else, confirm your machine runs the suite cleanly:
1. Open PowerShell and navigate to the project directory:
   ```powershell
   cd SYSINT_GOODHAND
   ```
2. Reset databases to clean baseline:
   ```powershell
   pnpm demo:reset
   ```
3. Run automated tests:
   ```powershell
   pnpm test
   ```
   *Expected: All 34 tests passing.*
4. Start both servers:
   ```powershell
   pnpm dev
   ```
5. Confirm both apps open:
   - Store: [http://localhost:3000](http://localhost:3000)
   - FSM: [http://localhost:3100](http://localhost:3100)

---

### Task 2: Group Rehearsal (Twice) (20 Minutes)
Read [`docs/demo-script.md`](file:///c:/Users/John%20Darev/Downloads/SYSINT_GOODHAND/docs/demo-script.md) and practice the presentation with your partner:
- **Run 1 (Familiarization):** Click through every step, following the talking points for **OBJ-01**, **OBJ-02**, **OBJ-03**, and **OBJ-04**.
- **Run 2 (Timed Rehearsal):** Use a stopwatch on your phone. Target duration: **under 7 minutes**.
- **Reset between runs:** Run `pnpm demo:reset` before each practice run to reset orders and appointments.

---

### Task 3: Record Backup Screen Recording (`H7`) (15 Minutes)
> **Why this matters:** University presentations and evaluation rooms often have unstable Wi-Fi or projector issues. Having a pre-recorded backup video guarantees you can present even if your laptop or network fails.

1. Reset data: `pnpm demo:reset`
2. Open Windows Game Bar (`Win + Alt + R`) or software like OBS / Loom.
3. Record yourself walking through the 7-minute demonstration script on `localhost:3000` and `localhost:3100`.
4. Speak aloud or add voiceover explaining the 4 core objectives.
5. Save the MP4 file in a shared Google Drive or USB flash drive named `GoodHand_Demo_Backup.mp4`.

---

### Task 4: Complete the Manual QA Checklist (10 Minutes)
1. Open [`docs/qa-checklist.md`](file:///c:/Users/John%20Darev/Downloads/SYSINT_GOODHAND/docs/qa-checklist.md).
2. Review the 34 manual test points (all have already been verified in code and tests).
3. Fill in your name, today's date, and mark each test case as `PASS` with your initials.
4. Save and commit the file.

---

### Task 5 (Optional): Live Cloud Deployment (`H1` to `H5`)
> **Note:** If your evaluation allows running locally on `localhost:3000` and `localhost:3100`, cloud deployment is **optional**. If your professor or evaluators require live public URLs, follow these steps:

Refer to [`docs/deployment.md`](file:///c:/Users/John%20Darev/Downloads/SYSINT_GOODHAND/docs/deployment.md) for full instructions:
- [ ] **H1:** Connect your GitHub repository to [Vercel](https://vercel.com) and create two projects:
  - `goodhand-store` (Root Directory: `apps/store`)
  - `goodhand-fsm` (Root Directory: `apps/fsm`)
- [ ] **H2:** Create two free PostgreSQL databases on [Neon](https://neon.tech):
  - `store_db` for System A
  - `fsm_db` for System B (Execute `CREATE EXTENSION IF NOT EXISTS btree_gist;`)
- [ ] **H3 (Optional):** Purchase/configure a custom domain in Vercel (or use free `.vercel.app` domains).
- [ ] **H4 (Optional):** Add [Resend](https://resend.com) API key for live emails (or leave empty to keep using the in-app live mail log).
- [ ] **H5:** Add environment variables from `docs/deployment.md` to Vercel and set `CRON_SECRET_STORE` in GitHub Repository Secrets to enable `.github/workflows/drain.yml`.

---

### Task 6 (Optional/Recommended): H6 Message to GoodHand
- [ ] Send an informal courtesy note to GoodHand clarifying that this prototype is for student academic evaluation and operates strictly on local/sandbox infrastructure with no live customer data.

---

## 3. Human Gates Summary Matrix

| Gate | Description | Owner | Status | How to Clear |
|---|---|:---:|:---:|---|
| **H1** | Link Vercel & GitHub | Human | Pending | Connect repo in Vercel dashboard |
| **H2** | Neon PostgreSQL & `btree_gist` | Human | Pending | Create Neon projects and run SQL command |
| **H3** | Domain in Vercel | Human | Optional | Configure domain or use default `.vercel.app` |
| **H4** | Resend API setup | Human | Optional | Leave empty to use in-app `/demo` mail log |
| **H5** | Set GitHub Secrets | Human | Pending | Add `CRON_SECRET_STORE` to repo secrets |
| **H6** | GoodHand Courtesy Notice | Human | Optional | Send student email notice |
| **H7** | 2x Rehearsal & Screen Recording | **You & Partner** | **Immediate** | **Follow Task 2 & Task 3 above** |

---

## 4. You are Ready!
Everything in the codebase is solid, tested, and documented. Good luck with your presentation!

# Human Gates Checklist & Instructions

As per section 0.5 of `task.md`, the items below require human action and configuration. The agent will never tick these boxes.

---

### [ ] H1: Vercel & GitHub Linking
- **Instructions:**
  1. Create a GitHub repository (e.g., `goodhand-prototype` or private repository).
  2. Push the local `main` branch to this GitHub repository.
  3. Log into [Vercel](https://vercel.com) and link the repository to create two Vercel projects:
     - `store` (Root Directory: `apps/store`)
     - `fsm` (Root Directory: `apps/fsm`)
- **Status:** Pending

---

### [ ] H2: Neon Postgres Provisioning
- **Instructions:**
  1. In the Vercel Marketplace (or directly on [Neon.tech](https://neon.tech)), create two Postgres databases:
     - `store_db`
     - `fsm_db`
  2. For each database, create a test branch (`store_test`, `fsm_test`).
  3. Record the connection strings in your local `.env` and Vercel environment variables:
     - `STORE_DATABASE_URL` and `STORE_TEST_DATABASE_URL`
     - `FSM_DATABASE_URL` and `FSM_TEST_DATABASE_URL`
  4. Ensure both databases allow the `btree_gist` extension (Neon supports this out of the box).
- **Status:** Pending

---

### [ ] H3: Custom Domain Purchase
- **Instructions:**
  1. Purchase an inexpensive domain directly in Vercel or your registrar.
  2. **Important Safety Rule:** The domain name must NOT contain the word "goodhand" (e.g., `secservice-demo.xyz`).
  3. Map `shop.<domain>` to the `store` Vercel project.
  4. Map `field.<domain>` to the `fsm` Vercel project.
- **Status:** Pending

---

### [ ] H4: Resend Email Integration
- **Instructions:**
  1. Add Resend from the Vercel Marketplace or directly via [Resend.com](https://resend.com).
  2. Add and verify your custom domain in Resend DNS settings.
  3. Provide `RESEND_API_KEY` and configure `MAIL_FROM=no-reply@<domain>`.
  4. *Note:* Until this is done, the app will log outgoing emails to the internal `mail_log` database table without failing.
- **Status:** Pending

---

### [ ] H5: GitHub Repository Secrets
- **Instructions:**
  1. In your GitHub repository under `Settings -> Secrets and variables -> Actions`, add:
     - `CRON_SECRET`: Random 32+ character string matching `CRON_SECRET_STORE` and `CRON_SECRET_FSM`.
     - `STORE_PUBLIC_URL`: URL to the deployed store app (e.g. `https://shop.<domain>`).
     - `FSM_PUBLIC_URL`: URL to the deployed field app (e.g. `https://field.<domain>`).
- **Status:** Pending

---

### [ ] H6: Courtesy Notice to GoodHand (Optional/Recommended)
- **Instructions:**
  - Send a brief courtesy message to GoodHand informing them that this is a non-commercial academic class prototype with synthetic data.
- **Status:** Pending

---

### [ ] H7: Rehearsal & Screen Recording (Day 7)
- **Instructions:**
  - Run through the full 7-minute demo script (`docs/demo-script.md`) with your project group.
  - Record a clean backup screen recording showing end-to-end execution.
- **Status:** Pending (Scheduled for Day 7)

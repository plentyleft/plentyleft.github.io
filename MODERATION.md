# PlentyLeft moderation (App Store Guideline 1.2)

## What this does

When someone **Reports** content or **Blocks** a user in the app, a row is added to `public.reports`. A Database Webhook calls the `notify-report` Edge Function, which emails you via Resend so you can act **within 24 hours**.

---

## Setup (do these in order by hand)

### Step 1 — Get a Resend API key

1. Go to [https://resend.com](https://resend.com) and sign in (or create an account).
2. Open **API Keys** → **Create API Key**.
3. Copy the key (it starts with `re_`). Keep it private.
4. For testing, Resend lets you send **from** `onboarding@resend.dev` without verifying a domain. You can only send **to** your own Resend account email until you verify a domain.

### Step 2 — Invent a webhook secret

1. Make up a long random string (for example, run in Terminal: `openssl rand -hex 32`).
2. Save it somewhere safe. You will paste it twice: once as a Supabase secret, once as a webhook header.
3. Example shape (do **not** use this exact value): `a1b2c3d4e5f6...`

### Step 3 — Set Edge Function secrets in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project **gkuqxocqjdqlgvknywlq**.
2. Go to **Project Settings** (gear) → **Edge Functions** → **Secrets**  
   (or **Edge Functions** → manage secrets, depending on the UI).
3. Add these three secrets (names must match exactly):

| Secret name | Value |
|---|---|
| `RESEND_API_KEY` | your `re_…` key from Step 1 |
| `ADMIN_EMAIL` | the inbox you check daily (e.g. `plentyleftapp@gmail.com`) |
| `WEBHOOK_SECRET` | the random string from Step 2 |

4. Save. Do not put these values in git or in the function source code.

### Step 4 — Deploy the `notify-report` function

On your Mac, in Terminal:

```bash
cd /Users/outsideoffline/plentyleft
supabase login
supabase link --project-ref gkuqxocqjdqlgvknywlq
supabase functions deploy notify-report --project-ref gkuqxocqjdqlgvknywlq
```

(If your CLI is already linked, you can skip `login` / `link`.)

Confirm it appears under **Edge Functions** in the dashboard as `notify-report`.

Function URL (you will need this next):

`https://gkuqxocqjdqlgvknywlq.supabase.co/functions/v1/notify-report`

### Step 5 — Create the Database Webhook

1. In Supabase Dashboard go to **Database** → **Webhooks** (sometimes under **Integrations** → **Database Webhooks**).
2. Click **Create a new hook** (or **Enable Webhooks** first if asked).
3. Fill in:

| Field | Value |
|---|---|
| Name | `notify-report-on-insert` |
| Table | `public.reports` (schema `public`, table `reports`) |
| Events | check **Insert** only |
| Type | HTTP Request |
| Method | POST |
| URL | `https://gkuqxocqjdqlgvknywlq.supabase.co/functions/v1/notify-report` |

4. Under **HTTP Headers**, add **two** headers:

| Header name | Header value |
|---|---|
| `Content-Type` | `application/json` |
| `x-webhook-secret` | **exactly the same** `WEBHOOK_SECRET` value from Step 2 |

5. Save / create the webhook.

> The function rejects any request missing or mismatching `x-webhook-secret` with **401**.

### Step 6 — Test

**A. Quick unauthorized check (should fail)**  
In Terminal:

```bash
curl -i -X POST \
  'https://gkuqxocqjdqlgvknywlq.supabase.co/functions/v1/notify-report' \
  -H 'Content-Type: application/json' \
  -d '{"record":{"reason":"spam"}}'
```

You should see **401 Unauthorized**.

**B. Authorized fake payload (should email you)**  
Replace `YOUR_WEBHOOK_SECRET` with the real secret:

```bash
curl -i -X POST \
  'https://gkuqxocqjdqlgvknywlq.supabase.co/functions/v1/notify-report' \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: YOUR_WEBHOOK_SECRET' \
  -d '{
    "type": "INSERT",
    "table": "reports",
    "record": {
      "reason": "spam",
      "note": "test note",
      "content_type": "listing",
      "content_id": "00000000-0000-0000-0000-000000000001",
      "reporter_id": "00000000-0000-0000-0000-000000000002",
      "reported_user_id": null,
      "reported_organization_id": "00000000-0000-0000-0000-000000000003",
      "created_at": "2026-10-21T12:00:00Z"
    }
  }'
```

You should see **200** and get an email: subject `[PlentyLeft] New report: spam`.

**C. End-to-end via the table**  
In **SQL Editor**, run (use real UUIDs from your `users` / `organizations` if FK checks require them, or insert via the app’s Report button):

```sql
insert into public.reports (
  reporter_id, content_type, content_id,
  reported_organization_id, reason, note
) values (
  '<a-real-user-uuid>',
  'listing',
  null,
  null,
  'spam',
  'webhook end-to-end test'
);
```

Or in the app: open a listing → **⋯** → **Report** → submit.  
Check your `ADMIN_EMAIL` inbox (and spam folder).

**D. Block notification**  
Report with reason `blocked` (or Block a user in the app). Subject should be `[PlentyLeft] New report: blocked`, and the body should label it as a **Block notification**.

If no email arrives: **Edge Functions** → `notify-report` → **Logs**, and Resend dashboard → **Emails**.

---

## After you get an alert (24-hour SLA)

1. Open **Table Editor** → `reports` → find rows with `status = 'open'`.
2. Review the listing / org.
3. In **SQL Editor** (as needed):

```sql
select public.admin_remove_listing('<listing_uuid>', 'guideline 1.2');
select public.admin_ban_user('<user_uuid>');
select public.admin_ban_organization('<org_uuid>');
```

4. Mark done:

```sql
update public.reports set status = 'actioned' where id = '<report_uuid>';
```

---

## In-app reference

| Action | Where | Effect |
|---|---|---|
| Agree to Terms | Login + TermsGate | Writes `users.terms_accepted_at` / `terms_version` |
| Report | `⋯` on listing/claim cards | Inserts `reports` row → webhook → email |
| Block user | `⋯` → Block user | Org block + `reports.reason = 'blocked'` → email |

Banned users are signed out by the app and blocked by restrictive RLS on `listings` / `matches`.

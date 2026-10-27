# First-Time Setup Guide

**Welcome to your new AI communications workspace.**

This guide is written for non-technical users, business owners, and managers. It walks you through everything you need to do the first time you open the platform: creating your owner account, naming your workspace so it shows *your* organization's name everywhere, signing in, and getting your team started. No technical knowledge is required — if you can fill in a form in your web browser, you can do this.

The platform itself is a multi-channel AI communications assistant for your organization: it can watch your email inboxes, draft and send replies when you approve them, answer questions about your mail, talk to customers on WhatsApp, and speak with you over a realtime voice connection. You will connect those channels one at a time, after the basic setup below.

> **Who is this guide for?** The first person to open a freshly reset or newly deployed platform. That person becomes the **owner** of the workspace. After you finish, you can invite your colleagues — they only need the shorter "Sign in" section.

---

## 1. What you need before you start

Collect these four things before opening the setup page. Each one takes only a minute to find, and having them ready makes the whole process take less than ten minutes.

| # | What you need | Where it comes from | Example |
|---|---------------|---------------------|---------|
| 1 | **Your workspace web address** | The link that was shared with you when the platform was set up | `https://aca.starcitytechnical.com` |
| 2 | **The one-time setup key (bootstrap token)** | Provided by whoever deployed/reset the platform for you. It is a long secret code, like a safe-deposit key. It is used **only once**, only by you | `xp2v...` (a long string of characters) |
| 3 | **Your email address and a strong password** | Your own work email; the password must be at least 12 characters and contain an uppercase letter, a lowercase letter, and a number | `priya@yourcompany.com` |
| 4 | **Your organization's name** (and, optionally, a product/project name) | Decided by you — for example your company name, and the name you want everyone to see in the top-left corner of the platform | Organization: `StarCity Technical` · Product name: `StarCity Connect` |

**About the setup key:** it exists so that only an authorized person can create the first account on a brand-new system. If you do not have it, ask the person or team that installed the platform for you. If someone else already used it, the workspace already has an owner — in that case skip straight to *Sign in* (Section 3).

---

## 2. First-time setup: creating your account and naming your workspace

This is the most important part of the whole guide, because the names you enter here are the names the whole platform will use from now on. Take a moment to decide them before you begin.

### 2.1 Open the setup page

1. Open your web browser (Chrome, Edge, Firefox or Safari all work).
2. Go to your workspace web address and add `/setup` at the end — for example `https://aca.starcitytechnical.com/setup`.
3. You will see a form titled **"Initialize your workspace"**.

> If you instead see a sign-in page, someone has already completed the first-time setup. Use the *Sign in* section of this guide instead.

### 2.2 Fill in the form

The form has seven fields. Here is what each one means and how to choose well:

| Field | What it means | Tips for choosing |
|-------|---------------|-------------------|
| **Bootstrap token** | The one-time setup key from Section 1 | Paste it exactly as given to you. It is case-sensitive. |
| **Your name** | Your own full name — you will be the workspace owner | This is shown to your team members later |
| **Email** | Your work email address | This becomes your sign-in ID and cannot be easily changed later |
| **Password** | Your sign-in password | At least 12 characters, with an uppercase letter, a lowercase letter, and a number. Write it down somewhere safe — you will need it every day. |
| **Organization name** | The name of your company or team | This is used across the workspace, for example in settings and member lists. Use your real business name, e.g. `StarCity Technical`. |
| **Organization slug** | A short, lowercase, no-spaces version of your organization name | Only small letters, numbers and hyphens (e.g. `starcity-technical`). It works like an internal username for your organization — customers never see it, and it cannot be changed later, so keep it simple. |
| **Product / project name** *(optional)* | **The name displayed in the top-left navigation bar and in the browser tab, everywhere in the platform.** | If you leave this empty, the platform simply uses your Organization name. If you want the platform to carry a specific brand — for example `StarCity Connect` — type it here. You can change it at any time later in Settings (Section 4). |

### 2.3 Why the "Product / project name" field matters

You control what the platform is called. From the moment you complete this form, the name in the navigation bar comes **from you** — either your Organization name or the Product/project name you entered. The platform deliberately never displays a built-in or generic product brand in the navigation bar, the top bar, or the browser tab. If you skipped this field or want to change it later, the *Change your workspace name* section below shows you how — it takes about thirty seconds and updates the whole platform immediately.

### 2.4 Finish

Click **Initialize workspace** and wait a few seconds. When you see **"Workspace initialized"**, your owner account has been created and you are done with the one-time setup. Click **Continue to sign in**.

> **If something goes wrong**
> - *"Invalid bootstrap credentials"* — the setup key is wrong or was mistyped. Check it again with whoever provided it.
> - *"Initial authentication is already initialized"* — the workspace already has an owner (perhaps you already did this, or a colleague did). Just sign in instead.
> - *"Password does not meet requirements"* — make sure it is at least 12 characters and includes an uppercase letter, a lowercase letter, and a number.

---

## 3. Sign in (everyday use)

Signing in is the same for you and everyone you invite.

1. Open your workspace web address. You will land on the **Welcome back** sign-in page (or add `/login` to the address).
2. Enter your **Email** and **Password**.
3. Click **Sign in**. You will arrive at the **Overview** page — your home screen.

The left side of the screen is the navigation menu (Overview, Chat, Agents, Mail, WhatsApp, Knowledge, Activity, Audit, Operations, Settings). The top-left corner shows your workspace name — your Organization name or Product/project name. Everything you do from now on lives inside this workspace and is visible only to your organization.

> **Forgot your password?** Ask the workspace owner (or an admin) to reset it for you from **Settings → Members & roles**. If you are the owner and lost your password, contact whoever manages the server for you.

---

## 4. Change your workspace (project) name — anytime

You can rename the workspace, or set a different display name, whenever you like — for example after a rebrand or a spelling correction. This is a normal, safe action; nothing else in the workspace is affected.

1. Sign in, then open **Settings** (bottom of the left menu).
2. In the **Organization** card at the top you will find two editable fields:
   - **Organization name** — your company/team name.
   - **Product / project name** — the optional display name shown in the navigation bar and browser tab. Leave it empty to fall back to the Organization name.
3. Edit either field, then click **Save workspace names**.
4. The change is immediate: the navigation bar, the top bar and the browser tab now show the new name everywhere in the platform.

**How the name is decided, in one line:** *Product/project name (if set) → otherwise Organization name → otherwise the word "Workspace".* There is no built-in product brand that can override your choice.

> Only the workspace **owner** or an **admin** can change these names (see roles below). The organization *slug* is fixed after setup — it is only an internal identifier and is never shown to your customers.

---

## 5. Invite your team and choose their roles

The workspace supports four roles. In plain words:

| Role | What they can do |
|------|------------------|
| **Owner** | Full control — the one account that can never be removed. Manages members, settings and connections. |
| **Admin** | Almost everything the owner can do: invite people, change settings, connect email and WhatsApp. |
| **Member** | Day-to-day work: chat with the assistant, work with mail and approvals. |
| **Viewer** | Read-only — can look at reports and activity, but cannot change anything. |

To add a colleague: open **Settings → Members & roles**, click **Add member**, enter their email and choose a role. Their initial password is set for them on first invite (or by an admin). Start people on **Member** and promote only when they need more responsibility.

A good habit for small teams: keep one owner (you), make your most trusted colleague an admin as backup, and keep everyone else as members. If an employee leaves, an owner or admin can suspend their access from the same Members & roles table in one click.

---

## 6. Connect your email (recommended first channel)

Connecting email is what turns the workspace from an empty shell into a working assistant. Once connected, the platform continuously synchronizes that mailbox so the assistant can summarize threads, find answers inside your own correspondence, and draft replies for your approval.

1. Open **Mail → Accounts** in the left menu and click to add an account.
2. Pick your provider: **Gmail / Google Workspace**, **Microsoft 365 / Outlook**, **Zoho Mail**, or a classic **IMAP/SMTP** server (this covers most other providers).
3. For Gmail, Microsoft and Zoho you will be redirected to the provider's own sign-in page — you are logging in with *your* email provider, and the platform only receives permission to sync that mailbox. For IMAP, enter the server details your IT support or email provider gives you, plus an app password.
4. Wait for the **first synchronization** to finish (you can watch the progress on the same page). Depending on the size of the mailbox this takes from a few minutes to a while for very large mailboxes.

You can connect **several** mailboxes — for example `sales@`, `support@` and your personal work address — and the assistant keeps them separate and clearly labeled. Sending on your behalf is always approval-controlled: drafts wait for you unless you have explicitly allowed more.

> **Gmail tip:** if you use 2-step verification (you should), create an *App Password* for the IMAP connection rather than your normal password. If your company email is on Google Workspace or Microsoft 365, an admin may need to allow the connection once.

---

## 7. Set up the AI (make the assistant intelligent)

The assistant needs an AI "engine" behind it. This is a one-time configuration that the owner or an admin does from **Settings → AI providers** (or the **AI Provider Setup** page in the left menu).

1. Choose a provider — the platform supports **OpenAI**, **Google Gemini** and **Sarvam** (a good choice if your users are in regions where OpenAI is restricted).
2. Paste the **API key** you obtained for that provider, and pick the models you want to enable for chat, voice and embeddings.
3. Save. The credentials are encrypted on the server and are never displayed again after saving.

That is all most organizations need. Advanced options (knowledge-base ID, default models, voice settings) live under **Settings → AI runtime** and come pre-filled with sensible defaults. If the AI is not yet configured, the platform tells you clearly instead of pretending to work — you will see a friendly "configuration required" note in Chat or Voice until this section is completed.

---

## 8. Connect WhatsApp (optional)

If your business talks to customers on WhatsApp, you can connect one WhatsApp Business account.

1. You will need a **Meta Business Manager** account and a WhatsApp Business number (details are on the platform's WhatsApp page under *webhook setup guide*).
2. Open **WhatsApp** in the left menu and paste your access token from Meta.
3. Follow the on-screen webhook instructions — this is the one step where your Meta account and the platform shake hands.

Once connected, customers who message your business number appear inside the workspace, and the assistant can draft replies (and send automatically only where you have allowed it). A note worth knowing from day one: WhatsApp allows free-form automated replies only inside a **24-hour window** after a customer's last message; outside that window the platform uses pre-approved message templates instead.

---

## 9. Your first 30 minutes — quick checklist

| ✔ | Step | Where |
|---|------|-------|
| ☐ | Complete first-time setup (owner account + organization + optional product name) | `/setup` |
| ☐ | Sign in and look around the Overview page | `/login` |
| ☐ | Confirm the workspace name shown in the top-left corner is what you want | Any page → top-left |
| ☐ | Change the product/project name if you want your own brand | Settings → Organization |
| ☐ | Invite at least one colleague (optional but recommended) | Settings → Members & roles |
| ☐ | Connect your first mailbox | Mail → Accounts |
| ☐ | Configure the AI provider key | Settings → AI providers |
| ☐ | Try the assistant: ask *"Summarize my recent unread email"* | Chat |

---

## 10. Getting help

- **Something looks wrong in a channel** (email not syncing, WhatsApp disconnected): check the **Operations** page in the left menu — it shows the live health of every service in plain indicators.
- **A colleague is locked out**: an owner or admin resets access from **Settings → Members & roles**.
- **Setup key problems or forgotten owner password**: contact whoever deployed or hosts the platform for you — these are the two things only the server administrator can fix.
- **The assistant made a mistake**: like every AI assistant it can be wrong. Important information is worth a quick double-check, and anything it sends on your behalf goes through your approval queue unless you explicitly relaxed that.

Enjoy your workspace — it is yours, it carries your name, and your team is one invite away.

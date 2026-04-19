# 📝 List: High-Performance Collaborative List App

A streamlined, **offline-first** collaborative list application built for speed, reliability, and precision. Designed with a "Lab-Bench" aesthetic, it prioritizes functional clarity and robust synchronization.

## 🚀 Key Features

- **Offline-First Excellence**: The UI interacts directly with **IndexedDB (via Dexie.js)**. Use the app without an internet connection; changes sync automatically when you're back online.
- **Real-Time Synchronization**: Intelligent background reconciliation between local state and a **Postgres (Neon)** backend using conflict resolution timestamps.
- **Magic Link Authentication**: Passwordless login via **Resend**. Anonymous lists created before login are automatically merged into your account upon verification.
- **Precision Reordering**: Drag-and-drop powered by `svelte-dnd-action` with float-based ranking for O(1) performance.
- **QR Code Session Migration**: Effortlessly move your current session (even anonymous ones) to a mobile device by scanning a generated QR code from the user menu.
- **Soft Deletes & Recovery**: Deleted items aren't gone forever. A dedicated "Safe Delete" flow allows for instant restoration of accidentally removed items.
- **Lab-Bench Aesthetic**: A custom-built design system using vanilla CSS and **Bits UI** primitives, focused on high-density information and professional utility.
- **Collaborative Sharing**: Invite others via secure links or QR codes. Includes automatic slug disambiguation (e.g., `/list--prefix`) if multiple users share the same list name.

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | SvelteKit 5 (Runes) |
| **Local Database** | Dexie.js (IndexedDB) |
| **Remote Database** | Neon (PostgreSQL) |
| **ORM** | Drizzle ORM |
| **UI Primitives** | Bits UI (Headless) |
| **Email/Auth** | Resend + Svelte Email |
| **Deployment** | Vercel |

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/) (recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/list.git
   cd list
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgres://...
   RESEND_API_KEY=re_...
   PUBLIC_APP_URL=http://localhost:5173
   ```

4. Push the database schema:
   ```bash
   pnpm db:push
   ```

5. Start the development server:
   ```bash
   pnpm dev
   ```

## 📖 How to Use

### 1. Managing Lists
- **Create**: Click the "New List" button on the dashboard to generate a unique list slug.
- **Collaborate**: Simply share the URL with anyone. If they are logged in (or even anonymous), changes will sync across devices.
- **Organize**: Use the drag handles to reorder items. The app uses precision ranking to ensure consistency.
- **Share**: Use the context menu in any list to generate an invite link or QR code. You can choose between permanent links or 24-hour temporary invites.
- **Disambiguation**: If you join a list with a slug that you already own (e.g., both named "Grocery"), the joined list will automatically be available at a unique path (e.g., `/grocery--oac123`).

### 2. Authentication Flow
- **Anonymous Mode**: Start using the app immediately without an account.
- **Securing Your Data**: Enter your email in the settings or login page. You'll receive a magic link.
- **Merging**: Once verified, any lists you created while anonymous are permanently linked to your verified account.
- **Migration**: Open the user menu and select "Move to Mobile" (or scan the QR code) to instantly transfer your session to another device without logging in.

### 3. Restoring Items
- If you delete an item, it enters a "Soft Delete" state.
- Use the **Restore UI** (often found in the list header or search) to see recently deleted items and bring them back with one click.

## 🏗️ Architecture

The app follows a **Local-First** architecture:
1. **User Action**: UI updates instantly via Dexie.js.
2. **Queueing**: The operation is added to a local `syncQueue`.
3. **Background Sync**: A worker processes the queue, sending batches to the `/api/sync` endpoint.
4. **Resolution**: The server applies changes and returns any remote updates, which are merged back into IndexedDB.

---

Built with ❤️ by the List Team.

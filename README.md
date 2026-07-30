# Lawizer Backend API Documentation

Welcome to the Lawizer Backend repository! This document provides a comprehensive overview of the core API endpoints, organized by their intended actor: **Admin**, **User (Client)**, and **Expert (Professional)**.

---

## 🔐 Authentication & Security Overview
The API employs two main security patterns:
1. **User & Expert Endpoints:** These endpoints are strictly secured. They require a valid Supabase JWT token passed in the `Authorization: Bearer <token>` header. The backend verifies this token with Supabase and extracts the `userId` or `expertId` automatically to prevent spoofing.
2. **Admin Endpoints:** Currently, the Admin endpoints do not enforce token verification middleware across the board. **Before production**, ensure that you secure these endpoints with an Admin-specific AuthGuard to prevent unauthorized access.

*(Note: All endpoints are prefixed with `/api/` by default, e.g., `http://localhost:4000/api/...`)*

---

## 👑 1. Admin APIs
*Handled by `admin.controller.ts` and `notifications.controller.ts`*

### Authentication
- **POST `/admin/login`**
  - **Security:** Public
  - **Use:** Authenticates an admin using either `email/password` or an `idToken`. Returns session tokens.

### User & Expert Management
- **GET `/admin/users`**
  - **Use:** Retrieves a list of all registered clients/users.
- **POST `/admin/clients`** (Alias: `POST /admin/users`)
  - **Use:** Creates a new client profile manually from the admin dashboard.
- **GET `/admin/experts`**
  - **Use:** Retrieves a list of all registered professionals/experts.
- **POST `/admin/experts`**
  - **Use:** Registers a new expert profile into the system.

### Case & Service Management
- **GET `/admin/cases`**
  - **Use:** Fetches all ongoing and completed cases/services across the platform.
- **POST `/admin/assign-case`** (Aliases: `POST /admin/assign-service`, `POST /admin/assign`)
  - **Use:** Assigns an expert (`professional_id`) to a specific client's case.
  - **Payload:** Requires `AssignCaseDto` detailing the case and the professional.
- **POST `/admin/cases/update-stages`** (Alias: `POST /admin/update-stages`)
  - **Use:** Updates the custom stages array for a specific case (e.g., advancing a case from "Review" to "Filing").
  - **Payload:** `{ caseId: string; stages: any[]; currentStageId?: string }`

### Case Details (Chat & Documents)
- **GET `/admin/case/:id/chat`**
  - **Use:** Allows the admin to read chat messages for a specific case. Supports pagination via `?limit` and `?before` query parameters.
- **GET `/admin/case/:id/documents`**
  - **Use:** Retrieves all documents uploaded by either the client or the expert for a specific case.

### Admin Notifications
- **GET `/notifications/case/:caseId/admin`**
  - **Use:** The **Admin Inbox**. Retrieves notifications sent specifically to the admin for a case (e.g., from an expert).
- **GET `/notifications/case/:caseId/admin/sent`**
  - **Use:** The **Admin Outbox**. Retrieves a history of notifications the admin has blasted out to users/experts for a specific case.
- **POST `/notifications/case/:caseId/admin/send`**
  - **Use:** Sends a targeted message/notification from the admin to the client, the expert, or both assigned to the case.
  - **Payload:** `{ "target": "client" | "expert" | "both", "payload": { "type": "admin_message", "message": "..." } }`

### Financials
- **GET `/admin/transactions`**
  - **Use:** Retrieves all Razorpay payment records and transaction histories.

---

## 👤 2. User (Client) APIs
*Handled by `cases.controller.ts` (mapped to `/user`) and `notifications.controller.ts`*

> **Security Note:** All User endpoints require a valid Supabase `Authorization: Bearer <token>` header. The `userId` is extracted securely from the token.

### Dashboard & Services
- **GET `/user/dashboard`**
  - **Use:** Fetches the personalized dashboard data for the logged-in user, including their active cases and recent updates.
- **GET `/user/services`**
  - **Use:** Retrieves a list of all services/cases associated with the logged-in user.
- **GET `/user/services/:id`**
  - **Use:** Fetches detailed information, stages, and status of a specific case belonging to the user.
- **POST `/user/start-process`**
  - **Use:** Initiates a new service request or case.
  - **Payload:** `{ serviceCode: string, clientDetails: { fullName, email, phone }, urgency: string }`

### Documents & Notifications
- **POST `/user/cases/:id/documents`** (Alias: `POST /user/services/:id/documents`)
  - **Use:** Logs a new document upload into the database. The physical file is uploaded to Cloudinary/Storage, and this endpoint saves the metadata (`filename`, `storagePath`, `sizeBytes`) linked to the user and case.
- **GET `/notifications/case/:caseId/user`**
  - **Use:** Retrieves all alerts and messages targeted to the logged-in client for a specific case.

---

## 💼 3. Expert (Professional) APIs
*Handled by `expert.controller.ts` and `notifications.controller.ts`*

> **Security Note:** All Expert endpoints require a valid Supabase `Authorization: Bearer <token>` header (except `/login`). The `expertId` is extracted securely from the token.

### Authentication & Profile
- **POST `/expert/login`**
  - **Security:** Public
  - **Use:** Authenticates an expert via password or Supabase `idToken`. Issues session cookies and returns an access token.
- **GET `/expert/profile`**
  - **Use:** Retrieves the logged-in expert's profile data.
- **GET `/expert/dashboard`**
  - **Use:** Fetches the expert's dashboard, aggregating their active consultations, cases, and tasks.

### Cases & Consultations
- **GET `/expert/consultations`** (Alias: `GET /expert/cases`)
  - **Use:** Returns a list of all cases and meetings assigned to the logged-in expert.

### Documents & Notifications
- **POST `/expert/cases/:id/documents`** (Alias: `POST /expert/upload-document`)
  - **Use:** Registers a document uploaded by the expert to a specific case.
  - **Payload:** `{ filename: string, storagePath: string, fileType?: string, sizeBytes?: number }`
- **GET `/notifications/case/:caseId/user`**
  - **Use:** (Shared with Client logic) Retrieves notifications targeted to the logged-in expert for the specified case.
- **POST `/notifications/case/:caseId/expert/send-to-admin`**
  - **Use:** Allows the expert to send a direct message, alert, or status update directly to the Admin dashboard regarding a case.
  - **Payload:** `{ "payload": { "message": "Task complete..." } }`

---

## 🛠 Project Setup & Commands

```bash
# Install dependencies
$ npm install

# Run in development watch mode
$ npm run start:dev

# Build for production
$ npm run build
$ npm run start:prod

# Prisma Database Sync
$ npx prisma db push
$ npx prisma generate
```

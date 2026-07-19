# ZORVIK-CHAT — DEVELOPMENT RULES & ARCHITECTURE CONSTRAINTS

This document governs the design, development, and operational standards for the standalone `zorvik-chat` platform. These rules must be strictly followed without exception.

---

## 1. CODE INTEGRITY & STRICT EXPLICIT APPROVAL
- **No Direct Modification**: Do NOT write, modify, or commit any code to any repository file (including `zorvik-chat` or `Zorvik-Tech`) without explicit, documented user approval in the chat.
- **No Assumptions**: If any requirement or flow is ambiguous, stop and ask the user for confirmation. Assumptions are prohibited.
- **Standalone Development**: Focus exclusively on building `zorvik-chat` in its standalone directory. Do not perform any automatic integrations (like modifying Next.js files in `Zorvik-Tech` or backend routing in `studio-backend`) unless specifically directed and approved.

---

## 2. DATABASE ISOLATION & INDEPENDENCE
- **Complete Decoupling**: All database schemas, DDL creation scripts (`schema.sql`), triggers, functions, and seed data for the chat service must reside **strictly within the `zorvik-chat` repository** (under the `db/` folder).
- **No Shared Migrations**: Do NOT add, edit, or check in any `.sql` or migration files to the shared `zorvik-db` database repository. The chat platform database must be initialize-ready using the local `schema.sql` setup file.

---

## 3. ROLE-BASED FEATURES & CONTROL HIERARCHY
- **Superadmin Privilege (Zorvik Tech)**:
  - Feature access (e.g., enabling FAQ mode, enabling Live Chat mode, allowing human handover, enabling offline email notifications) is configured **only by the superadmin (Zorvik Tech)** per tenant.
- **Tenant Constraints (Photographer/Studio)**:
  - Tenants cannot configure these core features themselves.
  - Tenants may only manage their own FAQ content, canned reply shortcuts, and chats *within* the permissions allocated to them by the superadmin.
- **End-User (Couple/Guest)**:
  - Access is restricted to their personal conversation thread using secure HMAC-SHA256 verification keys.

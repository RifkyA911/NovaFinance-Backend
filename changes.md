# Changelog

## 2026-09-05

### Database Schema Updates
- Added `deletedBy` and `deletedReason` fields to `categories` table for soft delete tracking
- Added `deletedBy` and `deletedReason` fields to `accounts` table for soft delete tracking
- Created `collaborators` table for RBAC support with fields: id, workspaceId, userId, role, invitedBy, createdAt, updatedAt
- Generated migration files: 0003, 0004, 0005
- Applied all migrations to PostgreSQL database

### Authentication & Authorization
- Implemented custom auth functions in `src/auth/config.ts` (signUp, signIn, getSession, signOut)
- Created `src/middleware/auth.ts` with `requireAuth` and `requireWorkspaceAccess` functions
- Added role-based permission system in `src/lib/permissions.ts` with roles: owner, admin, staff, viewer

### API Routes Implemented
- **Workspaces** (`src/routes/workspaces.ts`): CRUD with collaborator support
  - POST `/api/workspaces` - Create workspace and add owner as collaborator
  - GET `/api/workspaces` - List owned and collaborated workspaces
  - GET `/api/workspaces/:id` - Get single workspace with role
  - PATCH `/api/workspaces/:id` - Update workspace
  - DELETE `/api/workspaces/:id` - Soft delete workspace
- **Categories** (`src/routes/categories.ts`): CRUD with permission checks
  - POST `/api/categories` - Create category
  - GET `/api/categories` - List categories (requires workspaceId query)
  - GET `/api/categories/:id` - Get single category
  - PATCH `/api/categories/:id` - Update category
  - DELETE `/api/categories/:id` - Soft delete category
- **Accounts** (`src/routes/accounts.ts`): CRUD with permission checks
  - POST `/api/accounts` - Create account
  - GET `/api/accounts` - List accounts (requires workspaceId query)
  - GET `/api/accounts/:id` - Get single account
  - PATCH `/api/accounts/:id` - Update account
  - DELETE `/api/accounts/:id` - Soft delete account
- **Transactions** (`src/routes/transactions.ts`): CRUD with permission checks
  - POST `/api/transactions` - Create transaction
  - GET `/api/transactions` - List transactions (workspaceId query now optional for better error handling)
  - GET `/api/transactions/:id` - Get single transaction
  - PATCH `/api/transactions/:id` - Update transaction
  - DELETE `/api/transactions/:id` - Soft delete transaction
- **Invoices** (`src/routes/invoices.ts`): CRUD with permission checks
  - POST `/api/invoices` - Create invoice
  - GET `/api/invoices` - List invoices (requires workspaceId query)
  - GET `/api/invoices/:id` - Get single invoice
  - PATCH `/api/invoices/:id` - Update invoice
  - DELETE `/api/invoices/:id` - Soft delete invoice

### Main App Updates
- Updated `src/index.ts` to include all new route modules
- Integrated auth, workspace, category, account, transaction, and invoice routes

### Database Seeding
- Created `src/seed.ts` for database seeding
- Added `seed` script to package.json
- Seeder creates: test user, workspace, collaborator entry, categories, account, transactions, and invoice
- Seeder handles existing data gracefully (checks before inserting)

### Bug Fixes
- Fixed `/api/transactions` GET endpoint to make workspaceId query parameter optional for better error handling
- **Fixed session persistence issue**:
  - Updated auth routes to set httpOnly cookies on sign-in and sign-up
  - Updated middleware to check for session cookies in addition to Authorization header
  - Updated sign-out to clear cookies
  - Session now persists across page reloads
- **Fixed frontend API client authentication**:
  - Added `credentials: 'include'` to fetch requests in `novajournal-fe/app/lib/api.ts`
  - This enables session cookies to be sent with API requests
- Updated changes.md to track all modifications

### Documentation
- Created `pages/dashboard.md` with dashboard requirements and implementation plan
- Documented required backend API endpoints for dashboard
- Identified issues with current dashboard implementation

### Dashboard API Endpoints
- Created `src/routes/dashboard.ts` with 4 new endpoints:
  - `GET /api/dashboard/summary` - Total balance, monthly income/expense, savings rate
  - `GET /api/dashboard/trends` - Monthly income vs expense trends (configurable months)
  - `GET /api/dashboard/categories` - Spending breakdown by category
  - `GET /api/dashboard/accounts` - Account distribution by type
- Integrated dashboard routes into main app (`src/index.ts`)
- All dashboard endpoints include authentication and workspace permission checks

### Backend Enhancements
- Updated transactions GET endpoint to include category and account details via JOIN queries
- Added `limit` query parameter for transactions listing
- Added `desc` import for ordering transactions by date
- Transactions now return nested category and account objects with relevant details

### Frontend Fixes
- Fixed AuthContext cookie name from `session_token` to `session` to match backend expectation
- Added `credentials: 'include'` to login and register fetch requests to receive cookies
- Added WorkspaceContext for workspace state management
- Added WorkspaceProvider to protected layout
- Updated API client with dashboard methods and workspaceId parameters
- Updated dashboard page to fetch real data from API with workspace context
- Added loading states and workspace selection handling
- Stats cards now display real data from API

### Docker/Podman Configuration
- Added volume mappings to docker-compose.yml for hot reload:
  - Frontend: `./novajournal-fe:/app` with node_modules and .next excluded
  - Backend: `./novajournal-be:/app` with node_modules excluded
- podman-compose.dev.yml already had volume mappings configured
- Rebuilt and restarted containers with podman compose

### Frontend Enhancements
- Added workspace selector dropdown to Sidebar
- Users can now switch between workspaces from the sidebar
- WorkspaceContext now includes error handling for invalid API responses
- Auto-selects first workspace when workspaces are loaded

### UI/UX Improvements
- Created new Navbar component with workspace selector at top
- Moved workspace selector from Sidebar to Navbar for better UX
- Added cursor-pointer and hover effects to sidebar menu items
- Added scale animation on hover for sidebar menu items
- Added shadow effect to active sidebar menu item
- Improved sidebar navigation with transition-all duration-200
- Updated layout to include Navbar above Sidebar
- Fixed dashboard text that was corrupted with "xxxx" prefixes

### Debugging
- Added logging to auth middleware to debug cookie issues
- Added error handling to API client for backend error responses
- Backend now logs when auth fails with detailed header info

### Testing
- Created `src/test-workspaces.ts` to test workspace API
- All workspace API tests passed successfully
- Database seeder executed successfully

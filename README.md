# NovaFinance Backend

Personal finance tracking API built with Elysia, Bun, Drizzle ORM, PostgreSQL, Redis, and MinIO.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: PostgreSQL 14 with Drizzle ORM
- **Cache**: Redis 7
- **Storage**: MinIO / Cloudflare R2 (S3-compatible) with **8GB Hard Quota Guard** (`checkStorageQuotaGuard`)
- **Message Broker**: RabbitMQ 3.x with automatic background worker consumers
- **Vector Search**: PostgreSQL `pgvector` with 768-dim embeddings & HNSW indexing
- **Authentication**: BetterAuth
- **AI**: Google Gemini API, OpenAI, Groq, DeepSeek, Anthropic Claude
- **API Documentation**: Swagger/OpenAPI (`/swagger`)

## Project Structure

```
novajournal-be/
├── src/
│   ├── auth/              # Authentication configuration
│   ├── db/                # Database schema
│   ├── middleware/        # Custom middleware
│   ├── routes/            # API route handlers
│   │   ├── auth.ts        # Authentication endpoints
│   │   ├── workspaces.ts  # Workspace management
│   │   ├── categories.ts  # Category management
│   │   ├── accounts.ts    # Account management
│   │   ├── transactions.ts # Transaction management
│   │   ├── invoices.ts    # Invoice management
│   │   ├── dashboard.ts   # Dashboard analytics
│   │   └── ai.ts          # AI-powered features
│   ├── services/          # External service integrations
│   ├── index.ts           # Application entry point
│   └── seed.ts            # Database seeding
├── Dockerfile
└── package.json
```

## Running the Application

### Using Podman Compose (Development)

```bash
# Start services
podman compose -f podman-compose.dev.yml up -d

# View logs
podman logs novajournal-be-1 --tail 50 -f

# Stop services
podman compose -f podman-compose.dev.yml down
```

### Local Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Run database migrations
bun run db:push

# Seed database
bun run seed

# Run linting
bun run lint

# Run type checking
bun run type-check
```

## API Documentation

Access the interactive Swagger documentation at `http://localhost:8080/swagger`

### Authentication

All API endpoints (except sign-in and sign-up) require authentication via Bearer token in the Authorization header.

**Dummy Accounts for Testing:**
- admin@example.com / admin123 (Owner role)
- test@example.com / password123 (Owner role)
- user@example.com / password123 (Admin role)
- staff@example.com / staff123 (Staff role)

### API Endpoints

#### Authentication
- `POST /api/auth/sign-in` - Sign in with email and password
- `POST /api/auth/sign-up` - Create new user account
- `POST /api/auth/sign-out` - End user session
- `GET /api/auth/session` - Get current user session

#### Workspaces
- `POST /api/workspaces` - Create new workspace
- `GET /api/workspaces` - List user workspaces
- `GET /api/workspaces/:id` - Get workspace by ID
- `PATCH /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace

#### Categories
- `POST /api/categories` - Create category
- `GET /api/categories` - List categories
- `GET /api/categories/:id` - Get category by ID
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

#### Accounts
- `POST /api/accounts` - Create account
- `GET /api/accounts` - List accounts
- `GET /api/accounts/:id` - Get account by ID
- `PATCH /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

#### Transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions` - List transactions
- `GET /api/transactions/:id` - Get transaction by ID
- `PATCH /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

#### Invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices` - List invoices
- `GET /api/invoices/:id` - Get invoice by ID
- `PATCH /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice

#### Goals
- `POST /api/goals` - Create financial goal or wishlist item
- `GET /api/goals` - List goals with filters (workspaceId, status, priority, category)
- `GET /api/goals/analytics` - Get aggregated completion rates, category diversification, and monthly savings velocity
- `GET /api/goals/:id` - Get single goal details
- `PATCH /api/goals/:id` - Update goal
- `POST /api/goals/:id/deposit` - Deposit funds to goal (atomic balance addition)
- `PUT /api/goals/reorder` - Batch reorder goals for Drag & Drop priority boards
- `DELETE /api/goals/:id` - Soft delete goal

#### Dashboard
- `GET /api/dashboard/summary` - Get financial summary
- `GET /api/dashboard/trends` - Get income/expense trends
- `GET /api/dashboard/categories` - Get category breakdown
- `GET /api/dashboard/accounts` - Get account balances

#### Documents
- `POST /api/documents/upload` - Upload document with AI analysis
- `GET /api/documents/list/:workspaceId` - List documents in workspace
- `GET /api/documents/download/:key` - Download document from storage
- `DELETE /api/documents/:key` - Delete document
- `PATCH /api/documents/:id` - Link document to transaction

#### AI
- `POST /api/ai/suggestion` - Get AI financial suggestions

## Database Schema

### Tables

#### users
User accounts with authentication data

#### workspaces
Financial workspaces for organizing data

#### workspace_users
Workspace membership with role-based access control (RBAC)

#### categories
Transaction categories (income/expense)

#### accounts
Financial accounts (bank, cash, e-wallet, credit)

#### transactions
Transaction records with metadata

#### invoices
Invoice management

#### goals
Financial targets & wishlist items with priority, order, target date, planned savings velocity, and status

#### liabilities
Capital loans, KPR, business loans, credit cards, amortization schedules, APR, and payoff terms

#### documents
Document storage with Gemini AI analysis metadata

### Role-Based Access Control (RBAC)

- **Owner**: Full access to all workspace resources
- **Admin**: Can manage most resources except workspace deletion
- **Staff**: Can create and manage transactions
- **Member**: Read-only access to workspace data

## Environment Variables

```env
DATABASE_URL=postgres://postgres:postgres@db:5432/novajournal
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
```

## Services

### Redis
Used for caching session data and API responses to improve performance.

### MinIO
S3-compatible object storage for:
- Document uploads (receipts, invoices)
- User-uploaded images
- Transaction attachments

### Google Gemini AI
AI-powered features for:
- Document analysis and metadata extraction
- Financial suggestions and recommendations
- Spending pattern analysis

## Development Workflow

1. **Always use Podman Compose for development** - Never run `bun run dev` locally
2. **Check logs after changes**: `podman logs novajournal-be-1 --tail 50 -f`
3. **Run linting**: `bun run lint` before committing
4. **Run type checking**: `bun run type-check` to catch type errors
5. **Test database**: `bun run test:db`
6. **Test Redis**: `bun run test:redis`
7. **Test MinIO**: `bun run test:minio`

## Common Issues

### Database Connection Issues
- Check if PostgreSQL container is running: `podman logs novajournal-db-1`
- Verify DATABASE_URL in environment variables
- Ensure database migrations are applied: `bun run db:push`

### Redis Connection Issues
- Check if Redis container is running: `podman logs novajournal-redis-1`
- Verify REDIS_URL in environment variables
- Test connection: `bun run test:redis`

### MinIO Connection Issues
- Check if MinIO container is running: `podman logs novajournal-minio-1`
- Verify MinIO credentials in environment variables
- Test connection: `bun run test:minio`

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Error Codes
- `UNAUTHORIZED` - Authentication failed or missing
- `FORBIDDEN` - User lacks permission for the resource
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Server error
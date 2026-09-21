import { sql } from 'drizzle-orm';
import { db } from '../auth/config';

export async function initVectorTables() {
  console.log('⚡ Initializing pgvector tables and HNSW indexes...');
  
  // 1. Ensure extension is loaded
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

  // 2. Create transaction_embeddings table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS transaction_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      embedding vector(768),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 3. Create HNSW Index for transaction_embeddings
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS transaction_embeddings_hnsw_idx 
    ON transaction_embeddings USING hnsw (embedding vector_cosine_ops);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS transaction_embeddings_ws_idx 
    ON transaction_embeddings (workspace_id);
  `);

  // 4. Create document_embeddings table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      embedding vector(768),
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // 5. Create HNSW Index for document_embeddings
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS document_embeddings_hnsw_idx 
    ON document_embeddings USING hnsw (embedding vector_cosine_ops);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS document_embeddings_ws_idx 
    ON document_embeddings (workspace_id);
  `);

  // 6. Ensure unique constraints for upserts
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transaction_embeddings_tx_unique'
      ) THEN
        ALTER TABLE transaction_embeddings ADD CONSTRAINT transaction_embeddings_tx_unique UNIQUE (transaction_id);
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'document_embeddings_doc_unique'
      ) THEN
        ALTER TABLE document_embeddings ADD CONSTRAINT document_embeddings_doc_unique UNIQUE (document_id);
      END IF;
    END $$;
  `);

  console.log('✅ pgvector tables, HNSW indexes & unique constraints successfully created!');
}

if (import.meta.main) {
  initVectorTables()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to init vector tables:', err);
      process.exit(1);
    });
}

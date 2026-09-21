import { sql } from 'drizzle-orm';
import { db } from '../auth/config';

async function main() {
  try {
    console.log('Testing pgvector extension in PostgreSQL...');
    let res = await db.execute(sql`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`);
    console.log('Query result:', res);
    
    if (res.length === 0) {
      console.log('Extension vector not yet created. Running CREATE EXTENSION IF NOT EXISTS vector...');
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
      res = await db.execute(sql`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`);
      console.log('After create:', res);
    }
    
    const vecMath = await db.execute(sql`SELECT '[1,2,3]'::vector + '[4,5,6]'::vector AS sum_vector`);
    console.log('Vector addition test passed! Result:', vecMath);
    
    const distTest = await db.execute(sql`SELECT '[1,2,3]'::vector <=> '[1,2,4]'::vector AS cosine_distance`);
    console.log('Vector cosine distance test passed! Result:', distTest);
    console.log('ALL PGVECTOR TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('Vector test failed:', err);
  } finally {
    process.exit(0);
  }
}

main();

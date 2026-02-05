import { createRawConnection } from '../src/db';

async function reset() {
  const connection = await createRawConnection();
  
  console.log('Dropping nfl_embeddings table...');
  await connection.execute('DROP TABLE IF EXISTS nfl_embeddings');
  console.log('✓ Table dropped');
  
  console.log('\nRecreating table with VECTOR type...');
  await connection.execute(`
    CREATE TABLE nfl_embeddings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_name VARCHAR(255) NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding VECTOR(1024) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_team_name (team_name)
    )
  `);
  console.log('✓ Table created');
  
  await connection.end();
  console.log('\nDone! Run npm run db:load to populate data.');
  process.exit(0);
}

reset().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});

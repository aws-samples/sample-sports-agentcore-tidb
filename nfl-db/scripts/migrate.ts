import { createRawConnection } from '../src/db';

async function migrate() {
  const connection = await createRawConnection();
  
  console.log('Running migrations...');
  
  // Create nfl_embeddings table with TiDB VECTOR type
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS nfl_embeddings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_name VARCHAR(255) NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding VECTOR(1024) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_team_name (team_name)
    )
  `);
  
  console.log('✓ nfl_embeddings table created');
  
  await connection.end();
  console.log('\nMigrations complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

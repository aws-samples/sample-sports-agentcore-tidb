# Sports Database Package

A TiDB-powered vector database for sports playoff data, player stats, and injuries. Uses Amazon Bedrock for embeddings and supports RAG (Retrieval Augmented Generation) queries.

## Data Files

- `data/nfl_playoffs_2026_full.json` - Complete 2025-26 playoff bracket, results, and matchups
- `data/nfl_player_stats_2026.json` - Player statistics with playoff performance
- `data/nfl_injuries_2026.json` - Injury reports and status updates
- `data/nfl_teams.csv` - Base team information

## Scripts

### Database Management
- `npm run reset` - Drop and recreate the database table
- `npm run load:playoffs` - Load all playoff data, player stats, and injuries into TiDB
- `npm run load` - Load base team embeddings from CSV

### Agent & Search
- `npm run agent` - Run the sports agent with Strands SDK
- `npm run search` - Run vector similarity search
- `npm run rag` - Run RAG queries against the database

### Development
- `npm run dev` - Run agent in watch mode
- `npm run build` - Build for production
- `npm run start` - Run production build

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
TIDB_HOST=your-tidb-host
TIDB_PORT=4000
TIDB_USERNAME=your-username
TIDB_PASSWORD=your-password
TIDB_DATABASE=test
AWS_BEARER_TOKEN_BEDROCK=your-bedrock-token
```

## Current Playoff Status

Update this section with your own playoff data after loading.

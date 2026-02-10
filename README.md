# Sports Agent on Amazon Bedrock AgentCore

A sports analytics agent deployed on Amazon Bedrock AgentCore Runtime. Uses TiDB for vector search (RAG - Retrieval-Augmented Generation), APIs for live stats, and Claude for analysis.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  AgentCore      │────▶│   Agent          │────▶│  TiDB       │
│  Runtime        │     │  (Container)     │     │  (Vector DB)│
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                      │
        │                      ▼
        │               ┌─────────────┐
        │               │  APIs       │
        │               │             │
        │               └─────────────┘
        ▼
┌─────────────────┐
│  AgentCore      │
│  Memory         │
└─────────────────┘
```

## Project Structure

- `nfl-db/` - Agent code, tools, and database schema
- `infra/` - CDK infrastructure (ECR, AgentCore Runtime, Memory, Secrets Manager)

## Prerequisites

- AWS CLI configured with credentials
- Node.js 20+
- Docker
- TiDB Cloud account (or compatible MySQL with vector support)
- Amazon Bedrock access (for embeddings via Titan)

## Setup

### 1. Install dependencies

```bash
cd infra && npm install
cd ../nfl-db && npm install
```

### 2. Configure local environment

```bash
cd nfl-db
cp .env.example .env
# Edit .env with your TiDB credentials
```

### 3. Initialize the database

Run migrations to create tables:
```bash
cd nfl-db
npx tsx scripts/migrate.ts
```

### 4. Create your Sports data files

You must create your own sports JSON data files in `nfl-db/data/`. The load script expects:

- `nfl_playoffs_2026_full.json` - Playoff bracket, matchups, odds, storylines
- `nfl_player_stats_2026.json` - Player statistics
- `nfl_injuries_2026.json` - Team injury reports

See `nfl-db/data/` for example file formats.

### 5. Load data into TiDB

Load the sports knowledge base for RAG (uses AWS SDK with default credential chain):
```bash
cd nfl-db

# Ensure AWS credentials are configured (via aws configure, IAM role, or env vars)
export AWS_REGION=us-east-1

# Load playoff data (matchups, injuries, odds)
npx tsx scripts/load_playoffs.ts
```

### 5. Deploy infrastructure

```bash
cd infra
AWS_REGION=us-east-1 npx cdk deploy AgentCoreStack
```

This creates:
- ECR repository (`nfl-agent`)
- AgentCore Runtime (`nfl_agent`)
- AgentCore Memory with LTM strategies (summarization, semantic, user preferences)
- Secrets Manager secret (`nfl-agent/credentials`)
- IAM role with Bedrock and Memory permissions

### 6. Configure secrets

The secret is created empty during deployment. Populate it with your TiDB credentials:
```bash
aws secretsmanager put-secret-value \
  --region us-east-1 \
  --secret-id nfl-agent/credentials \
  --secret-string '{"TIDB_HOST":"your-host","TIDB_PORT":"4000","TIDB_USERNAME":"your-user","TIDB_PASSWORD":"your-password","TIDB_DATABASE":"test"}'
```

### 7. Build and push Docker image

```bash
cd nfl-db
AWS_REGION=us-east-1 ./scripts/deploy-ecr.sh
```

Or with a version tag:
```bash
AWS_REGION=us-east-1 ./scripts/deploy-ecr.sh v1.0.0
```

### 8. Test the deployment

Get the runtime ARN:
```bash
aws cloudformation describe-stacks \
  --stack-name AgentCoreStack \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='AgentRuntimeArn'].OutputValue" \
  --output text
```

Invoke the agent:
```bash
cd nfl-db
export AWS_REGION=us-east-1
export AGENT_RUNTIME_ARN="arn:aws:bedrock-agentcore:us-east-1:ACCOUNT:runtime/nfl_agent-XXXXX"

# Standard invocation
npx tsx scripts/test-agentcore.ts "Who will win the championship?"

# Streaming invocation (real-time output)
npx tsx scripts/test-agentcore-stream.ts "Who will win the championship?"
```

## Local Development

### Run the agent locally

```bash
cd nfl-db
npx tsx src/server.ts
```

### Test locally

```bash
# Standard response
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Compare Team A and Team B"}'

# Streaming response (SSE)
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Compare Team A and Team B", "stream": true}'

# With debug info
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Who is injured on Team B?", "debug": true}'
```

## Data Loading

The agent uses TiDB for vector search (RAG). Data must be loaded before the agent can answer questions.

### Required data files (create your own)

You must create your own sports JSON data files. The load script expects these files in `nfl-db/data/`:

| File | Description |
|------|-------------|
| `nfl_playoffs_2026_full.json` | Full playoff data with matchups, injuries, odds, storylines |
| `nfl_player_stats_2026.json` | Player statistics |
| `nfl_injuries_2026.json` | Team injury reports |

### Expected JSON structures

**nfl_playoffs_2026_full.json**
```json
{
  "season": "2025-26",
  "super_bowl": { "name": "Championship Game", "date": "Feb 9, 2026", "location": "Stadium Name" },
  "schedule": { "wild_card": "Jan 11-12", "divisional": "Jan 18-19", "conference_championships": "Jan 26" },
  "afc_bracket": {
    "1_seed": { "team": "Team A", "status": "Bye", "key_players": ["Player 1", "Player 2"], "notes": "..." }
  },
  "nfc_bracket": { ... },
  "wild_card_results": [
    { "game": "Team C vs Team D", "date": "Jan 12", "network": "CBS", "winner": "Team C", "summary": "...", "key_plays": ["..."] }
  ],
  "divisional_results": [
    { "game": "...", "date": "...", "network": "...", "winner": "...", "summary": "...", "key_stats": { "Player": "stats" } }
  ],
  "conference_championship_matchups": [
    { "game": "...", "conference": "AFC", "date": "...", "network": "...", "away": "...", "home": "...", "storyline": "...", "key_matchup": "..." }
  ],
  "key_performers_divisional": [
    { "player": "...", "team": "...", "stats": "...", "note": "..." }
  ],
  "storylines": ["..."]
}
```

**nfl_player_stats_2026.json** (array)
```json
[
  {
    "name": "Player Name",
    "team": "Team A",
    "position": "QB",
    "category": "Passing",
    "stats": "4,183 yards, 26 TD, 11 INT",
    "playoff_stats": "2 games, 587 yards, 4 TD",
    "status": "Healthy"
  }
]
```

**nfl_injuries_2026.json**
```json
{
  "season_ending_injuries": [
    { "player": "...", "team": "...", "position": "...", "injury": "ACL tear", "date": "...", "details": "...", "return_timeline": "..." }
  ],
  "playoff_game_injuries": {
    "divisional_round": [
      { "player": "...", "team": "...", "injury": "...", "details": "..." }
    ]
  },
  "conference_championship_watch_list": [
    { "player": "...", "team": "...", "status": "Questionable", "injury": "...", "notes": "..." }
  ]
}
```

### Load scripts

```bash
cd nfl-db

# Load playoff data (matchups, injuries, odds) - requires AWS credentials
export AWS_REGION=us-east-1
npx tsx scripts/load_playoffs.ts

# Reset database (drops and recreates tables)
npx tsx scripts/db-reset.ts
```

## Agent Tools

| Tool | Description |
|------|-------------|
| `rag_search` | Vector search over sports knowledge base (TiDB) |
| `espn_player_stats` | Live player statistics from ESPN API |
| `espn_matchup` | Current matchup details and betting odds |
| `wikipedia_search` | Background info on players/teams |
| `team_comparison` | Head-to-head team statistical comparison |

## Updating the Agent

1. Make code changes in `nfl-db/`
2. Rebuild and push: `cd nfl-db && AWS_REGION=us-east-1 ./scripts/deploy-ecr.sh`
3. AgentCore picks up the new `latest` image on next invocation

## Logs

View runtime logs:
```bash
# Find log group name
aws logs describe-log-groups \
  --region us-east-1 \
  --log-group-name-prefix "/aws/bedrock-agentcore/runtimes/nfl_agent"

# Tail logs
aws logs tail "/aws/bedrock-agentcore/runtimes/nfl_agent-XXXXX-DEFAULT" \
  --region us-east-1 --follow

# Recent logs (last 30 min)
aws logs tail "/aws/bedrock-agentcore/runtimes/nfl_agent-XXXXX-DEFAULT" \
  --region us-east-1 --since 30m
```


## Cleanup

```bash
cd infra
npx cdk destroy AgentCoreStack
```

Note: ECR repository has `RETAIN` policy - delete manually if needed:
```bash
aws ecr delete-repository --repository-name nfl-agent --region us-east-1 --force
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
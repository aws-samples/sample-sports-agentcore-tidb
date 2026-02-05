# Tech Stack

## Languages & Runtime

- TypeScript (ES2022 target)
- Node.js 20+
- ESM modules throughout

## Agent Framework

- Strands Agents SDK (`@strands-agents/sdk`) - tool definitions and agent orchestration
- Zod for input schema validation
- Hono web framework for HTTP server

## Database

- TiDB Cloud (MySQL-compatible with vector support)
- Drizzle ORM for schema and queries
- Custom vector type for embeddings (1024 dimensions)
- Amazon Bedrock Titan for embeddings

## Infrastructure

- AWS CDK (TypeScript) for IaC
- AWS Bedrock AgentCore Runtime (container deployment)
- AWS Bedrock AgentCore Memory (conversation history)
- ECR for container registry
- Secrets Manager for credentials

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@strands-agents/sdk` | Agent framework |
| `@aws-sdk/client-bedrock-*` | Bedrock APIs |
| `drizzle-orm` | Database ORM |
| `hono` | HTTP server |
| `zod` | Schema validation |

## Common Commands

### nfl-db (Agent Package)

```bash
cd nfl-db

# Development
npm run dev          # Run agent with hot reload
npm run agent        # Run agent server

# Database
npm run migrate      # Run migrations
npm run reset        # Drop and recreate tables
npm run load:playoffs # Load playoff data

# Build
npm run build        # Build with tsup
npm run start        # Run production build
```

### infra (CDK Package)

```bash
cd infra

# Development
npm run build        # Compile TypeScript
npm run watch        # Watch mode
npm run test         # Run Jest tests

# Deployment
npx cdk synth        # Synthesize CloudFormation
npx cdk diff         # Compare with deployed
npx cdk deploy       # Deploy stack
npx cdk destroy      # Tear down stack
```

### Docker Deployment

```bash
cd nfl-db
AWS_REGION=us-east-1 ./scripts/deploy-ecr.sh [version-tag]
```

## Environment Variables

Required in `nfl-db/.env`:
- `TIDB_HOST`, `TIDB_PORT`, `TIDB_USERNAME`, `TIDB_PASSWORD`, `TIDB_DATABASE`
- `AWS_REGION` (for Bedrock embeddings)

Production uses `SECRETS_ARN` to fetch from Secrets Manager.

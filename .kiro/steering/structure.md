# Project Structure

```
/
├── nfl-db/                    # Agent application package
│   ├── src/
│   │   ├── server.ts          # Hono HTTP server, agent setup
│   │   ├── db.ts              # Database connection (TiDB)
│   │   ├── schema.ts          # Drizzle schema (nfl_embeddings table)
│   │   ├── memory.ts          # AgentCore Memory integration
│   │   ├── types.ts           # TypeScript interfaces
│   │   └── tools/             # Agent tools
│   │       ├── index.ts       # Tool exports
│   │       ├── rag-search.ts  # Vector search over knowledge base
│   │       ├── espn-player-stats.ts
│   │       ├── espn-matchup.ts
│   │       ├── wikipedia-search.ts
│   │       ├── team-comparison.ts
│   │       ├── embedding.ts   # Bedrock Titan embeddings
│   │       └── debug.ts       # Debug logging utility
│   ├── scripts/               # CLI utilities
│   │   ├── migrate.ts         # Database migrations
│   │   ├── db-reset.ts        # Reset database
│   │   ├── load_playoffs.ts   # Load playoff data
│   │   ├── deploy-ecr.sh      # Docker build & push
│   │   └── test-agentcore.ts  # Test deployed agent
│   ├── data/                  # JSON/CSV data files
│   └── Dockerfile             # Container image
│
├── infra/                     # AWS CDK infrastructure
│   ├── bin/                   # CDK app entry point
│   ├── lib/
│   │   └── infra-stack.ts     # Main stack (ECR, AgentCore, Memory, Secrets)
│   └── test/                  # CDK tests
│
└── .kiro/
    └── steering/              # AI assistant guidance
```

## Key Patterns

### Tool Definition

Tools use Strands SDK pattern with Zod schemas:

```typescript
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';

export const myTool = tool({
  name: 'tool_name',
  description: 'What the tool does',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  callback: async (input) => {
    // Implementation
    return 'result string';
  },
});
```

### Database Access

- Use `initDb()` at startup for connection pool
- Use `getDb()` for Drizzle queries
- Use `createRawConnection()` for raw SQL (vector operations)

### CDK Constructs

Infrastructure uses AWS CDK L2 constructs:
- `agentcore.Runtime` - AgentCore deployment
- `agentcore.Memory` - Conversation memory
- Standard CDK for ECR, Secrets Manager, IAM

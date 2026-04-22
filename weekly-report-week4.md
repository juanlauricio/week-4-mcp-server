# Week 4 Weekly Report — MCP Server Development & Deployment

**Participant:** Juan Miguel Lauricio
**Program:** AI Agent Developer Workshop
**Week:** 4 — MCP Server Development & Deployment
**Date Submitted:** April 2026

---

## Overview

Week 4 focused on building and deploying a custom Model Context Protocol (MCP) server that exposes the Person App database operations as AI-callable tools. Using the official `@modelcontextprotocol/sdk`, the server implements five CRUD tools over a Streamable HTTP transport, enabling AI agents such as GitHub Copilot or Claude Desktop to create, read, update, and delete Person records through natural language instructions.

---

## Objectives

- Understand MCP protocol architecture and the tool registration pattern
- Build a custom MCP server using `@modelcontextprotocol/sdk` v1.x
- Expose all five Person CRUD operations as typed MCP tools with Zod validation
- Use the modern `StreamableHTTPServerTransport` (stateless HTTP mode)
- Connect the MCP server to the existing Neon PostgreSQL database via Prisma
- Verify the server locally and push to a public GitHub repository

---

## Technical Stack

| Technology | Version | Purpose |
|---|---|---|
| @modelcontextprotocol/sdk | 1.11.0 | MCP server framework |
| Express | 5.x | HTTP server for MCP transport |
| Zod | 3.x | Tool parameter schema validation |
| Prisma ORM | 7.7.0 | Type-safe database access |
| @prisma/adapter-pg | 7.7.0 | PostgreSQL driver adapter |
| Neon PostgreSQL | — | Shared cloud database (same as Week 3) |
| TypeScript | 5.x | Type-safe development |

---

## Implementation Details

### Project Structure

```
week-4-mcp-server/
├── src/
│   ├── index.ts          # Express server + MCP endpoint
│   └── lib/
│       └── prisma.ts     # Prisma singleton with PrismaPg adapter
├── prisma/
│   └── schema.prisma     # Person model (same schema as Week 3)
├── prisma.config.ts      # Prisma v7 datasource config
├── package.json
└── tsconfig.json
```

### MCP Tools Registered

| Tool Name | Description |
|---|---|
| `list_persons` | List all persons ordered by most recently created |
| `get_person` | Retrieve a single person by their CUID |
| `create_person` | Create a new person with full field validation |
| `update_person` | Update specific fields of an existing person |
| `delete_person` | Permanently delete a person by ID |

### Server Architecture

The MCP server uses the `McpServer` class from the SDK with `StreamableHTTPServerTransport` in stateless mode. A new transport and server instance are created per request, which avoids session state issues in serverless or edge environments:

```typescript
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  const server = buildMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

### Tool Registration with Zod Validation

Tools are registered with strongly-typed Zod schemas so the AI agent receives clear parameter descriptions:

```typescript
server.tool(
  "create_person",
  "Create a new person record in the database.",
  {
    firstName: z.string().describe("First name (required)."),
    lastName: z.string().describe("Last name (required)."),
    email: z.string().email().describe("Email address — must be unique (required)."),
    phone: z.string().optional(),
    // ... additional optional fields
  },
  async (args) => {
    const person = await prisma.person.create({ data: args });
    return { content: [{ type: "text", text: JSON.stringify(person) }] };
  }
);
```

### Health Check Endpoint

A `GET /health` endpoint confirms the server is running and returns version metadata — useful for monitoring and uptime checks.

---

## Challenges and Solutions

**Challenge 1: Choosing the right transport**
The SDK offers two transports: `SSEServerTransport` (deprecated) and `StreamableHTTPServerTransport` (recommended). The Streamable HTTP transport was selected for its stateless design, which is better suited for deployed/cloud environments.

**Challenge 2: Prisma v7 import paths in ESM**
The project uses `"type": "module"` in `package.json` with `NodeNext` module resolution. This required using explicit `.js` extension in import paths (e.g. `"../generated/prisma/client.js"`) even though the source files are TypeScript — a requirement of Node.js ESM.

**Challenge 3: Generated Prisma client in git**
The initial commit accidentally included the generated `src/generated/prisma/` files. These were removed with `git rm --cached` and added to `.gitignore`. The `build` workflow runs `prisma generate` before starting the server.

---

## Results

- **TypeScript check:** ✓ No errors (`tsc --noEmit`)
- **Build:** ✓ Compiled to `dist/` successfully
- **Local test:** ✓ Server running on `http://localhost:3001`
- **Health check:** ✓ `GET /health` returns `{ status: "ok", server: "person-app-mcp", version: "1.0.0" }`
- **Git commits:** 2 commits on `main` branch
- **GitHub Repository:** https://github.com/juanlauricio/week-4-mcp-server

---

## Skills Demonstrated

- MCP protocol architecture and tool registration pattern
- `@modelcontextprotocol/sdk` McpServer and StreamableHTTPServerTransport
- Zod schema validation for AI tool parameters
- Node.js ESM module system with TypeScript
- Prisma v7 driver adapter pattern in a standalone Node.js app
- Git workflow: removing accidentally committed files with `git rm --cached`

---

## Reflection

Week 4 brought together everything from the first three weeks into a cohesive AI agent integration. Building an MCP server is the bridge between traditional web applications and AI agents — it transforms the Person App's database into a set of natural-language-accessible operations that any MCP-compatible AI client can invoke.

The most interesting conceptual shift is that MCP tools are not APIs for humans — they are APIs designed specifically for AI agents. This means the tool names, descriptions, and parameter documentation need to be written as instructions to a language model rather than to a developer. Getting the Zod descriptions right was as important as writing the actual handler logic.

The stateless Streamable HTTP transport was the right choice for a production-deployable server. Unlike the SSE transport which holds a persistent connection, each request is fully independent — making it compatible with serverless deployment platforms like Vercel or Railway.

---

## Next Steps (Week 5+)

- Join team for Digital Twin II project
- Set up shared GitHub repository and write PRD
- Begin spec-driven design with Design.md
- Integrate MCP server into the team project architecture

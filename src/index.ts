import "dotenv/config";
import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Helper: create a fresh McpServer with all Person CRUD tools registered
// ---------------------------------------------------------------------------
function buildMcpServer() {
  const server = new McpServer({
    name: "person-app-mcp",
    version: "1.0.0",
  });

  // ── LIST ALL PERSONS ──────────────────────────────────────────────────────
  server.tool(
    "list_persons",
    "List all persons stored in the Person App database, ordered by most recently created.",
    {},
    async () => {
      const persons = await prisma.person.findMany({
        orderBy: { createdAt: "desc" },
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(persons, null, 2),
          },
        ],
      };
    }
  );

  // ── GET SINGLE PERSON ─────────────────────────────────────────────────────
  server.tool(
    "get_person",
    "Get a single person by their ID.",
    { id: z.string().describe("The CUID of the person to retrieve.") },
    async ({ id }) => {
      const person = await prisma.person.findUnique({ where: { id } });
      if (!person) {
        return {
          content: [{ type: "text", text: `Person with id "${id}" not found.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(person, null, 2) }],
      };
    }
  );

  // ── CREATE PERSON ─────────────────────────────────────────────────────────
  server.tool(
    "create_person",
    "Create a new person record in the database.",
    {
      firstName: z.string().describe("First name (required)."),
      lastName: z.string().describe("Last name (required)."),
      email: z.string().email().describe("Email address — must be unique (required)."),
      phone: z.string().optional().describe("Phone number."),
      address: z.string().optional().describe("Street address."),
      city: z.string().optional().describe("City."),
      country: z.string().optional().describe("Country."),
      bio: z.string().optional().describe("Short biography."),
      website: z.string().url().optional().describe("Personal or professional website URL."),
      company: z.string().optional().describe("Company or organisation name."),
    },
    async (args) => {
      try {
        const person = await prisma.person.create({ data: args });
        return {
          content: [
            {
              type: "text",
              text: `Person created successfully.\n${JSON.stringify(person, null, 2)}`,
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to create person: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── UPDATE PERSON ─────────────────────────────────────────────────────────
  server.tool(
    "update_person",
    "Update an existing person record by ID. Only provide the fields you want to change.",
    {
      id: z.string().describe("The CUID of the person to update."),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      country: z.string().optional().nullable(),
      bio: z.string().optional().nullable(),
      website: z.string().url().optional().nullable(),
      company: z.string().optional().nullable(),
    },
    async ({ id, ...data }) => {
      try {
        const person = await prisma.person.update({ where: { id }, data });
        return {
          content: [
            {
              type: "text",
              text: `Person updated successfully.\n${JSON.stringify(person, null, 2)}`,
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to update person: ${message}` }],
          isError: true,
        };
      }
    }
  );

  // ── DELETE PERSON ─────────────────────────────────────────────────────────
  server.tool(
    "delete_person",
    "Permanently delete a person record by ID.",
    { id: z.string().describe("The CUID of the person to delete.") },
    async ({ id }) => {
      try {
        await prisma.person.delete({ where: { id } });
        return {
          content: [{ type: "text", text: `Person with id "${id}" deleted successfully.` }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Failed to delete person: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// HTTP endpoint — stateless Streamable HTTP (one transport per request)
// ---------------------------------------------------------------------------
app.post("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });
  const server = buildMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", server: "person-app-mcp", version: "1.0.0" });
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
app.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}`);
  console.log(`  POST /mcp   — MCP Streamable HTTP endpoint`);
  console.log(`  GET  /health — Health check`);
});

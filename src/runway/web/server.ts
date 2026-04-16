import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserSession, type UploadedStatementFile } from "./session.js";
import type { StatementDebtCandidate } from "../statement-intake/index.js";

export type StartRunwayWebServerOptions = {
  profilePath?: string;
  port?: number;
};

export type RunwayWebServer = {
  url: string;
  port: number;
  profilePath: string;
  close(): Promise<void>;
};

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function mimeType(pathname: string): string {
  switch (extname(pathname)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    default:
      return "text/html; charset=utf-8";
  }
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

async function serveStatic(response: ServerResponse, pathname: string): Promise<void> {
  const filePath = join(publicDir, pathname === "/" ? "index.html" : pathname.slice(1));
  const contents = await readFile(filePath, "utf8");
  response.writeHead(200, { "content-type": mimeType(filePath) });
  response.end(contents);
}

export async function startRunwayWebServer(options: StartRunwayWebServerOptions = {}): Promise<RunwayWebServer> {
  const session = await createBrowserSession({ profilePath: options.profilePath });

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    try {
      if (request.method === "GET" && url.pathname === "/api/state") {
        writeJson(response, 200, session.getState());
        return;
      }

      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/profile") {
        const payload = await readJsonBody<{ profile: Record<string, unknown> }>(request);
        writeJson(response, 200, await session.saveProfile(payload.profile));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/statements/extract") {
        const payload = await readJsonBody<{ files: UploadedStatementFile[] }>(request);
        writeJson(response, 200, {
          files: await session.extractStatements(payload.files),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/statements/merge") {
        const payload = await readJsonBody<{ candidates: StatementDebtCandidate[] }>(request);
        writeJson(response, 200, await session.mergeStatementCandidates(payload.candidates));
        return;
      }

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/app.js" || url.pathname === "/styles.css")) {
        await serveStatic(response, url.pathname);
        return;
      }

      writeJson(response, 404, { error: "Not found" });
    } catch (error) {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve the web server address.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    profilePath: session.getState().profilePath,
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

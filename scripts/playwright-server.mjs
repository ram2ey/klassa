// Test-only HTTPS reverse proxy for the real production server and secure cookies.
import { spawn } from "node:child_process";
import { cpSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit", windowsHide: true, env: { ...process.env, PORT: "3108", HOSTNAME: "127.0.0.1" },
});
const proxy = https.createServer({
  key: readFileSync(new URL("../e2e/fixtures/localhost.key", import.meta.url)),
  cert: readFileSync(new URL("../e2e/fixtures/localhost.crt", import.meta.url)),
}, (request, response) => {
  const upstream = http.request({ hostname: "127.0.0.1", port: 3108, path: request.url, method: request.method,
    headers: { ...request.headers, "x-forwarded-proto": "https", "x-forwarded-host": request.headers.host } }, incoming => {
    response.writeHead(incoming.statusCode ?? 502, incoming.headers);
    incoming.pipe(response);
  });
  upstream.on("error", () => { response.writeHead(503); response.end("Production server starting"); });
  request.pipe(upstream);
});
proxy.listen(3107, "localhost");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
  server.kill(signal);
  proxy.close(() => process.exit(0));
});
server.once("exit", code => { proxy.close(() => process.exit(code ?? 1)); });
server.once("error", error => { process.stderr.write(`${error.message}\n`); proxy.close(() => process.exit(1)); });

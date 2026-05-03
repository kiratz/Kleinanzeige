const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { loadEnv } = require("../../../packages/config/index.js");

const env = loadEnv();
const publicDir = path.join(__dirname, "../public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let filePath = path.join(publicDir, url.pathname === "/" ? "index.html" : url.pathname);

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, "index.html");
  }

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  response.end(fs.readFileSync(filePath));
});

server.listen(env.APP_PORT, () => {
  console.log(`Kleinanzeige Web listening on http://localhost:${env.APP_PORT}`);
});

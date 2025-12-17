import http from "http";
import url from "url";

let server = null;
let serverPort = null;

/**
 * Start HTTP test server
 * @returns {Promise<{port: number, url: string}>} Server port and URL
 */
export function startServer() {
  return new Promise((resolve, reject) => {
    if (server) {
      return resolve({ port: serverPort, url: `http://localhost:${serverPort}` });
    }

    server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;
      const method = req.method;

      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/json");

      // Handle different endpoints
      if ((pathname === "/auth/login" || pathname === "/user/login") && method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          const data = JSON.parse(body);
          if (data.username === "testuser" && data.password === "testpass") {
            res.writeHead(200);
            res.end(
              JSON.stringify({
                token: "test-token-123",
                user: { id: 1, name: "Test User", email: "test@example.com" },
              }),
            );
          } else {
            res.writeHead(401);
            res.end(JSON.stringify({ code: "invalidCredentials", message: "Invalid credentials" }));
          }
        });
        return;
      }

      if (pathname === "/user/create" && method === "POST") {
        res.writeHead(200);
        res.end(JSON.stringify({ id: 1, name: "Created User", email: "created@example.com" }));
        return;
      }

      if (pathname.startsWith("/user/") && method === "GET") {
        const userId = pathname.split("/")[2];
        res.writeHead(200);
        res.end(JSON.stringify({ id: parseInt(userId), name: `User ${userId}`, email: `user${userId}@example.com` }));
        return;
      }

      if (pathname.startsWith("/user/") && pathname.endsWith("/activate") && method === "POST") {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: "User activated" }));
        return;
      }

      if (pathname === "/email/send" && method === "POST") {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: "Email sent" }));
        return;
      }

      if (pathname === "/error/400" && method === "GET") {
        res.writeHead(400);
        res.end(JSON.stringify({ code: "badRequest", message: "Bad request" }));
        return;
      }

      if (pathname === "/error/404" && method === "GET") {
        res.writeHead(404);
        res.end(JSON.stringify({ code: "notFound", message: "Not found" }));
        return;
      }

      if (pathname === "/error/allowed" && method === "POST") {
        res.writeHead(400);
        res.end(JSON.stringify({ code: "allowedError", message: "This error is allowed" }));
        return;
      }

      // Default 404
      res.writeHead(404);
      res.end(JSON.stringify({ code: "notFound", message: "Endpoint not found" }));
    });

    server.listen(0, () => {
      serverPort = server.address().port;
      resolve({ port: serverPort, url: `http://localhost:${serverPort}` });
    });

    server.on("error", reject);
  });
}

/**
 * Stop HTTP test server
 */
export function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        serverPort = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

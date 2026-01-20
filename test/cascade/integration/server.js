import http from "http";
import url from "url";

let server = null;
let serverPort = null;

// Track registered users for dynamic authentication (persists across requests)
const registeredUsers = new Map();

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
          // Check static test user
          if (data.username === "testuser" && data.password === "testpass") {
            res.writeHead(200);
            res.end(
              JSON.stringify({
                token: "test-token-123",
                user: { id: 1, name: "Test User", email: "test@example.com" },
              }),
            );
          }
          // Check dynamically registered users (by email)
          else if (
            registeredUsers.has(data.username) &&
            registeredUsers.get(data.username).password === data.password
          ) {
            const user = registeredUsers.get(data.username);
            res.writeHead(200);
            res.end(
              JSON.stringify({
                token: `token-${user.id}`,
                user: { id: user.id, name: user.name, email: data.username },
              }),
            );
          } else {
            res.writeHead(401);
            res.end(JSON.stringify({ code: "invalidCredentials", message: "Invalid credentials" }));
          }
        });
        return;
      }

      if (pathname === "/user/register" && method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          const data = JSON.parse(body);
          const userId = Math.floor(Math.random() * 10000) + 100;
          // Support username or login field for flexibility
          const loginKey = data.username || data.login;
          const passwordValue = data.password || data.secret;
          // Store registered user for subsequent login
          registeredUsers.set(loginKey, {
            id: userId,
            name: data.name || "Registered User",
            password: passwordValue,
          });
          res.writeHead(200);
          res.end(
            JSON.stringify({
              id: userId,
              name: data.name || "Registered User",
              username: loginKey,
            }),
          );
        });
        return;
      }

      if (pathname === "/user/profile" && method === "GET") {
        // Check authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.writeHead(401);
          res.end(JSON.stringify({ code: "unauthorized", message: "Missing authorization" }));
          return;
        }
        // Return profile based on token
        const token = authHeader.replace("Bearer ", "");
        if (token.startsWith("token-")) {
          const userId = parseInt(token.replace("token-", ""));
          res.writeHead(200);
          res.end(JSON.stringify({ id: userId, name: "Registered User", email: "registered@example.com" }));
        } else {
          res.writeHead(200);
          res.end(JSON.stringify({ id: 1, name: "Test User", email: "test@example.com" }));
        }
        return;
      }

      if (pathname === "/protected/resource" && method === "GET") {
        // Check authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.writeHead(401);
          res.end(JSON.stringify({ code: "unauthorized", message: "Missing authorization" }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ message: "Protected resource accessed successfully", token: authHeader }));
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
        registeredUsers.clear(); // Clear registered users for clean state
        resolve();
      });
    } else {
      resolve();
    }
  });
}

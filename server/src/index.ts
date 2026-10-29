import dotenv from "dotenv";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

dotenv.config();

try {
  const config = loadConfig();
  const app = createApp(config);

  const server = app.listen(config.PORT, () => {
    console.log(
      `[keys-of-the-departed] Server listening on port ${config.PORT} (mode: ${config.NODE_ENV})`,
    );
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${config.PORT} is already in use. Please select a different port via PORT environment variable.`,
      );
      process.exit(1);
    } else {
      console.error("Server startup error:", err.message);
      process.exit(1);
    }
  });
} catch (err: unknown) {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error("Unknown error starting server");
  }
  process.exit(1);
}

import { SQL } from "bun";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { assertMigrated } from "./db/migrate";
import { createMailer } from "./mailer";
import { createSecurity } from "./security";

const config = loadConfig();
const sql = new SQL(config.databaseUrl);
await sql`SELECT 1`;
await assertMigrated(sql);
const app = createApp({ sql, config, mailer: createMailer(config), security: createSecurity(config) });
app.listen({ port: config.port, hostname: config.bindHost });
console.log(`API lista en http://${config.bindHost}:${config.port}`);

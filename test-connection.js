import * as dotenv from "dotenv";
import { Client } from "pg";

dotenv.config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

(async () => {
    try {
        await client.connect();
        console.log("Conexão com PostgreSQL bem-sucedida!");
    } catch (e) {
        console.error("Falha na conexão:", e.message);
    } finally {
        await client.end();
    }
})();

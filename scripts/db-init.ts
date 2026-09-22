import "dotenv/config";
import { initDatabase, DB_URL } from "../src/lib/db/bootstrap";

initDatabase()
  .then(() => {
    console.log("База данных инициализирована:", DB_URL);
  })
  .catch((e) => {
    console.error("Ошибка инициализации базы данных:", e);
    process.exit(1);
  });
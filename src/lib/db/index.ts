import { drizzle } from "drizzle-orm/libsql";
import { createDbClient } from "./bootstrap";
import * as schema from "./schema";

export const db = drizzle(createDbClient(), { schema });
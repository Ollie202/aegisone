import { mkdir, readFile, writeFile } from "node:fs/promises";

const message = (await readFile(new URL("./src/message.txt", import.meta.url), "utf8")).trimEnd();
const artifact = JSON.stringify({ message, schemaVersion: 1 }) + "\n";
await mkdir(new URL("./dist/", import.meta.url), { recursive: true });
await writeFile(new URL("./dist/hello-proofrail.json", import.meta.url), artifact, "utf8");

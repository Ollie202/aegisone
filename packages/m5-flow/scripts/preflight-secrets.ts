const sandboxPresent = typeof process.env.ZEROG_SANDBOX_PRIVATE_KEY === "string" && process.env.ZEROG_SANDBOX_PRIVATE_KEY.trim().length > 0;
const storagePresent = typeof process.env.ZEROG_STORAGE_PRIVATE_KEY === "string" && process.env.ZEROG_STORAGE_PRIVATE_KEY.trim().length > 0;

console.log(JSON.stringify({
  schemaVersion: "1",
  check: "M5_SECRET_PRESENCE_ONLY",
  safe: true,
  ZEROG_SANDBOX_PRIVATE_KEY: { present: sandboxPresent },
  ZEROG_STORAGE_PRIVATE_KEY: { present: storagePresent },
}, null, 2));

if (!sandboxPresent || !storagePresent) process.exitCode = 3;

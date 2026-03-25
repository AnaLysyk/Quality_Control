export function info(message: string, meta?: Record<string, unknown>) {
  if (meta) console.log(`[INFO] ${message}`, meta);
  else console.log(`[INFO] ${message}`);
}

export function warn(message: string, meta?: Record<string, unknown>) {
  if (meta) console.warn(`[WARN] ${message}`, meta);
  else console.warn(`[WARN] ${message}`);
}

export function error(message: string, meta?: Record<string, unknown>) {
  if (meta) console.error(`[ERROR] ${message}`, meta);
  else console.error(`[ERROR] ${message}`);
}

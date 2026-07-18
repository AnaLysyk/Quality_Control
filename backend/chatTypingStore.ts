
import "server-only";

type TypingEntry = {
  fromUserId: string;
  toUserId: string;
  fromName: string;
  updatedAt: number;
};

const typingStore = new Map<string, TypingEntry>();
const TYPING_TTL_MS = 6000;

function key(fromUserId: string, toUserId: string) {
  return `${fromUserId}->${toUserId}`;
}

function cleanup() {
  const now = Date.now();

  for (const [entryKey, entry] of typingStore.entries()) {
    if (now - entry.updatedAt > TYPING_TTL_MS) {
      typingStore.delete(entryKey);
    }
  }
}

export function touchTyping(input: { fromUserId: string; toUserId: string; fromName: string }) {
  cleanup();

  typingStore.set(key(input.fromUserId, input.toUserId), {
    ...input,
    updatedAt: Date.now(),
  });
}

export function clearTyping(input: { fromUserId: string; toUserId: string }) {
  typingStore.delete(key(input.fromUserId, input.toUserId));
}

export function getTypingForUser(input: { viewerUserId: string; peerId: string }) {
  cleanup();

  const entry = typingStore.get(key(input.peerId, input.viewerUserId));

  if (!entry) return null;

  return {
    fromUserId: entry.fromUserId,
    fromName: entry.fromName,
    updatedAt: new Date(entry.updatedAt).toISOString(),
  };
}

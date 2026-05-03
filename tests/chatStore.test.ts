const mockRedisStore = new Map<string, string>();
const mockRedis = {
  get: jest.fn(async (key: string) => mockRedisStore.get(key) ?? null),
  set: jest.fn(async (key: string, value: string) => {
    mockRedisStore.set(key, value);
    return "OK";
  }),
  del: jest.fn(async (key: string) => (mockRedisStore.delete(key) ? 1 : 0)),
};

jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(() => mockRedis),
}));

import {
  appendChatMessage,
  clearChatStore,
  listChatInboxSummaries,
  listChatThreadMessages,
  makeChatThreadKey,
} from "../lib/chatStore";

describe("chatStore", () => {
  beforeEach(async () => {
    mockRedisStore.clear();
    jest.clearAllMocks();
    await clearChatStore();
  });

  test("creates a single thread for both message directions", async () => {
    const threadKey = makeChatThreadKey("user-b", "user-a");
    expect(threadKey).toBe(makeChatThreadKey("user-a", "user-b"));

    const first = await appendChatMessage({
      sender: {
        id: "user-a",
        name: "Ana Paula Lysyk",
        handle: "ana.paula.lysyk",
        avatarUrl: "https://example.com/a.png",
      },
      recipient: {
        id: "user-b",
        name: "Bruno Santos",
        handle: "bruno.santos",
        avatarUrl: "https://example.com/b.png",
      },
      text: "Oi, tudo bem?",
    });

    const second = await appendChatMessage({
      sender: {
        id: "user-b",
        name: "Bruno Santos",
        handle: "bruno.santos",
        avatarUrl: "https://example.com/b.png",
      },
      recipient: {
        id: "user-a",
        name: "Ana Paula Lysyk",
        handle: "ana.paula.lysyk",
        avatarUrl: "https://example.com/a.png",
      },
      text: "Tudo certo por aqui.",
    });

    expect(first.threadKey).toBe(threadKey);
    expect(second.threadKey).toBe(threadKey);

    const inbox = await listChatInboxSummaries("user-a");
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      key: threadKey,
      peerId: "user-b",
      peerName: "Bruno Santos",
      lastMessage: "Tudo certo por aqui.",
      messageCount: 2,
    });

    const messages = await listChatThreadMessages("user-b", "user-a");
    expect(messages.map((message) => message.text)).toEqual([
      "Oi, tudo bem?",
      "Tudo certo por aqui.",
    ]);
  });

  test("persists attachment-only messages and builds a preview from the attachment", async () => {
    await appendChatMessage({
      sender: {
        id: "user-a",
        name: "Ana Paula Lysyk",
        handle: "ana.paula.lysyk",
        avatarUrl: null,
      },
      recipient: {
        id: "user-b",
        name: "Bruno Santos",
        handle: "bruno.santos",
        avatarUrl: null,
      },
      text: "",
      attachments: [
        {
          id: "attachment-1",
          kind: "system",
          label: "Tela atual /admin/users?tab=company",
          url: "http://localhost:3000/admin/users?tab=company",
          mimeType: null,
          sizeLabel: null,
          sourceLabel: "Atalho do sistema",
        },
      ],
    });

    const inbox = await listChatInboxSummaries("user-a");
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.lastMessage).toBe("Anexo: Tela atual /admin/users?tab=company");

    const messages = await listChatThreadMessages("user-a", "user-b");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.attachments).toHaveLength(1);
    expect(messages[0]?.attachments?.[0]?.kind).toBe("system");
  });

  test("clearChatStore removes persisted conversations", async () => {
    await appendChatMessage({
      sender: {
        id: "user-a",
        name: "Ana Paula Lysyk",
        handle: "ana.paula.lysyk",
        avatarUrl: null,
      },
      recipient: {
        id: "user-b",
        name: "Bruno Santos",
        handle: "bruno.santos",
        avatarUrl: null,
      },
      text: "Mensagem de teste",
    });

    expect(await listChatInboxSummaries("user-a")).toHaveLength(1);

    await clearChatStore();

    expect(await listChatInboxSummaries("user-a")).toEqual([]);
    expect(await listChatThreadMessages("user-a", "user-b")).toEqual([]);
  });
});

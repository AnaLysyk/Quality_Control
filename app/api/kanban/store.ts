import { type Card } from "./types";

// Mock store in-memory para dev/local
const store: Card[] = [
  {
    id: 1,
    project: "SFQ",
    client_slug: "mock-client",
    run_id: 99,
    case_id: 123,
    title: "Card de exemplo",
    status: "NOT_RUN",
    bug: null,
    link: null,
    created_at: new Date().toISOString(),
  },
];

let idCounter = store.length + 1;
export function nextId() {
  return idCounter++;
}

export default store;

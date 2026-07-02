export type BrainSafeAction =
  | "read_only"
  | "suggestion"
  | "draft"
  | "write"
  | "destructive"
  | "external_publish";

export function actionRequiresConfirmation(action: BrainSafeAction) {
  return action === "destructive" || action === "external_publish";
}

export function actionRequiresHumanInLoop(action: BrainSafeAction) {
  return action === "write" || action === "destructive" || action === "external_publish";
}


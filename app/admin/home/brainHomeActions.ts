export type BrainHomeAction = {
  id: string;
  label: string;
  prompt: string;
  description: string;
  href?: string | null;
  moduleLabel?: string | null;
  children?: BrainHomeAction[];
};

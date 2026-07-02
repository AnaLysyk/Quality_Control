import { BrainAccessRequestFlowPanel } from "./_components/BrainAccessRequestFlowPanel";

export default function BrainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <BrainAccessRequestFlowPanel />
      {children}
    </div>
  );
}


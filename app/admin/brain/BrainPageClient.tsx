"use client";

import dynamic from "next/dynamic";

const BrainGraphView = dynamic(() => import("./BrainReactFlowView"), { ssr: false });

export default function BrainPageClient() {
  return (
    <>
      <style jsx global>{`
        body:not(.dark):not([data-theme="dark"]) [class*="reactFlowShell"],
        body:not(.dark):not([data-theme="dark"]) [class*="reactFlowStage"],
        html:not(.dark):not([data-theme="dark"]) [class*="reactFlowShell"],
        html:not(.dark):not([data-theme="dark"]) [class*="reactFlowStage"] {
          background:
            radial-gradient(circle at 18% 16%, rgba(59, 130, 246, 0.12), transparent 34%),
            radial-gradient(circle at 88% 86%, rgba(239, 0, 1, 0.06), transparent 32%),
            linear-gradient(135deg, #ffffff 0%, #f7faff 52%, #edf4ff 100%) !important;
          color: #061225 !important;
        }

        body:not(.dark):not([data-theme="dark"]) .react-flow,
        body:not(.dark):not([data-theme="dark"]) .react-flow__pane,
        body:not(.dark):not([data-theme="dark"]) .react-flow__renderer,
        body:not(.dark):not([data-theme="dark"]) .react-flow__viewport,
        html:not(.dark):not([data-theme="dark"]) .react-flow,
        html:not(.dark):not([data-theme="dark"]) .react-flow__pane,
        html:not(.dark):not([data-theme="dark"]) .react-flow__renderer,
        html:not(.dark):not([data-theme="dark"]) .react-flow__viewport {
          background:
            radial-gradient(circle at 18% 16%, rgba(59, 130, 246, 0.12), transparent 34%),
            radial-gradient(circle at 88% 86%, rgba(239, 0, 1, 0.06), transparent 32%),
            linear-gradient(135deg, #ffffff 0%, #f7faff 52%, #edf4ff 100%) !important;
        }

        .dark [class*="reactFlowShell"],
        .dark [class*="reactFlowStage"],
        [data-theme="dark"] [class*="reactFlowShell"],
        [data-theme="dark"] [class*="reactFlowStage"],
        html.dark [class*="reactFlowShell"],
        html.dark [class*="reactFlowStage"],
        body.dark [class*="reactFlowShell"],
        body.dark [class*="reactFlowStage"] {
          background:
            radial-gradient(circle at 12% 10%, rgba(239, 0, 1, 0.16), transparent 30%),
            radial-gradient(circle at 82% 18%, rgba(59, 130, 246, 0.12), transparent 34%),
            linear-gradient(135deg, #020713 0%, #050914 52%, #0a1830 100%) !important;
          color: #f8fafc !important;
        }

        .dark .react-flow,
        .dark .react-flow__pane,
        .dark .react-flow__renderer,
        .dark .react-flow__viewport,
        [data-theme="dark"] .react-flow,
        [data-theme="dark"] .react-flow__pane,
        [data-theme="dark"] .react-flow__renderer,
        [data-theme="dark"] .react-flow__viewport,
        html.dark .react-flow,
        html.dark .react-flow__pane,
        html.dark .react-flow__renderer,
        html.dark .react-flow__viewport,
        body.dark .react-flow,
        body.dark .react-flow__pane,
        body.dark .react-flow__renderer,
        body.dark .react-flow__viewport {
          background:
            radial-gradient(circle at 12% 10%, rgba(239, 0, 1, 0.16), transparent 30%),
            radial-gradient(circle at 82% 18%, rgba(59, 130, 246, 0.12), transparent 34%),
            linear-gradient(135deg, #020713 0%, #050914 52%, #0a1830 100%) !important;
        }

        .dark .react-flow__background,
        [data-theme="dark"] .react-flow__background,
        html.dark .react-flow__background,
        body.dark .react-flow__background {
          background-color: transparent !important;
        }

        .dark .react-flow__controls,
        [data-theme="dark"] .react-flow__controls,
        html.dark .react-flow__controls,
        body.dark .react-flow__controls {
          background: rgba(7, 15, 31, 0.92) !important;
          border: 1px solid rgba(148, 163, 184, 0.22) !important;
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28) !important;
        }

        .dark .react-flow__controls-button,
        [data-theme="dark"] .react-flow__controls-button,
        html.dark .react-flow__controls-button,
        body.dark .react-flow__controls-button {
          background: rgba(15, 23, 42, 0.95) !important;
          border-color: rgba(148, 163, 184, 0.18) !important;
          color: #f8fafc !important;
          fill: #f8fafc !important;
        }
      `}</style>
      <BrainGraphView />
    </>
  );
}

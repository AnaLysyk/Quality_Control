"use client";

import { ReactNode } from "react";

interface MainWrapperProps {
  children: ReactNode;
}

export default function MainWrapper({ children }: MainWrapperProps) {
  return (
    <main className="flex-1 w-full min-h-full min-w-0 overflow-x-hidden px-4 sm:px-6 lg:px-10 pr-20 sm:pr-12 lg:pr-16 pt-2 pb-10">
      {children}
    </main>
  );
}

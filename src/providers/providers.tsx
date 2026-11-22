"use client";

import { type ReactNode } from "react";
import ReactQueryProvider from "@/providers/react-query-provider";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ReactQueryProvider>
      <Toaster richColors position="bottom-right" />
      {children}
    </ReactQueryProvider>
  );
}

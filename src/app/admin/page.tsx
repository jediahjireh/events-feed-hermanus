"use client";

import { useState } from "react";
import { BarChart3, Download, Eye, TestTube } from "lucide-react";
import { HealthOverview } from "@/components/admin/health-overview";
import { IngestPanel } from "@/components/admin/ingest-panel";
import { ReviewPanel } from "@/components/admin/review-panel";
import { E2ETestRunner } from "@/components/admin/e2e-test-runner";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "ingest", label: "Ingest", icon: Download },
  { id: "review", label: "Review", icon: Eye },
  { id: "tests", label: "E2E Tests", icon: TestTube },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Panel</h1>

      <div className="flex gap-1 rounded-lg border bg-white p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-vibrant-leaf text-white shadow-sm"
                  : "text-deep-forest/60 hover:bg-whisper-green hover:text-deep-forest",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "overview" && <HealthOverview />}
        {tab === "ingest" && <IngestPanel />}
        {tab === "review" && <ReviewPanel />}
        {tab === "tests" && <E2ETestRunner />}
      </div>
    </div>
  );
}

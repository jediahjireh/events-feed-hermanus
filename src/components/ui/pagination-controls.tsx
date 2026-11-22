"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationControls({
  page,
  perPage,
  totalCount,
  hasMore,
  onPageChange,
}: {
  page: number;
  perPage: number;
  totalCount: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}) {
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, totalCount);

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-sm text-deep-forest/60">
        {totalCount > 0
          ? `Showing ${start}\u2013${end} of ${totalCount}`
          : "No results"}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          icon={ChevronLeft}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasMore}
          icon={ChevronRight}
          iconPosition="right"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

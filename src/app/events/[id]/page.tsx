"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useEvent, useDeleteEvent } from "@/hooks/use-events";
import { EventDetail, EventDetailSkeleton } from "@/components/events/event-detail";
import { EventForm } from "@/components/events/event-form";
import { VersionTimeline } from "@/components/events/version-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";

export default function EventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data: event, isLoading, error } = useEvent(params.id);
  const deleteEvent = useDeleteEvent();

  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  async function handleDelete() {
    deleteEvent.mutate(params.id, {
      onSuccess: () => {
        setShowDelete(false);
        router.push("/");
      },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <EventDetailSkeleton />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-vibrant-leaf hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
        <Card className="border-red-200">
          <CardContent className="py-8 text-center text-sm text-red-700">
            {error instanceof Error ? error.message : "Event not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-vibrant-leaf hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="destructive" size="sm" icon={Trash2} onClick={() => setShowDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      {editing ? (
        <Card>
          <CardHeader><CardTitle>Edit Event</CardTitle></CardHeader>
          <CardContent>
            <EventForm
              event={event}
              onSaved={() => {
                setEditing(false);
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <EventDetail event={event} />
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Version History</h2>
        <VersionTimeline eventId={event.id} />
      </div>

      <Modal
        open={showDelete}
        title="Delete Event"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        confirmLabel={deleteEvent.isPending ? "Deleting..." : "Delete"}
        confirmVariant="danger"
      >
        <p>
          This will mark <strong>{event.title}</strong> as cancelled. This action creates a new version and can be undone by editing the event status back to active.
        </p>
      </Modal>
    </div>
  );
}

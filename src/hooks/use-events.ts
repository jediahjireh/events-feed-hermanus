"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import type { Event } from "@/types/event";

export const eventKeys = {
  all: ["events"] as const,
  lists: () => [...eventKeys.all, "list"] as const,
  list: (filters: Record<string, string>) =>
    [...eventKeys.lists(), filters] as const,
  details: () => [...eventKeys.all, "detail"] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
  versions: (id: string) => [...eventKeys.detail(id), "versions"] as const,
};

export function useEvents(params: Record<string, string>) {
  return useQuery({
    queryKey: eventKeys.list(params),
    queryFn: async () => {
      const result = await apiGet<Event[]>("/api/events", params);
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to load events");
      return result;
    },
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: async () => {
      const result = await apiGet<Event>(`/api/events/${id}`);
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Event not found");
      return result.data;
    },
    enabled: !!id,
  });
}

export function useEventVersions(id: string) {
  return useQuery({
    queryKey: eventKeys.versions(id),
    queryFn: async () => {
      const result = await apiGet<unknown[]>(`/api/events/${id}/versions`);
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to load versions");
      return result.data;
    },
    enabled: !!id,
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const result = await apiPut<Event>(`/api/events/${id}`, data);
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to update");
      return result.data;
    },
    onSuccess: (_data, variables) => {
      toast.success("Event updated");
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error("Failed to update event", { description: error.message });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiDelete(`/api/events/${id}`);
      if (!result.ok) throw new Error(result.errors[0]?.message ?? "Failed to delete");
    },
    onSuccess: () => {
      toast.success("Event deleted");
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete event", { description: error.message });
    },
  });
}

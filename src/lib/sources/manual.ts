/**
 * Manual submission handler.
 *
 * Processes manually submitted events. These go in with
 * source: "manual" and confidence: 0.5 (unverified).
 * The review agent can bump confidence if it finds a matching
 * event from another source.
 */

import type { CreateEventInput } from "@/types/event";

const MANUAL_SOURCE_ID = "manual";
const MANUAL_DEFAULT_CONFIDENCE = 0.5;

/**
 * Prepare a manually submitted event for creation.
 * Sets source_id to "manual" and applies default confidence.
 */
export function prepareManualEvent(
  input: Omit<CreateEventInput, "source_id">
): CreateEventInput {
  return {
    ...input,
    source_id: MANUAL_SOURCE_ID,
    confidence: input.confidence ?? MANUAL_DEFAULT_CONFIDENCE,
  };
}

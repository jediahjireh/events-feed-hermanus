/**
 * Relevance Agent tests — verify scoring logic for traveller profiles.
 *
 * The relevance agent is a pure function: no external dependencies,
 * no mocks needed. Tests verify the category-profile matrix and
 * the suitable_for boost.
 */

import { describe, it, expect } from "vitest";
import { scoreRelevance } from "@/agents/relevance";

describe("scoreRelevance", () => {
  // --- Base scoring from category-profile matrix ---

  describe("category-profile matrix", () => {
    it("scores wildlife high for couples", () => {
      const score = scoreRelevance(["wildlife"], [], ["couples"]);
      expect(score).toBe(0.95);
    });

    it("scores food-wine high for luxury", () => {
      const score = scoreRelevance(["food-wine"], [], ["luxury"]);
      expect(score).toBe(0.95);
    });

    it("scores sport high for adventure", () => {
      const score = scoreRelevance(["sport"], [], ["adventure"]);
      expect(score).toBe(0.9);
    });

    it("scores family high for families", () => {
      const score = scoreRelevance(["family"], [], ["families"]);
      expect(score).toBe(0.95);
    });

    it("scores art low for adventure", () => {
      const score = scoreRelevance(["art"], [], ["adventure"]);
      expect(score).toBe(0.3);
    });

    it("scores sport low for luxury", () => {
      const score = scoreRelevance(["sport"], [], ["luxury"]);
      expect(score).toBe(0.3);
    });
  });

  // --- Multiple categories: takes the max ---

  describe("multiple categories", () => {
    it("takes the highest score across categories", () => {
      // wildlife=0.95 for couples, market=0.8 for couples → max 0.95
      const score = scoreRelevance(["wildlife", "market"], [], ["couples"]);
      expect(score).toBe(0.95);
    });

    it("takes the highest across both categories and profiles", () => {
      // art: couples=0.85, luxury=0.9; music: couples=0.85, luxury=0.7
      // max is art+luxury = 0.9
      const score = scoreRelevance(
        ["art", "music"],
        [],
        ["couples", "luxury"]
      );
      expect(score).toBe(0.9);
    });
  });

  // --- suitable_for boost ---

  describe("suitable_for boost", () => {
    it("adds 0.1 when suitable_for matches the profile", () => {
      // wildlife base for couples = 0.95, +0.1 = 1.05 → capped at 1.0
      const score = scoreRelevance(["wildlife"], ["couples"], ["couples"]);
      expect(score).toBe(1.0);
    });

    it("boosts when any profile matches suitable_for", () => {
      // market base for luxury = 0.6, +0.1 boost = 0.7
      const score = scoreRelevance(
        ["market"],
        ["couples", "luxury"],
        ["luxury"]
      );
      expect(score).toBe(0.7);
    });

    it("does not boost when suitable_for does not match", () => {
      // market base for adventure = 0.5, no boost (suitable_for has couples only)
      const score = scoreRelevance(["market"], ["couples"], ["adventure"]);
      expect(score).toBe(0.5);
    });
  });

  // --- Edge cases ---

  describe("edge cases", () => {
    it("returns 0.5 for empty categories", () => {
      const score = scoreRelevance([], ["couples"], ["couples"]);
      expect(score).toBe(0.5);
    });

    it("returns 0.5 for empty profile types", () => {
      const score = scoreRelevance(["wildlife"], [], []);
      expect(score).toBe(0.5);
    });

    it("returns 0 for unknown category (no matching profile map)", () => {
      const score = scoreRelevance(["unknown-category"], [], ["couples"]);
      expect(score).toBe(0);
    });

    it("uses 0.5 fallback for unknown profile within known category", () => {
      // wildlife has no "budget" profile → defaults to 0.5
      const score = scoreRelevance(["wildlife"], [], ["budget"]);
      expect(score).toBe(0.5);
    });

    it("caps boosted score at 1.0", () => {
      // wildlife=0.95 for couples + 0.1 boost = 1.05, capped at 1.0
      const score = scoreRelevance(
        ["wildlife"],
        ["couples"],
        ["couples"]
      );
      expect(score).toBe(1.0);
    });
  });

  // --- Real-world seed data scenarios ---

  describe("seed data scenarios", () => {
    it("ranks whale watching high for luxury travellers", () => {
      const score = scoreRelevance(
        ["wildlife"],
        ["couples", "families", "luxury", "solo"],
        ["luxury"]
      );
      // wildlife+luxury = 0.9, +0.1 boost (luxury in suitable_for) = 1.0
      expect(score).toBe(1.0);
    });

    it("ranks wine tasting high for luxury travellers", () => {
      const score = scoreRelevance(
        ["food-wine"],
        ["couples", "luxury"],
        ["luxury"]
      );
      // food-wine+luxury = 0.95, +0.1 boost = 1.0 (capped)
      expect(score).toBe(1.0);
    });

    it("ranks country market lower for luxury than wine tasting", () => {
      const marketScore = scoreRelevance(
        ["market", "food-wine"],
        ["couples", "families", "solo"],
        ["luxury"]
      );
      const wineScore = scoreRelevance(
        ["food-wine"],
        ["couples", "luxury"],
        ["luxury"]
      );
      expect(wineScore).toBeGreaterThan(marketScore);
    });

    it("ranks FynArts high for couples+luxury", () => {
      const score = scoreRelevance(
        ["art", "music"],
        ["couples", "solo", "luxury"],
        ["couples", "luxury"]
      );
      // art+luxury=0.9, art+couples=0.85 → max 0.9, +0.1 boost = 1.0
      expect(score).toBe(1.0);
    });

    it("ranks whale festival high for families", () => {
      const score = scoreRelevance(
        ["wildlife", "music", "food-wine"],
        ["couples", "families", "solo"],
        ["families"]
      );
      // wildlife+families=0.9, +0.1 boost = 1.0
      expect(score).toBe(1.0);
    });
  });
});

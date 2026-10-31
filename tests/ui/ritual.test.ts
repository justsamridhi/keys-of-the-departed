import { describe, it, expect } from "vitest";
import { RITUAL_STATEMENTS, computeArchetype } from "../../client/src/pages/FreeSpiritPage.js";

describe("Stage 3: The Keeper's Ritual & Deterministic Archetypes", () => {
  describe("Archive Fragment Definitions", () => {
    it("RITUAL-01: Contains exactly 5 sequential archive fragments", () => {
      expect(RITUAL_STATEMENTS).toHaveLength(5);
      const ids = RITUAL_STATEMENTS.map((s) => s.id);
      expect(ids).toEqual([1, 2, 3, 4, 5]);
    });

    it("RITUAL-02: Preserves the five core psychological investigation traits", () => {
      const traits = RITUAL_STATEMENTS.map((s) => s.trait);
      expect(traits).toContain("Curiosity");
      expect(traits).toContain("Precision");
      expect(traits).toContain("Independence");
      expect(traits).toContain("Empathy");
      expect(traits).toContain("Patience");
    });

    it("RITUAL-03: Every fragment contains non-empty text, title, and symbol", () => {
      for (const fragment of RITUAL_STATEMENTS) {
        expect(fragment.title).toBeTruthy();
        expect(fragment.statement.length).toBeGreaterThan(15);
        expect(fragment.symbol).toBeTruthy();
      }
    });
  });

  describe("Deterministic Archetype Calculation", () => {
    it("RITUAL-04: Returns 'Quiet Observer' when zero fragments resonate (sensible neutral)", () => {
      const result = computeArchetype(0);
      expect(result.title).toBe("Quiet Observer");
      expect(result.subtitle).toContain("Guardian");
      expect(result.asset).toBe("/candleon.png");
    });

    it("RITUAL-05: Returns 'Quiet Observer' for 1 resonant choice", () => {
      const result = computeArchetype(1);
      expect(result.title).toBe("Quiet Observer");
      expect(result.asset).toBe("/candleon.png");
    });

    it("RITUAL-06: Returns 'Curious Wanderer' for 2 resonant choices", () => {
      const result = computeArchetype(2);
      expect(result.title).toBe("Curious Wanderer");
      expect(result.asset).toBe("/moon-waxing-crescent.png");
    });

    it("RITUAL-07: Returns 'Keeper of Small Wonders' for 3 resonant choices", () => {
      const result = computeArchetype(3);
      expect(result.title).toBe("Keeper of Small Wonders");
      expect(result.asset).toBe("/goldenbook.png");
    });

    it("RITUAL-08: Returns 'Unbound Archivist' for 4 resonant choices", () => {
      const result = computeArchetype(4);
      expect(result.title).toBe("Unbound Archivist");
      expect(result.asset).toBe("/rose-crimson-gold.png");
    });

    it("RITUAL-09: Returns 'Free Spirit' for all 5 resonant choices", () => {
      const result = computeArchetype(5);
      expect(result.title).toBe("Free Spirit");
      expect(result.asset).toBe("/heart-bleeding-gothic.png");
    });

    it("RITUAL-10: All archetypes have complete descriptive metadata and philosophies", () => {
      for (let count = 0; count <= 5; count++) {
        const archetype = computeArchetype(count);
        expect(archetype.title).toBeTruthy();
        expect(archetype.subtitle).toBeTruthy();
        expect(archetype.desc.length).toBeGreaterThan(20);
        expect(archetype.philosophy.length).toBeGreaterThan(10);
        expect(archetype.asset.startsWith("/")).toBe(true);
      }
    });
  });
});

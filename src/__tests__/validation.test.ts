import { describe, it, expect } from "vitest";
import { isValidTodoItem, isIncomplete, cloneTodos } from "../validation";
import { MAX_TODO_TEXT_LENGTH } from "../types";

describe("isValidTodoItem", () => {
  describe("valid inputs", () => {
    it.each([
      ["not_started"],
      ["in_progress"],
      ["completed"],
      ["abandoned"],
    ] as const)("returns true for valid TodoItem with status '%s'", (status) => {
      const item = { text: "task", status };
      expect(isValidTodoItem(item)).toBe(true);
    });

    it("returns true for text at exactly MAX_TODO_TEXT_LENGTH (1000 chars)", () => {
      const item = {
        text: "a".repeat(MAX_TODO_TEXT_LENGTH),
        status: "not_started" as const,
      };
      expect(isValidTodoItem(item)).toBe(true);
    });

    it("returns true for text with length 1", () => {
      const item = { text: "x", status: "not_started" as const };
      expect(isValidTodoItem(item)).toBe(true);
    });

    it("returns true for whitespace-only text", () => {
      const item = { text: "   ", status: "not_started" as const };
      expect(isValidTodoItem(item)).toBe(true);
    });

    it("returns true for object with extra properties beyond text/status", () => {
      const item = { text: "task", status: "not_started" as const, extra: true };
      expect(isValidTodoItem(item)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("returns false for null", () => {
      expect(isValidTodoItem(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidTodoItem(undefined)).toBe(false);
    });

    it("returns false for string", () => {
      expect(isValidTodoItem("not an object")).toBe(false);
    });

    it("returns false for number", () => {
      expect(isValidTodoItem(123)).toBe(false);
    });

    it("returns false for array", () => {
      expect(isValidTodoItem([{ text: "x", status: "not_started" }])).toBe(false);
    });

    it("returns false for object missing 'status' key { text: 'x' }", () => {
      expect(isValidTodoItem({ text: "x" })).toBe(false);
    });

    it("returns false for object missing 'text' key { status: 'not_started' }", () => {
      expect(isValidTodoItem({ status: "not_started" })).toBe(false);
    });

    it("returns false for non-string text (text: 123)", () => {
      expect(isValidTodoItem({ text: 123, status: "not_started" })).toBe(false);
    });

    it("returns false for non-string status (status: 123)", () => {
      expect(isValidTodoItem({ text: "task", status: 123 })).toBe(false);
    });

    it("returns false for invalid status 'unknown'", () => {
      expect(isValidTodoItem({ text: "task", status: "unknown" })).toBe(false);
    });

    it("returns false for empty text string ''", () => {
      expect(isValidTodoItem({ text: "", status: "not_started" })).toBe(false);
    });

    it("returns false for text exceeding MAX_TODO_TEXT_LENGTH", () => {
      const item = {
        text: "a".repeat(MAX_TODO_TEXT_LENGTH + 1),
        status: "not_started" as const,
      };
      expect(isValidTodoItem(item)).toBe(false);
    });
  });
});

describe("isIncomplete", () => {
  it.each([
    ["not_started", true],
    ["in_progress", true],
    ["completed", false],
    ["abandoned", false],
  ] as const)("returns %s for status '%s'", (status, expected) => {
    expect(isIncomplete(status)).toBe(expected);
  });
});

describe("cloneTodos", () => {
  it("returns a deep copy — mutation of clone does not affect original", () => {
    const original = [
      { text: "task1", status: "not_started" as const },
      { text: "task2", status: "in_progress" as const },
    ];
    const cloned = cloneTodos(original);

    expect(cloned).not.toBe(original);
    expect(cloned).toEqual(original);
    expect(cloned[0]).not.toBe(original[0]);
    expect(cloned[1]).not.toBe(original[1]);

    cloned[0]!.text = "modified";
    cloned[0]!.status = "completed";

    expect(original[0]!.text).toBe("task1");
    expect(original[0]!.status).toBe("not_started");
  });

  it("returns empty array for empty input", () => {
    const cloned = cloneTodos([]);
    expect(cloned).toEqual([]);
  });
});

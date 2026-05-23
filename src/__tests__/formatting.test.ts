import { describe, it, expect, beforeEach, test } from "vitest";
import type { TodoItem } from "../types";
import {
  getPlainIcon,
  formatTodoListText,
  formatRemainingList,
  getStatusIcon,
  getTodoLabel,
  renderTodoList,
  renderToolResult,
} from "../formatting";
import { createMockTheme } from "./helpers/mocks";

describe("getPlainIcon", () => {
  test.each([
    ["not_started", "–"],
    ["in_progress", "●"],
    ["completed", "✓"],
    ["abandoned", "✗"],
  ] as const)("returns '%s' for %s", (status, expected) => {
    expect(getPlainIcon(status)).toBe(expected);
  });
});

describe("formatTodoListText", () => {
  it("returns 'No todos' for empty array", () => {
    expect(formatTodoListText([])).toBe("No todos");
  });

  it("formats single item correctly", () => {
    const todos: TodoItem[] = [{ text: "my task", status: "not_started" }];
    expect(formatTodoListText(todos)).toBe("– [0] my task");
  });

  it("formats multiple items with correct icons and indices", () => {
    const todos: TodoItem[] = [
      { text: "first task", status: "not_started" },
      { text: "second task", status: "in_progress" },
      { text: "third task", status: "completed" },
      { text: "fourth task", status: "abandoned" },
    ];
    expect(formatTodoListText(todos)).toBe(
      "– [0] first task\n● [1] second task\n✓ [2] third task\n✗ [3] fourth task",
    );
  });
});

describe("formatRemainingList", () => {
  it("formats only the specified indices", () => {
    const todos: TodoItem[] = [
      { text: "task 0", status: "not_started" },
      { text: "task 1", status: "in_progress" },
      { text: "task 2", status: "completed" },
      { text: "task 3", status: "not_started" },
    ];
    expect(formatRemainingList(todos, [0, 2, 3])).toBe(
      "– [0] task 0\n✓ [2] task 2\n– [3] task 3",
    );
  });

  it("preserves order from the indices array", () => {
    const todos: TodoItem[] = [
      { text: "task 0", status: "not_started" },
      { text: "task 1", status: "in_progress" },
      { text: "task 2", status: "completed" },
    ];
    expect(formatRemainingList(todos, [2, 0, 1])).toBe(
      "✓ [2] task 2\n– [0] task 0\n● [1] task 1",
    );
  });

  it("handles single index", () => {
    const todos: TodoItem[] = [{ text: "task 0", status: "not_started" }];
    expect(formatRemainingList(todos, [0])).toBe("– [0] task 0");
  });

  it("returns empty string for empty indices array", () => {
    const todos: TodoItem[] = [{ text: "task 0", status: "not_started" }];
    expect(formatRemainingList(todos, [])).toBe("");
  });

  it("skips out-of-bounds positive index gracefully", () => {
    const todos: TodoItem[] = [{ text: "task 0", status: "not_started" }];
    expect(formatRemainingList(todos, [999])).toBe("");
  });

  it("skips negative index gracefully", () => {
    const todos: TodoItem[] = [{ text: "task 0", status: "not_started" }];
    expect(formatRemainingList(todos, [-1])).toBe("");
  });

  it("includes only valid indices when mixing valid and invalid", () => {
    const todos: TodoItem[] = [
      { text: "task 0", status: "not_started" },
      { text: "task 1", status: "in_progress" },
    ];
    expect(formatRemainingList(todos, [0, 999, -1, 1])).toBe("– [0] task 0\n● [1] task 1");
  });
});

describe("getStatusIcon", () => {
  let mockTheme: ReturnType<typeof createMockTheme>;

  beforeEach(() => {
    mockTheme = createMockTheme();
  });

  test.each([
    ["not_started", "dim", "–"],
    ["in_progress", "warning", "●"],
    ["completed", "success", "✓"],
    ["abandoned", "error", "✗"],
  ] as const)("calls theme.fg with correct args for %s", (status, color, icon) => {
    getStatusIcon(status, mockTheme);
    expect(mockTheme.fg).toHaveBeenCalledWith(color, icon);
  });
});

describe("getTodoLabel", () => {
  let mockTheme: ReturnType<typeof createMockTheme>;

  beforeEach(() => {
    mockTheme = createMockTheme();
  });

  it("calls theme.fg('dim', strikethrough(text)) for completed", () => {
    getTodoLabel("my task", "completed", mockTheme);
    expect(mockTheme.strikethrough).toHaveBeenCalledWith("my task");
    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "~~my task~~");
  });

  it("calls theme.fg('dim', strikethrough(text)) for abandoned", () => {
    getTodoLabel("my task", "abandoned", mockTheme);
    expect(mockTheme.strikethrough).toHaveBeenCalledWith("my task");
    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "~~my task~~");
  });

  it("calls theme.fg('text', text) for not_started", () => {
    getTodoLabel("my task", "not_started", mockTheme);
    expect(mockTheme.strikethrough).not.toHaveBeenCalled();
    expect(mockTheme.fg).toHaveBeenCalledWith("text", "my task");
  });

  it("calls theme.fg('text', text) for in_progress", () => {
    getTodoLabel("my task", "in_progress", mockTheme);
    expect(mockTheme.strikethrough).not.toHaveBeenCalled();
    expect(mockTheme.fg).toHaveBeenCalledWith("text", "my task");
  });
});

describe("renderTodoList", () => {
  let mockTheme: ReturnType<typeof createMockTheme>;

  beforeEach(() => {
    mockTheme = createMockTheme();
  });

  it("calls theme.fg('dim', 'No todos') for empty array", () => {
    renderTodoList([], mockTheme);
    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "No todos");
  });

  it("formats each item with correct theme calls", () => {
    const todos: TodoItem[] = [
      { text: "first task", status: "not_started" },
      { text: "second task", status: "in_progress" },
      { text: "third task", status: "completed" },
    ];

    renderTodoList(todos, mockTheme);

    // First item: not_started
    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "–");
    expect(mockTheme.fg).toHaveBeenCalledWith("accent", "[0]");
    expect(mockTheme.fg).toHaveBeenCalledWith("text", "first task");

    // Second item: in_progress
    expect(mockTheme.fg).toHaveBeenCalledWith("warning", "●");
    expect(mockTheme.fg).toHaveBeenCalledWith("accent", "[1]");
    expect(mockTheme.fg).toHaveBeenCalledWith("text", "second task");

    // Third item: completed (strikethrough)
    expect(mockTheme.fg).toHaveBeenCalledWith("success", "✓");
    expect(mockTheme.fg).toHaveBeenCalledWith("accent", "[2]");
    expect(mockTheme.strikethrough).toHaveBeenCalledWith("third task");
    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "~~third task~~");
  });

  it("handles single item correctly", () => {
    const todos: TodoItem[] = [{ text: "my task", status: "not_started" }];
    renderTodoList(todos, mockTheme);
    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "–");
    expect(mockTheme.fg).toHaveBeenCalledWith("accent", "[0]");
    expect(mockTheme.fg).toHaveBeenCalledWith("text", "my task");
  });

  it("handles items with abandoned status", () => {
    const todos: TodoItem[] = [{ text: "abandoned task", status: "abandoned" }];
    renderTodoList(todos, mockTheme);
    expect(mockTheme.fg).toHaveBeenCalledWith("error", "✗");
    expect(mockTheme.strikethrough).toHaveBeenCalledWith("abandoned task");
    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "~~abandoned task~~");
  });
});

describe("renderToolResult", () => {
  let mockTheme: ReturnType<typeof createMockTheme>;

  beforeEach(() => {
    mockTheme = createMockTheme();
  });

  it("returns Text with content text when no details", () => {
    const result = { content: [{ type: "text", text: "some text" }] };
    const rendered = renderToolResult(result, { expanded: false, isPartial: false }, mockTheme, {});

    const renderedLines = rendered.render(100);
    const firstLine = renderedLines[0];
    expect(firstLine).toMatch(/^some text\s*$/);
  });

  it("calls theme.fg with error styling when details.error is set", () => {
    const result = {
      content: [{ type: "text", text: "error message" }],
      details: {
        action: "write" as const,
        todos: [],
        error: "something went wrong",
      },
    };

    renderToolResult(result, { expanded: false, isPartial: false }, mockTheme, {});

    expect(mockTheme.fg).toHaveBeenCalledWith("error", "Error: something went wrong");
  });

  it("renders todo list via theme calls when details has todos", () => {
    const todos: TodoItem[] = [
      { text: "first task", status: "not_started" },
      { text: "second task", status: "completed" },
    ];

    const result = {
      content: [{ type: "text", text: "wrote todos" }],
      details: { action: "write" as const, todos },
    };

    renderToolResult(result, { expanded: false, isPartial: false }, mockTheme, {});

    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "–");
    expect(mockTheme.fg).toHaveBeenCalledWith("accent", "[0]");
    expect(mockTheme.fg).toHaveBeenCalledWith("text", "first task");
    expect(mockTheme.fg).toHaveBeenCalledWith("success", "✓");
    expect(mockTheme.fg).toHaveBeenCalledWith("accent", "[1]");
    expect(mockTheme.strikethrough).toHaveBeenCalledWith("second task");
    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "~~second task~~");
  });

  it("calls theme.fg('dim', 'No todos') when details has empty todos array", () => {
    const result = {
      content: [{ type: "text", text: "list" }],
      details: { action: "list" as const, todos: [] },
    };

    renderToolResult(result, { expanded: false, isPartial: false }, mockTheme, {});

    expect(mockTheme.fg).toHaveBeenCalledWith("dim", "No todos");
  });

  it("handles result with empty content array", () => {
    const result = { content: [] };
    const rendered = renderToolResult(result, { expanded: false, isPartial: false }, mockTheme, {});
    const renderedLines = rendered.render(100);
    expect(renderedLines).toEqual([]);
  });

  it("ignores options parameter", () => {
    const todos: TodoItem[] = [{ text: "task", status: "not_started" }];
    const result = {
      content: [{ type: "text", text: "wrote" }],
      details: { action: "write" as const, todos },
    };

    const expanded = renderToolResult(result, { expanded: true, isPartial: false }, mockTheme, {});
    const notExpanded = renderToolResult(
      result,
      { expanded: false, isPartial: false },
      mockTheme,
      {},
    );

    expect(expanded.render(100)).toEqual(notExpanded.render(100));
  });

  it("handles content element with no text property", () => {
    const result = { content: [{ type: "text" }] };
    const rendered = renderToolResult(result, { expanded: false, isPartial: false }, mockTheme, {});
    const renderedLines = rendered.render(100);
    expect(renderedLines).toEqual([]);
  });
});

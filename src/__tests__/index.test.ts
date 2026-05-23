import { describe, it, expect, vi } from "vitest";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// ── Module mocks ──

vi.mock("../events", () => ({
  registerMessageRenderers: vi.fn(),
  registerEventHandlers: vi.fn(),
  clearCountdown: vi.fn(),
}));

vi.mock("../state", () => ({
  resetState: vi.fn(),
}));

vi.mock("../tools", () => ({
  createWriteTodosTool: vi.fn(() => ({ name: "write_todos", label: "Write Todos" })),
  createListTodosTool: vi.fn(() => ({ name: "list_todos", label: "List Todos" })),
  createEditTodosTool: vi.fn(() => ({ name: "edit_todos", label: "Edit Todos" })),
}));

// Import after mocks are set up
import extensionFactory from "../index";
import { registerMessageRenderers, registerEventHandlers, clearCountdown } from "../events";
import { resetState } from "../state";

// ── Helpers ──

/** Build a mock ExtensionAPI with all methods stubbed. */
function mockAPI(): ExtensionAPI {
  return {
    registerTool: vi.fn(),
    on: vi.fn(),
    registerMessageRenderer: vi.fn(),
  } as unknown as ExtensionAPI;
}

/** Extract a registered event handler by event name from `api.on` calls. */
function getEventHandler(
  api: ExtensionAPI,
  eventName: string,
): (event: unknown, ctx: ExtensionContext) => void {
  const on = api.on as ReturnType<typeof vi.fn>;
  const call = on.mock.calls.find((c) => c[0] === eventName);
  if (!call) throw new Error(`No handler registered for "${eventName}"`);
  return call[1]!;
}

// ────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────

describe("default export (extension factory)", () => {
  // ── Tool registration ──

  it("registers exactly 3 tools", () => {
    const api = mockAPI();
    extensionFactory(api);

    const registerTool = api.registerTool as ReturnType<typeof vi.fn>;
    expect(registerTool).toHaveBeenCalledTimes(3);
  });

  it("registers tools with correct names", () => {
    const api = mockAPI();
    extensionFactory(api);

    const registerTool = api.registerTool as ReturnType<typeof vi.fn>;
    const toolNames = registerTool.mock.calls.map((call) => {
      const tool = call[0] as { name: string };
      return tool.name;
    });

    expect(toolNames).toEqual(expect.arrayContaining(["write_todos", "list_todos", "edit_todos"]));
  });

  it("registers tool objects with expected name and label properties", () => {
    const api = mockAPI();
    extensionFactory(api);

    const registerTool = api.registerTool as ReturnType<typeof vi.fn>;
    const tools = registerTool.mock.calls.map((call) => call[0] as Record<string, unknown>);

    const writeTool = tools.find((t) => t["name"] === "write_todos");
    const listTool = tools.find((t) => t["name"] === "list_todos");
    const editTool = tools.find((t) => t["name"] === "edit_todos");

    expect(writeTool).toBeDefined();
    expect(writeTool!["label"]).toBe("Write Todos");

    expect(listTool).toBeDefined();
    expect(listTool!["label"]).toBe("List Todos");

    expect(editTool).toBeDefined();
    expect(editTool!["label"]).toBe("Edit Todos");
  });

  // ── Message renderer delegation ──

  it("calls registerMessageRenderers with the api", () => {
    const api = mockAPI();
    extensionFactory(api);

    expect(registerMessageRenderers).toHaveBeenCalledWith(api);
  });

  // ── Event handler delegation ──

  it("calls registerEventHandlers with the api", () => {
    const api = mockAPI();
    extensionFactory(api);

    expect(registerEventHandlers).toHaveBeenCalledWith(api);
  });

  // ── session_shutdown handler ──

  it("registers a session_shutdown event handler via pi.on", () => {
    const api = mockAPI();
    extensionFactory(api);

    const on = api.on as ReturnType<typeof vi.fn>;
    const eventNames = on.mock.calls.map((call) => call[0]);
    expect(eventNames).toContain("session_shutdown");
  });

  it("session_shutdown handler calls clearCountdown and resetState", () => {
    const api = mockAPI();
    extensionFactory(api);

    const handler = getEventHandler(api, "session_shutdown");

    // Clear mock call history from the factory invocation
    vi.mocked(clearCountdown).mockClear();
    vi.mocked(resetState).mockClear();

    const mockCtx = {} as ExtensionContext;
    handler({}, mockCtx);

    expect(clearCountdown).toHaveBeenCalledWith(mockCtx);
    expect(resetState).toHaveBeenCalled();
  });
});

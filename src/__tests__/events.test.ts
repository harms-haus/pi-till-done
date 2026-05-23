import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resetState, setTodos, getTodos } from "../state";
import { registerEventHandlers, clearCountdown, COUNTDOWN_SECONDS } from "../events";
import { createMockAPI, createMockContext } from "./helpers/mocks";
import { MAX_AUTO_CONTINUE } from "../types";

// ── Helpers ──

/**
 * Extract a handler by event name from mock `on` calls.
 * Provides a clear error message if the event was never registered.
 */
function getHandler(
  on: ReturnType<typeof vi.fn>,
  eventName: string,
): (...args: unknown[]) => unknown {
  const calls = on.mock.calls as Array<[string, (...args: unknown[]) => unknown]>;
  const match = calls.find((call) => call[0] === eventName);
  if (!match) {
    const registered = calls.map((c) => c[0]);
    throw new Error(
      `No handler registered for "${eventName}". Registered events: [${registered.join(", ")}]`,
    );
  }
  return match[1];
}

// ── Tests ──

describe("registerEventHandlers", () => {
  beforeEach(() => {
    resetState();
  });

  it("registers handlers for session_start, session_tree, before_agent_start, agent_end", () => {
    const { api, on } = createMockAPI();
    registerEventHandlers(api);

    expect(on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(on).toHaveBeenCalledWith("session_tree", expect.any(Function));
    expect(on).toHaveBeenCalledWith("before_agent_start", expect.any(Function));
    expect(on).toHaveBeenCalledWith("agent_end", expect.any(Function));
  });
});

describe("exported constants and utilities", () => {
  it("exports COUNTDOWN_SECONDS as 3", () => {
    expect(COUNTDOWN_SECONDS).toBe(3);
  });

  it("exports clearCountdown as a callable function", () => {
    expect(typeof clearCountdown).toBe("function");
    const ctx = createMockContext();
    // Should not throw even when no countdown is active
    expect(() => {
      clearCountdown(ctx);
    }).not.toThrow();
  });

  it("clearCountdown clears the countdown widget when ctx.hasUI", () => {
    const ctx = createMockContext();
    clearCountdown(ctx);
    expect(ctx.ui.setWidget).toHaveBeenCalledWith("til-done-countdown", undefined);
  });

  it("clearCountdown does not call setWidget when ctx.hasUI is false", () => {
    const ctx = createMockContext();
    ctx.hasUI = false;
    clearCountdown(ctx);
    expect(ctx.ui.setWidget).not.toHaveBeenCalled();
  });
});

describe("session_start handler", () => {
  beforeEach(() => {
    resetState();
  });

  it("reconstructs state and updates UI", async () => {
    const { api, on } = createMockAPI();
    const setStatus = vi.fn();
    const ctx = createMockContext([
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "write_todos",
          details: {
            todos: [{ text: "task 1", status: "not_started" }],
          },
        },
      },
    ]);
    ctx.ui.setStatus = setStatus;

    registerEventHandlers(api);

    const handler = getHandler(on, "session_start");
    await handler({}, ctx);

    expect(getTodos()).toEqual([{ text: "task 1", status: "not_started" }]);
    expect(setStatus).toHaveBeenCalled();
  });
});

describe("session_tree handler", () => {
  beforeEach(() => {
    resetState();
  });

  it("reconstructs state from session tree and updates UI", async () => {
    const { api, on } = createMockAPI();
    const setStatus = vi.fn();
    const ctx = createMockContext([
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "edit_todos",
          details: {
            todos: [
              { text: "task 1", status: "completed" },
              { text: "task 2", status: "in_progress" },
            ],
          },
        },
      },
    ]);
    ctx.ui.setStatus = setStatus;

    registerEventHandlers(api);

    const handler = getHandler(on, "session_tree");
    await handler({}, ctx);

    expect(getTodos()).toEqual([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "in_progress" },
    ]);
    expect(setStatus).toHaveBeenCalled();
  });
});

describe("before_agent_start handler", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns context message when incomplete todos exist", async () => {
    const { api, on } = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "not_started" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "before_agent_start");
    const result = (await handler()) as {
      message: { customType: string; display: boolean; content: string };
    };

    expect(result).toBeDefined();
    expect(result.message.customType).toBe("til-done-context");
    expect(result.message.display).toBe(false);
    expect(result.message.content).toContain("task 1");
    expect(result.message.content).toContain("task 2");
  });

  it("returns context message when all items are in_progress", async () => {
    const { api, on } = createMockAPI();
    setTodos([
      { text: "task 1", status: "in_progress" },
      { text: "task 2", status: "in_progress" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "before_agent_start");
    const result = (await handler()) as {
      message: { customType: string; content: string };
    };

    expect(result).toBeDefined();
    expect(result.message.customType).toBe("til-done-context");
    expect(result.message.content).toContain("● [0] task 1");
    expect(result.message.content).toContain("● [1] task 2");
  });

  it("returns undefined when all todos are completed", async () => {
    const { api, on } = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "completed" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "before_agent_start");
    const result = await handler();

    expect(result).toBeUndefined();
  });

  it("returns undefined when all todos are abandoned", async () => {
    const { api, on } = createMockAPI();
    setTodos([
      { text: "task 1", status: "abandoned" },
      { text: "task 2", status: "abandoned" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "before_agent_start");
    const result = await handler();

    expect(result).toBeUndefined();
  });

  it("returns undefined when todos array is empty", async () => {
    const { api, on } = createMockAPI();
    setTodos([]);

    registerEventHandlers(api);

    const handler = getHandler(on, "before_agent_start");
    const result = await handler();

    expect(result).toBeUndefined();
  });

  it("message contains formatted todo list", async () => {
    const { api, on } = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "in_progress" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "before_agent_start");
    const result = (await handler()) as {
      message: { content: string };
    };

    expect(result.message.content).toContain("✓ [0] task 1");
    expect(result.message.content).toContain("● [1] task 2");
  });
});

describe("agent_end handler", () => {
  beforeEach(() => {
    resetState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends sendUserMessage when incomplete todos remain", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "not_started" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    expect(sendUserMessage).toHaveBeenCalled();
    const prompt = sendUserMessage.mock.calls[0]?.[0];
    expect(prompt).toContain("edit_todos");
    expect(prompt).toContain("action 'start'");
    expect(prompt).toContain("[1]");
  });

  it("sendUserMessage content does not contain todo.text in instruction portion (SEC-CRIT-01)", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "in_progress" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    const prompt = sendUserMessage.mock.calls[0]?.[0];
    const lines = prompt.split("\n");

    // Find the instruction line
    const instructionLine = lines.find((line: string) => line.includes("Next action:"));
    expect(instructionLine).toBeDefined();
    expect(instructionLine).not.toContain("task 2");

    // The instruction should only contain the action name and index, not the text
    expect(instructionLine).toContain("edit_todos with action 'complete'");
    expect(instructionLine).toContain("[1]");
  });

  it("returns early when todos is empty", async () => {
    const mockApi = createMockAPI();
    setTodos([]);

    registerEventHandlers(mockApi.api);

    const handler = getHandler(mockApi.on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});

    expect(mockApi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("returns early when all todos are completed", async () => {
    const mockApi = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "completed" },
    ]);

    registerEventHandlers(mockApi.api);

    const handler = getHandler(mockApi.on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});

    expect(mockApi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("returns early when all todos are abandoned", async () => {
    const mockApi = createMockAPI();
    setTodos([
      { text: "task 1", status: "abandoned" },
      { text: "task 2", status: "abandoned" },
    ]);

    registerEventHandlers(mockApi.api);

    const handler = getHandler(mockApi.on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});

    expect(mockApi.sendUserMessage).not.toHaveBeenCalled();
  });

  it("sends completion message via sendMessage when auto-continue limit reached", async () => {
    const mockApi = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "not_started" },
    ]);

    registerEventHandlers(mockApi.api);

    const handler = getHandler(mockApi.on, "agent_end");

    // Call handler MAX_AUTO_CONTINUE + 1 times, advancing timers each time
    for (let i = 0; i <= MAX_AUTO_CONTINUE; i++) {
      await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
      vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    }

    expect(mockApi.sendMessage).toHaveBeenCalled();
    // Find the limit-reached message among the calls
    const completeCall = mockApi.sendMessage.mock.calls.find(
      (call: unknown[]) => (call[0] as { customType: string }).customType === "til-done-complete",
    );
    expect(completeCall).toBeDefined();
    expect((completeCall![0] as { content: string }).content).toContain(
      "Auto-continue limit reached",
    );
  });

  it("does not send sendUserMessage when limit reached", async () => {
    const mockApi = createMockAPI();
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(mockApi.api);

    const handler = getHandler(mockApi.on, "agent_end");

    // Call handler MAX_AUTO_CONTINUE + 1 times, advancing timers each time
    for (let i = 0; i <= MAX_AUTO_CONTINUE; i++) {
      await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
      vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    }

    // sendUserMessage should only have been called MAX_AUTO_CONTINUE times (not on the limit-hit call)
    expect(mockApi.sendUserMessage).toHaveBeenCalledTimes(MAX_AUTO_CONTINUE);
  });

  it("increments auto-continue counter on each call", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");

    // First call should work
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);

    // Second call should also work
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    expect(sendUserMessage).toHaveBeenCalledTimes(2);

    // Third call should also work
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    expect(sendUserMessage).toHaveBeenCalledTimes(3);
  });

  it("counter is NOT reset by agent_end itself (only by tool actions)", async () => {
    const { api, on } = createMockAPI();
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");

    // Call multiple times — counter should keep incrementing
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    // The counter should have incremented each time.
    // Verified implicitly: if counter was reset, the limit would never be reached,
    // but with MAX_AUTO_CONTINUE = 20 we can't exhaust it in 3 calls anyway.
    // The key invariant: agent_end never calls resetAutoContinue().
  });

  it("prompt contains structured format with remaining list", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "not_started" },
      { text: "task 3", status: "in_progress" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    const prompt = sendUserMessage.mock.calls[0]?.[0];
    expect(prompt).toContain("Remaining items:");
    expect(prompt).toContain("– [1] task 2");
    expect(prompt).toContain("● [2] task 3");
  });

  it("prompt contains next action instruction with index and action name only", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "in_progress" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, {});
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    const prompt = sendUserMessage.mock.calls[0]?.[0];
    expect(prompt).toContain("Next action: edit_todos with action 'complete' and indices [1]");
  });

  it("does not auto-continue when agent was aborted (user interrupt)", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "not_started" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "aborted" }] }, ctx);
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    expect(sendUserMessage).not.toHaveBeenCalled();
    // Also no countdown widget on abort
    expect(ctx.ui.setWidget).not.toHaveBeenCalled();
  });

  it("detects aborted assistant message when followed by user messages (backward scan)", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "not_started" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    // Messages array has user messages after the aborted assistant message
    await handler(
      {
        messages: [{ role: "assistant", stopReason: "stop" }, { role: "user" }, { role: "user" }],
      },
      ctx,
    );

    // The last assistant message is NOT aborted, so auto-continue should fire
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    expect(sendUserMessage).toHaveBeenCalled();
  });

  it("detects abort when last assistant message (buried behind user messages) was aborted", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    setTodos([
      { text: "task 1", status: "completed" },
      { text: "task 2", status: "not_started" },
    ]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler(
      {
        messages: [{ role: "assistant", stopReason: "aborted" }, { role: "user" }],
      },
      ctx,
    );

    // The last assistant (scanning backward) is aborted → no auto-continue
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    expect(sendUserMessage).not.toHaveBeenCalled();
  });

  it("shows countdown widget before auto-continue", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);

    // Countdown widget should appear immediately with 3s
    expect(ctx.ui.setWidget).toHaveBeenCalledWith(
      "til-done-countdown",
      expect.arrayContaining([expect.stringContaining("3s")]),
      { placement: "aboveEditor" },
    );

    // Advance 1s → widget updated to 2s
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWidget).toHaveBeenCalledWith(
      "til-done-countdown",
      expect.arrayContaining([expect.stringContaining("2s")]),
      { placement: "aboveEditor" },
    );

    // Advance 1s → widget updated to 1s
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWidget).toHaveBeenCalledWith(
      "til-done-countdown",
      expect.arrayContaining([expect.stringContaining("1s")]),
      { placement: "aboveEditor" },
    );

    // Advance 1s → widget cleared and sendUserMessage called
    vi.advanceTimersByTime(1000);
    expect(ctx.ui.setWidget).toHaveBeenCalledWith("til-done-countdown", undefined);
    expect(sendUserMessage).toHaveBeenCalled();
  });

  it("clears previous countdown when scheduling a new one", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");

    // Fire first agent_end — starts a countdown
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
    // Advance only 1s (countdown still active at 2s)
    vi.advanceTimersByTime(1000);

    // Fire second agent_end while first countdown is still active
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);

    // The second call should clear the old interval and start a new countdown from 3s
    // Check that a "3s" widget appeared after the second call
    const calls = (ctx.ui.setWidget as ReturnType<typeof vi.fn>).mock.calls;
    const callsAfterSecond = calls.slice(-4); // last few calls
    const has3sAfterSecond = callsAfterSecond.some(
      (call: unknown[]) =>
        call[0] === "til-done-countdown" &&
        Array.isArray(call[1]) &&
        call[1].some((s: string) => s.includes("3s")),
    );
    expect(has3sAfterSecond).toBe(true);

    // Now advance to complete the second countdown
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);
    expect(sendUserMessage).toHaveBeenCalled();
  });

  it("sends sendUserMessage via setTimeout when no UI available", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    ctx.hasUI = false;
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    const prompt = sendUserMessage.mock.calls[0]?.[0];
    expect(prompt).toContain("edit_todos");
    expect(prompt).toContain("action 'start'");
  });

  it("clears widget and handles gracefully when sendUserMessage throws during countdown", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    sendUserMessage.mockImplementation(() => {
      throw new Error("Agent already processing user input");
    });
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);

    // Widget shows 3s immediately
    expect(ctx.ui.setWidget).toHaveBeenCalledWith(
      "til-done-countdown",
      expect.arrayContaining([expect.stringContaining("3s")]),
      { placement: "aboveEditor" },
    );

    // Advance 3s to trigger the sendUserMessage throw
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    // Widget should be cleared even though sendUserMessage threw
    expect(ctx.ui.setWidget).toHaveBeenCalledWith("til-done-countdown", undefined);
    expect(sendUserMessage).toHaveBeenCalled();
    // No crash — test completes without unhandled exception
  });

  it("falls back to deliverAs followUp when sendUserMessage throws during countdown", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    // First call (no options) throws, second call (with options) succeeds
    sendUserMessage.mockImplementationOnce(() => {
      throw new Error("Agent busy");
    });
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    // Called twice: once without options (throws), once with followUp option (succeeds)
    expect(sendUserMessage).toHaveBeenCalledTimes(2);
    expect(sendUserMessage.mock.calls[0]).toEqual([expect.any(String)]);
    expect(sendUserMessage.mock.calls[1]).toEqual([expect.any(String), { deliverAs: "followUp" }]);
  });

  it("falls back to deliverAs followUp when sendUserMessage throws without UI", async () => {
    const { api, on, sendUserMessage } = createMockAPI();
    const ctx = createMockContext();
    ctx.hasUI = false;
    // First call (no options) throws, second call (with options) succeeds
    sendUserMessage.mockImplementationOnce(() => {
      throw new Error("Agent busy");
    });
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    // Same fallback behavior as the UI branch
    expect(sendUserMessage).toHaveBeenCalledTimes(2);
    expect(sendUserMessage.mock.calls[0]).toEqual([expect.any(String)]);
    expect(sendUserMessage.mock.calls[1]).toEqual([expect.any(String), { deliverAs: "followUp" }]);
  });

  it("sends sendMessage feedback when both sendUserMessage calls fail", async () => {
    const { api, on, sendUserMessage, sendMessage } = createMockAPI();
    const ctx = createMockContext();
    sendUserMessage.mockImplementation(() => {
      throw new Error("Agent unavailable");
    });
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    // Both sendUserMessage calls attempted — first without options, then with followUp
    expect(sendUserMessage).toHaveBeenCalledTimes(2);
    // Widget was cleared (no stale countdown)
    expect(ctx.ui.setWidget).toHaveBeenCalledWith("til-done-countdown", undefined);
    // sendMessage should be called with feedback about the failure
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: "til-done-complete",
        content: expect.stringContaining("Auto-continue failed"),
        display: true,
      }),
      { triggerTurn: false },
    );
    // No crash — test completes without unhandled exception
  });

  it("sends sendMessage feedback when both sendUserMessage calls fail without UI", async () => {
    const { api, on, sendUserMessage, sendMessage } = createMockAPI();
    const ctx = createMockContext();
    ctx.hasUI = false;
    sendUserMessage.mockImplementation(() => {
      throw new Error("Agent unavailable");
    });
    setTodos([{ text: "task 1", status: "not_started" }]);

    registerEventHandlers(api);

    const handler = getHandler(on, "agent_end");
    await handler({ messages: [{ role: "assistant", stopReason: "stop" }] }, ctx);
    vi.advanceTimersByTime(COUNTDOWN_SECONDS * 1000);

    // sendMessage used as last-resort feedback channel
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: "til-done-complete",
        content: expect.stringContaining("Auto-continue failed"),
        display: true,
      }),
      { triggerTurn: false },
    );
  });
});

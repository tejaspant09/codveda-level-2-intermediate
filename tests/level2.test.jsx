import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.jsx";

const person = (login) => ({
  login,
  html_url: `https://github.com/${login}`,
  avatar_url: `https://avatars.githubusercontent.com/u/1`,
});
const response = (items = [], total = items.length) => ({
  ok: true,
  json: async () => ({ items, total_count: total }),
});
function mount() {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}
function search(value) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
}
async function tick(ms = 400) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DevFinder public search", () => {
  it("requires two characters, debounces and encodes the final query", async () => {
    fetch.mockResolvedValue(response([person("octocat")], 42));
    mount();
    search("a");
    await tick(500);
    expect(fetch).not.toHaveBeenCalled();
    search("location:New York");
    await tick(200);
    search("language:C++");
    await tick(399);
    expect(fetch).not.toHaveBeenCalled();
    await tick(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(
      "https://api.github.com/search/users?q=language%3AC%2B%2B&per_page=12",
    );
    expect(screen.getByRole("link", { name: /octocat/ })).toBeTruthy();
    expect(screen.getByText(/results · showing 1/).textContent).toContain("42");
  });
  it("renders an empty response without invented people", async () => {
    fetch.mockResolvedValue(response());
    mount();
    search("nobody");
    await tick();
    expect(
      screen.getByRole("heading", { name: "No people found" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Save / })).toBeNull();
  });
  it("renders a failure and retries the current search", async () => {
    fetch
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(response([person("retry-user")]));
    mount();
    search("retry");
    await tick();
    expect(screen.getByRole("alert").textContent).toContain(
      "We couldn’t load people",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry search" }));
    await tick();
    expect(screen.getByRole("link", { name: /retry-user/ })).toBeTruthy();
  });
  it.each([403, 429])("explains GitHub rate limits for %s", async (status) => {
    fetch.mockResolvedValue({ ok: false, status });
    mount();
    search("github");
    await tick();
    expect(screen.getByRole("alert").textContent).toContain(
      "GitHub is limiting requests",
    );
    expect(screen.getByRole("button", { name: "Retry search" })).toBeTruthy();
  });
  it("shows an offline message after a failed request while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fetch.mockRejectedValue(new Error("offline"));
    mount();
    search("offline");
    await tick();
    expect(screen.getByRole("alert").textContent).toContain(
      "You appear to be offline",
    );
  });
  it("suppresses an older response even if the fetch ignores abort", async () => {
    let resolveOld;
    fetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce(response([person("new-person")]));
    mount();
    search("old");
    await tick();
    const oldSignal = fetch.mock.calls[0][1].signal;
    search("new");
    expect(oldSignal.aborted).toBe(true);
    await tick();
    await act(async () => {
      resolveOld(response([person("old-person")]));
    });
    expect(screen.getByRole("link", { name: /new-person/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /old-person/ })).toBeNull();
  });
  it("saves a person across routes and persists the list", async () => {
    fetch.mockResolvedValue(response([person("octocat")]));
    mount();
    search("octo");
    await tick();
    const saveButton = screen.getByRole("button", { name: "Save octocat" });
    expect(saveButton).toHaveTextContent(/^Save$/);
    fireEvent.click(saveButton);
    expect(screen.getByRole("button", { name: "Remove octocat" })).toHaveTextContent(/^Remove$/);
    fireEvent.click(screen.getByRole("link", { name: /^About$/ }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "discovery",
    );
    fireEvent.click(screen.getByRole("link", { name: /^Saved 1$/ }));
    expect(screen.getByRole("link", { name: /octocat/ })).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("devfinder.saved.v1"))[0].login,
    ).toBe("octocat");
    fireEvent.click(screen.getByRole("button", { name: "Remove octocat" }));
    expect(
      screen.getByRole("heading", { name: "Your shortlist is ready." }),
    ).toBeTruthy();
  });
  it("recovers from corrupt storage and excludes unsafe profile links", () => {
    localStorage.setItem("devfinder.saved.v1", "{broken");
    mount();
    expect(screen.getByRole("link", { name: "Saved 0" })).toBeTruthy();
    cleanup();
    localStorage.setItem(
      "devfinder.saved.v1",
      JSON.stringify([
        { login: "unsafe", html_url: "javascript:alert(1)" },
        person("safe"),
      ]),
    );
    mount();
    fireEvent.click(screen.getByRole("link", { name: "Saved 1" }));
    expect(screen.getByRole("link", { name: /safe/ })).toBeTruthy();
    expect(screen.queryByText("unsafe")).toBeNull();
  });
  it("validates the contact form and gives honest demo feedback", () => {
    mount();
    fireEvent.click(screen.getByRole("link", { name: "Contact" }));
    fireEvent.click(screen.getByRole("button", { name: "Check message" }));
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Ada" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ada@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "A useful little discovery tool." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check message" }));
    expect(screen.getByRole("status").textContent).toContain(
      "nothing was sent",
    );
  });
});

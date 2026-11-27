// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navbar from "./Navbar";
import { fetchJSON } from "../../lib/api/httpClient";

const { navigateMock, authState } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  authState: { userId: "notification-user" },
}));

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/dashboard" }),
  useNavigate: () => navigateMock,
}));

vi.mock("../../lib/api/httpClient", () => ({
  fetchJSON: vi.fn(),
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: (selector: (state: { currentUser: { id: string } }) => unknown) =>
    selector({ currentUser: { id: authState.userId } }),
}));

const inbox = {
  items: [
    {
      id: "notification-1",
      source: "general" as const,
      category: "FUEL" as const,
      title: "Fuel efficiency anomaly",
      message: "TGD 908 is below its rolling average.",
      severity: "warning",
      isRead: false,
      createdAt: "2026-11-28T01:00:00.000Z",
      actionTarget: { type: "FUEL_MANAGEMENT", id: "anomaly-1" },
    },
  ],
  nextCursor: "older-page",
  counts: { total: 34, unread: 2 },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Navbar notifications inbox", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    authState.userId = "notification-user";
    vi.mocked(fetchJSON).mockResolvedValue(inbox);
  });

  it("uses server unread counts and supports mark-all-read and pagination", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await waitFor(() => {
      expect(fetchJSON).toHaveBeenCalledWith(
        expect.stringContaining("/notifications/inbox?"),
      );
    });
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Notifications, 2 unread" }));
    expect(await screen.findByText("2 unread · 34 total")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(fetchJSON).toHaveBeenCalledWith("/notifications/inbox/read-all", {
      method: "PATCH",
    });

    await user.click(screen.getByRole("button", { name: "Load older notifications" }));
    await waitFor(() => {
      expect(fetchJSON).toHaveBeenCalledWith(
        expect.stringContaining("cursor=older-page"),
      );
    });
  });

  it("applies category and read filters without carrying forward a page cursor", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    await user.selectOptions(screen.getByLabelText("Filter by category"), "FUEL");
    await user.selectOptions(screen.getByLabelText("Filter by read state"), "UNREAD");

    await waitFor(() => {
      const requestUrls = vi.mocked(fetchJSON).mock.calls
        .map(([url]) => url)
        .filter((url): url is string => typeof url === "string");
      const filteredRequest = requestUrls.find((url) => {
        const params = new URLSearchParams(url.split("?")[1]);
        return params.get("category") === "FUEL" && params.get("readState") === "UNREAD";
      });

      expect(filteredRequest).toBeTruthy();
      expect(new URLSearchParams(filteredRequest?.split("?")[1]).has("cursor")).toBe(false);
    });
  });

  it("hides the previous account inbox while the new account is loading", async () => {
    const user = userEvent.setup();
    let resolveSecondPage!: (response: typeof inbox) => void;
    const secondPage = new Promise<typeof inbox>((resolve) => {
      resolveSecondPage = resolve;
    });
    vi.mocked(fetchJSON)
      .mockResolvedValueOnce(inbox)
      .mockReturnValueOnce(secondPage);
    const view = render(<Navbar />);

    await user.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    expect(await screen.findByText("Fuel efficiency anomaly")).toBeTruthy();

    authState.userId = "another-user";
    view.rerender(<Navbar />);
    expect(screen.queryByText("Fuel efficiency anomaly")).toBeNull();
    await waitFor(() => expect(fetchJSON).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecondPage({
        ...inbox,
        items: [{ ...inbox.items[0], title: "Another account notice" }],
      });
    });
    expect(await screen.findByText("Another account notice")).toBeTruthy();
  });

  it("ignores a pending response from the previous account", async () => {
    const user = userEvent.setup();
    const firstPage = deferred<typeof inbox>();
    const secondPage = deferred<typeof inbox>();
    vi.mocked(fetchJSON)
      .mockReturnValueOnce(firstPage.promise)
      .mockReturnValueOnce(secondPage.promise);
    const view = render(<Navbar />);

    await user.click(await screen.findByRole("button", { name: "Notifications" }));
    authState.userId = "another-user";
    view.rerender(<Navbar />);
    await waitFor(() => expect(fetchJSON).toHaveBeenCalledTimes(2));

    await act(async () => firstPage.resolve(inbox));
    expect(screen.queryByText("Fuel efficiency anomaly")).toBeNull();

    await act(async () => {
      secondPage.resolve({
        ...inbox,
        items: [{ ...inbox.items[0], title: "Another account notice" }],
      });
    });
    expect(await screen.findByText("Another account notice")).toBeTruthy();
  });

  it("shows a retryable error and follows only known action targets", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchJSON)
      .mockRejectedValueOnce(new Error("Inbox unavailable"))
      .mockResolvedValueOnce(inbox)
      .mockResolvedValue({ updated: 1 });
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Inbox unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await user.click(await screen.findByRole("button", { name: /Fuel efficiency anomaly/ }));

    expect(navigateMock).toHaveBeenCalledWith("/fuel-management");
    expect(fetchJSON).toHaveBeenCalledWith(
      "/notifications/inbox/general/notification-1/read",
      { method: "PATCH" },
    );
  });

  it("clears a mark-read error after the user retries successfully", async () => {
    const user = userEvent.setup();
    const noActionInbox = {
      ...inbox,
      items: [{ ...inbox.items[0], actionTarget: null }],
    };
    vi.mocked(fetchJSON)
      .mockResolvedValueOnce(noActionInbox)
      .mockRejectedValueOnce(new Error("Read update failed"))
      .mockResolvedValueOnce({ updated: 1 });
    render(<Navbar />);

    await user.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    const item = await screen.findByRole("button", {
      name: /Fuel efficiency anomaly.*Mark as read/,
    });
    await user.click(item);
    expect(await screen.findByRole("alert")).toBeTruthy();

    await user.click(item);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("routes report actions without a record ID and ignores unknown action types", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchJSON).mockResolvedValueOnce({
      ...inbox,
      items: [
        { ...inbox.items[0], title: "Daily fleet report", actionTarget: { type: "REPORTS", id: null } },
        { ...inbox.items[0], id: "unknown-action", title: "Unknown action", actionTarget: { type: "UNSUPPORTED", id: "target-1" } },
      ],
    });
    render(<Navbar />);

    await user.click(await screen.findByRole("button", { name: "Notifications, 2 unread" }));
    await user.click(await screen.findByRole("button", { name: /Daily fleet report/ }));
    expect(navigateMock).toHaveBeenCalledWith("/maintenance-reports");
    navigateMock.mockClear();

    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    await user.click(await screen.findByRole("button", { name: /Unknown action/ }));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

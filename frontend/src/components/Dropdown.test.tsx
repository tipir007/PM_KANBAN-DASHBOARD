import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dropdown } from "@/components/Dropdown";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Dropdown", () => {
  it("opens on click and reveals its content", async () => {
    render(
      <Dropdown ariaLabel="Boards menu" label={<span>Boards</span>}>
        {() => <p>Panel content</p>}
      </Dropdown>
    );

    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /boards menu/i }));
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(
      <Dropdown ariaLabel="Boards menu" label={<span>Boards</span>}>
        {() => <p>Panel content</p>}
      </Dropdown>
    );

    await userEvent.click(screen.getByRole("button", { name: /boards menu/i }));
    expect(screen.getByText("Panel content")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
  });

  it("closes when the close callback is invoked", async () => {
    render(
      <Dropdown ariaLabel="Boards menu" label={<span>Boards</span>}>
        {(close) => (
          <button type="button" onClick={close}>
            Pick
          </button>
        )}
      </Dropdown>
    );

    await userEvent.click(screen.getByRole("button", { name: /boards menu/i }));
    await userEvent.click(screen.getByRole("button", { name: "Pick" }));
    expect(screen.queryByRole("button", { name: "Pick" })).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";

const signIn = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText(/username/i), username);
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("AuthGate", () => {
  it("shows error for invalid credentials", async () => {
    render(<AuthGate />);

    await signIn("wrong", "creds");

    expect(screen.getByRole("alert")).toHaveTextContent(
      /invalid credentials/i
    );
  });

  it("renders board after valid login and returns to login on logout", async () => {
    render(<AuthGate />);

    await signIn("user", "password");

    expect(
      screen.getByRole("heading", { name: /kanban studio/i })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /logout/i }));
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
  });
});

import { expect, test } from "@playwright/test";

const login = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for the authenticated workspace to load.
  await expect(page.getByLabel("Board name")).toBeVisible();
};

test("loads the kanban board", async ({ page }) => {
  await login(page);
  await expect(page.getByLabel("Board name")).toHaveValue("My Board");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await login(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("AI chat updates board and refreshes UI", async ({ page }) => {
  await page.route("**/api/ai/chat", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        response: "Added a card in backlog.",
        board_update: {
          columns: [{ id: "col-backlog", title: "Backlog", cardIds: ["card-ai"] }],
          cards: {
            "card-ai": {
              id: "card-ai",
              title: "AI Playwright task",
              details: "Inserted by mocked AI",
            },
          },
        },
      }),
    });
  });

  await login(page);
  await page.getByLabel("Ask AI about your board").fill("Add one task to backlog");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Added a card in backlog.")).toBeVisible();
  await expect(page.getByText("AI Playwright task")).toBeVisible();
});

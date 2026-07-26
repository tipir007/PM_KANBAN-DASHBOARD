import { expect, test, type Page } from "@playwright/test";

const login = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByLabel("Board name", { exact: true })).toBeVisible();
};

// Each mutating test works on its own freshly created board so the suite is
// idempotent against the persistent backend: runs never collide with the seed
// board or with each other. New boards are seeded with three columns
// (Backlog / In Progress / Done) and no cards.
const createFreshBoard = async (page: Page, name: string) => {
  await page.getByRole("button", { name: /new board/i }).click();
  await page.getByLabel("New board name").fill(name);
  await page.getByRole("button", { name: /^create$/i }).click();
  // Creation finished: the create input disappears and the new board is active.
  await expect(page.getByLabel("New board name")).toBeHidden();
  await expect(page.getByLabel("Board name", { exact: true })).toHaveValue(name);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(3);
};

const uniqueName = (prefix: string) => `${prefix}-${Date.now()}`;

test("loads the kanban board", async ({ page }) => {
  await login(page);
  // Default board for the seed user has the five seeded columns.
  await expect(page.getByLabel("Board name", { exact: true })).toHaveValue("My Board");
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await login(page);
  await createFreshBoard(page, uniqueName("e2e-add"));

  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();

  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await login(page);
  await createFreshBoard(page, uniqueName("e2e-move"));

  const columns = page.locator('[data-testid^="column-"]');
  const sourceColumn = columns.nth(0);
  const targetColumn = columns.nth(2);

  // Add a card to the first column, then drag it to the third column.
  await sourceColumn.getByRole("button", { name: /add a card/i }).click();
  await sourceColumn.getByPlaceholder("Card title").fill("Move me");
  await sourceColumn.getByPlaceholder("Details").fill("Dragged via e2e.");
  await sourceColumn.getByRole("button", { name: /add card/i }).click();

  const card = sourceColumn.locator('[data-testid^="card-"]', {
    hasText: "Move me",
  });
  await expect(card).toBeVisible();

  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 160,
    { steps: 12 }
  );
  await page.mouse.up();

  await expect(targetColumn.getByText("Move me")).toBeVisible();
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

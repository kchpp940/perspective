// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
// ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
// ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
// ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
// ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
// ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
// ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
// ┃ This file is part of the Perspective library, distributed under the terms ┃
// ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import { test, expect } from "@perspective-dev/test";
import { gotoBasic, renderAndCapture, restoreChart, waitOneFrame } from "./helpers";

test.describe("Y Bar", () => {
    test.beforeEach(async ({ page }) => {
        await gotoBasic(page);
    });

    test("basic single series", async ({ page }) => {
        await renderAndCapture(page, {
            plugin: "Y Bar",
            columns: ["Sales"],
            group_by: ["Category"],
        });
    });

    test("split_by series colors", async ({ page }) => {
        await renderAndCapture(page, {
            plugin: "Y Bar",
            columns: ["Sales"],
            group_by: ["Category"],
            split_by: ["Region"],
        });
    });

    test("multiple Y columns", async ({ page }) => {
        await renderAndCapture(page, {
            plugin: "Y Bar",
            columns: ["Sales", "Profit"],
            group_by: ["Category"],
        });
    });

    test("nested group_by", async ({ page }) => {
        await renderAndCapture(page, {
            plugin: "Y Bar",
            columns: ["Sales"],
            group_by: ["Region", "Category"],
        });
    });

    test("column sort is converted to row sort when split_by is removed", async ({
        page,
    }) => {
        await restoreChart(page, {
            plugin: "Y Bar",
            columns: ["Sales", "Profit"],
            group_by: ["Category"],
            split_by: ["Region"],
            sort: [
                ["Sales", "col asc"],
                ["Profit", "col desc"],
                ["Category", "asc"],
            ],
        });

        const configBefore = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer") as any;
            return await viewer.getViewConfig();
        });

        expect(configBefore.split_by).toEqual(["Region"]);
        expect(configBefore.sort).toEqual([
            ["Sales", "col asc"],
            ["Profit", "col desc"],
            ["Category", "asc"],
        ]);

        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer") as any;
            await viewer.restore({
                split_by: [],
            });
        });
        await waitOneFrame(page);

        const configAfter = await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer") as any;
            return await viewer.getViewConfig();
        });

        expect(configAfter.split_by).toEqual([]);
        expect(configAfter.sort).toEqual([
            ["Sales", "asc"],
            ["Profit", "desc"],
            ["Category", "asc"],
        ]);
    });
});

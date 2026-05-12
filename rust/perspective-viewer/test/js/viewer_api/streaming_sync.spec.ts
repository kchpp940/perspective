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

import { test, expect } from "../helpers.ts";

async function getDatagridDOMState(page) {
    return await page.evaluate(async () => {
        const viewer = document.querySelector("perspective-viewer");
        if (!viewer) {
            return { error: "viewer not found" };
        }

        const datagrid = viewer.querySelector("perspective-viewer-datagrid");
        if (!datagrid) {
            return { error: "datagrid not found" };
        }

        const regularTable =
            datagrid.shadowRoot?.querySelector("regular-table");
        if (!regularTable) {
            return { error: "regular-table not found" };
        }

        const tbody = regularTable.querySelector("table tbody");
        const thead = regularTable.querySelector("table thead");

        const visibleRowCount = tbody ? tbody.querySelectorAll("tr").length : 0;

        const firstRow = tbody?.querySelector("tr");
        const firstRowCells = firstRow
            ? Array.from(firstRow.querySelectorAll("td")).map((td) =>
                  td.textContent.trim(),
              )
            : [];

        const headerCells = thead
            ? Array.from(thead.querySelectorAll("tr:last-child th")).map((th) =>
                  th.textContent.trim(),
              )
            : [];

        return {
            visibleRowCount,
            firstRowCells,
            headerCells,
            scrollHeight: regularTable.scrollHeight,
            clientHeight: regularTable.clientHeight,
        };
    });
}

async function getViewerInternalState(page) {
    return await page.evaluate(async () => {
        const viewer = document.querySelector("perspective-viewer");
        if (!viewer) {
            return { error: "viewer not found" };
        }

        const view = await viewer.getView();
        const table = await viewer.getTable();

        const [viewNumRows, tableSize, config] = await Promise.all([
            view.num_rows(),
            table.size(),
            viewer.save(),
        ]);

        const csv = await viewer.export("csv");
        const csvLines = csv.trim().split("\n");
        const csvDataRows = csvLines.length - 1;

        const json = await viewer.export("json");
        const jsonData = json as Record<string, any[]>;
        const firstCol = Object.keys(jsonData)[0];
        const jsonRowCount = firstCol ? jsonData[firstCol].length : 0;

        return {
            viewNumRows,
            tableSize,
            csvDataRows,
            jsonRowCount,
            csvHeader: csvLines[0],
            currentPlugin: config.plugin,
        };
    });
}

async function getChartsObservableState(page) {
    return await page.evaluate(async () => {
        const viewer = document.querySelector("perspective-viewer");
        if (!viewer) {
            return { error: "viewer not found" };
        }

        const chartsPlugin = viewer.querySelector(
            "perspective-viewer-webgl-plugin",
        ) as any;
        if (!chartsPlugin) {
            return { error: "charts plugin not found" };
        }

        const result: any = {
            hasChartsPlugin: true,
        };

        const glCanvas =
            chartsPlugin.shadowRoot?.querySelector(".webgl-canvas");
        if (glCanvas) {
            const canvas = glCanvas as HTMLCanvasElement;
            result.canvasWidth = canvas.width;
            result.canvasHeight = canvas.height;
            result.hasCanvas = true;

            const ctx = canvas.getContext("2d");
            if (ctx) {
                const dpr = window.devicePixelRatio || 1;
                const imageData = ctx.getImageData(
                    0,
                    0,
                    Math.min(canvas.width, 100),
                    Math.min(canvas.height, 100),
                );
                let nonTransparentPixels = 0;
                for (let i = 3; i < imageData.data.length; i += 4) {
                    if (imageData.data[i] > 0) {
                        nonTransparentPixels++;
                    }
                }
                result.nonTransparentPixels = nonTransparentPixels;
                result.totalPixels = imageData.data.length / 4;
            }
        } else {
            result.hasCanvas = false;
        }

        const glManager = chartsPlugin._glManager;
        if (glManager) {
            result.hasGlManager = true;
            result.hasGlContext = !!glManager.gl;
            result.uploadedCount = glManager.uploadedCount;
        }

        const chartImpl = chartsPlugin._chartImpl;
        if (chartImpl) {
            result.hasChartImpl = true;
            result.dataCount = chartImpl._dataCount;

            if (chartImpl._xData) {
                const xData = chartImpl._xData as Float32Array;
                result.xDataLength = xData.length;
                let xFiniteCount = 0;
                for (let i = 0; i < xData.length; i++) {
                    if (isFinite(xData[i])) xFiniteCount++;
                }
                result.xFiniteCount = xFiniteCount;
            }

            if (chartImpl._yData) {
                const yData = chartImpl._yData as Float32Array;
                result.yDataLength = yData.length;
                let yFiniteCount = 0;
                for (let i = 0; i < yData.length; i++) {
                    if (isFinite(yData[i])) yFiniteCount++;
                }
                result.yFiniteCount = yFiniteCount;
            }

            if (chartImpl._seriesUploadedCounts) {
                result.seriesUploadedCounts = [
                    ...chartImpl._seriesUploadedCounts,
                ];
                result.totalSeriesUploaded =
                    chartImpl._seriesUploadedCounts.reduce(
                        (a: number, b: number) => a + b,
                        0,
                    );
            }

            result.xMin = chartImpl._xMin;
            result.xMax = chartImpl._xMax;
            result.yMin = chartImpl._yMin;
            result.yMax = chartImpl._yMax;
            result.hasValidDataBounds =
                isFinite(chartImpl._xMin) &&
                isFinite(chartImpl._xMax) &&
                isFinite(chartImpl._yMin) &&
                isFinite(chartImpl._yMax);
        }

        return result;
    });
}

test.describe("Streaming Data Sync (Real DOM Validation)", async () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/rust/perspective-viewer/test/html/blank.html");
        await page.waitForFunction(() => "WORKER" in window);
    });

    test("datagrid: continuous table.update() syncs DOM visible rows with view/export", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            const worker = (window as any).WORKER;

            const table = await worker.table(
                {
                    id: "integer",
                    category: "string",
                    value: "float",
                },
                { index: "id" },
            );

            await viewer.load(table);
            await viewer.restore({
                plugin: "Datagrid",
                columns: ["id", "category", "value"],
                group_by: ["category"],
            });
            await viewer.flush();

            const updateCount = 20;
            for (let i = 0; i < updateCount; i++) {
                await table.update([
                    { id: i, category: "A", value: i * 1.5 },
                    { id: i + 100, category: "B", value: i * 2.5 },
                ]);
            }

            await viewer.flush();
        });

        const domState = await getDatagridDOMState(page);
        const internalState = await getViewerInternalState(page);

        expect(domState.error).toBeUndefined();
        expect(internalState.error).toBeUndefined();

        expect(internalState.viewNumRows).toBe(2);
        expect(internalState.csvDataRows).toBe(2);
        expect(internalState.jsonRowCount).toBe(2);
        expect(internalState.tableSize).toBe(40);

        expect(domState.visibleRowCount).toBeGreaterThanOrEqual(2);
        expect(domState.headerCells).toContain("category");
        expect(domState.headerCells).toContain("value");
    });

    test("datagrid: rapid parallel table.update() syncs all data sources", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            const worker = (window as any).WORKER;

            const table = await worker.table(
                {
                    id: "integer",
                    value: "float",
                    label: "string",
                },
                { index: "id" },
            );

            await viewer.load(table);
            await viewer.restore({
                plugin: "Datagrid",
                columns: ["id", "value", "label"],
            });
            await viewer.flush();

            const updateCount = 50;
            const updates = [];
            for (let i = 0; i < updateCount; i++) {
                updates.push(
                    table.update([
                        { id: i, value: i * 1.1, label: `Item-${i}` },
                    ]),
                );
            }

            await Promise.all(updates);
            await viewer.flush();
        });

        const domState = await getDatagridDOMState(page);
        const internalState = await getViewerInternalState(page);

        expect(domState.error).toBeUndefined();
        expect(internalState.error).toBeUndefined();

        expect(internalState.viewNumRows).toBe(50);
        expect(internalState.csvDataRows).toBe(50);
        expect(internalState.jsonRowCount).toBe(50);
        expect(internalState.tableSize).toBe(50);

        expect(domState.visibleRowCount).toBeGreaterThanOrEqual(1);
        expect(domState.headerCells).toContain("id");
        expect(domState.headerCells).toContain("value");
    });

    test("datagrid: DOM rows match export after streaming updates", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            const worker = (window as any).WORKER;

            const table = await worker.table(
                {
                    id: "integer",
                    name: "string",
                    score: "float",
                },
                { index: "id" },
            );

            await viewer.load(table);
            await viewer.restore({
                plugin: "Datagrid",
                columns: ["id", "name", "score"],
                group_by: ["name"],
            });
            await viewer.flush();

            const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
            for (let batch = 0; batch < 5; batch++) {
                const batchUpdates = [];
                for (let i = 0; i < 10; i++) {
                    const nameIdx = (batch * 10 + i) % names.length;
                    batchUpdates.push(
                        table.update([
                            {
                                id: batch * 10 + i,
                                name: names[nameIdx],
                                score: (batch * 10 + i) * 0.5,
                            },
                        ]),
                    );
                }
                await Promise.all(batchUpdates);
                await viewer.flush();
            }

            await viewer.flush();
        });

        const domState = await getDatagridDOMState(page);
        const internalState = await getViewerInternalState(page);

        expect(domState.error).toBeUndefined();
        expect(internalState.error).toBeUndefined();

        expect(internalState.viewNumRows).toBe(5);
        expect(internalState.csvDataRows).toBe(5);
        expect(internalState.jsonRowCount).toBe(5);
        expect(internalState.tableSize).toBe(50);

        expect(domState.visibleRowCount).toBeGreaterThanOrEqual(5);
        expect(domState.headerCells).toContain("name");
        expect(domState.headerCells).toContain("score");
    });

    test("charts plugin: WebGL observable state matches view/export after streaming", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            const worker = (window as any).WORKER;

            const table = await worker.table({
                category: "string",
                value: "float",
            });

            await viewer.load(table);
            await viewer.restore({
                plugin: "Y Bar",
                columns: ["value"],
                group_by: ["category"],
            });
            await viewer.flush();

            const categories = ["X", "Y", "Z"];
            const updateCount = 30;
            for (let i = 0; i < updateCount; i++) {
                const cat = categories[i % categories.length];
                await table.update([{ category: cat, value: i * 2.0 + 1 }]);
            }

            await viewer.flush();
        });

        await page.waitForFunction(() => {
            const viewer = document.querySelector("perspective-viewer");
            const charts = viewer?.querySelector(
                "perspective-viewer-webgl-plugin",
            );
            return !!charts;
        });

        const internalState = await getViewerInternalState(page);
        const chartsState = await getChartsObservableState(page);

        expect(internalState.error).toBeUndefined();
        expect(internalState.currentPlugin).toBe("Y Bar");
        expect(internalState.viewNumRows).toBe(3);
        expect(internalState.csvDataRows).toBe(3);
        expect(internalState.jsonRowCount).toBe(3);
        expect(internalState.tableSize).toBe(30);

        expect(chartsState.error).toBeUndefined();
        expect(chartsState.hasChartsPlugin).toBe(true);
        expect(chartsState.hasGlManager).toBe(true);
        expect(chartsState.hasGlContext).toBe(true);
        expect(chartsState.hasCanvas).toBe(true);

        expect(chartsState.canvasWidth).toBeGreaterThan(0);
        expect(chartsState.canvasHeight).toBeGreaterThan(0);

        expect(chartsState.hasChartImpl).toBe(true);
        expect(chartsState.hasValidDataBounds).toBe(true);
        expect(chartsState.xMin).not.toBe(Infinity);
        expect(chartsState.xMax).not.toBe(-Infinity);
        expect(chartsState.yMin).not.toBe(Infinity);
        expect(chartsState.yMax).not.toBe(-Infinity);

        expect(chartsState.uploadedCount).toBe(3);
        expect(chartsState.dataCount).toBe(3);
        expect(chartsState.xFiniteCount).toBeGreaterThanOrEqual(3);
        expect(chartsState.yFiniteCount).toBeGreaterThanOrEqual(3);
    });

    test("charts plugin: multiple series observable state matches aggregated view", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            const worker = (window as any).WORKER;

            const table = await worker.table({
                region: "string",
                product: "string",
                sales: "float",
            });

            await viewer.load(table);
            await viewer.restore({
                plugin: "Y Bar",
                columns: ["sales"],
                group_by: ["region"],
                split_by: ["product"],
            });
            await viewer.flush();

            const regions = ["North", "South", "East", "West"];
            const products = ["A", "B", "C"];
            for (let i = 0; i < 60; i++) {
                await table.update([
                    {
                        region: regions[i % regions.length],
                        product: products[i % products.length],
                        sales: i * 5.0 + 10,
                    },
                ]);
            }

            await viewer.flush();
        });

        await page.waitForFunction(() => {
            const viewer = document.querySelector("perspective-viewer");
            const charts = viewer?.querySelector(
                "perspective-viewer-webgl-plugin",
            );
            return !!charts;
        });

        const internalState = await getViewerInternalState(page);
        const chartsState = await getChartsObservableState(page);

        expect(internalState.error).toBeUndefined();
        expect(internalState.viewNumRows).toBe(4);

        expect(chartsState.error).toBeUndefined();
        expect(chartsState.hasChartImpl).toBe(true);
        expect(chartsState.hasValidDataBounds).toBe(true);

        expect(chartsState.seriesUploadedCounts).toBeDefined();
        expect(chartsState.totalSeriesUploaded).toBeGreaterThanOrEqual(
            internalState.viewNumRows,
        );
        expect(chartsState.dataCount).toBe(chartsState.totalSeriesUploaded);

        expect(chartsState.xMin).not.toBe(Infinity);
        expect(chartsState.xMax).not.toBe(-Infinity);
        expect(chartsState.yMin).not.toBe(Infinity);
        expect(chartsState.yMax).not.toBe(-Infinity);
    });

    test("switching plugins preserves sync between render state and export", async ({
        page,
    }) => {
        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            const worker = (window as any).WORKER;

            const table = await worker.table(
                {
                    id: "integer",
                    region: "string",
                    sales: "float",
                },
                { index: "id" },
            );

            await viewer.load(table);
            await viewer.restore({
                plugin: "Datagrid",
                columns: ["id", "region", "sales"],
                group_by: ["region"],
            });
            await viewer.flush();

            const regions = ["North", "South", "East", "West"];
            for (let i = 0; i < 40; i++) {
                await table.update([
                    {
                        id: i,
                        region: regions[i % regions.length],
                        sales: i * 10.0 + 5,
                    },
                ]);
            }
            await viewer.flush();

            await viewer.restore({
                plugin: "Y Bar",
                columns: ["sales"],
                group_by: ["region"],
            });
            await viewer.flush();
        });

        await page.waitForFunction(() => {
            const viewer = document.querySelector("perspective-viewer");
            const charts = viewer?.querySelector(
                "perspective-viewer-webgl-plugin",
            );
            return !!charts;
        });

        const internalState = await getViewerInternalState(page);
        const chartsState = await getChartsObservableState(page);

        expect(internalState.error).toBeUndefined();
        expect(internalState.currentPlugin).toBe("Y Bar");
        expect(internalState.viewNumRows).toBe(4);
        expect(internalState.csvDataRows).toBe(4);
        expect(internalState.tableSize).toBe(40);

        expect(chartsState.error).toBeUndefined();
        expect(chartsState.hasChartImpl).toBe(true);
        expect(chartsState.hasValidDataBounds).toBe(true);
        expect(chartsState.dataCount).toBe(4);
        expect(chartsState.uploadedCount).toBe(4);
        expect(chartsState.xFiniteCount).toBeGreaterThanOrEqual(4);
        expect(chartsState.yFiniteCount).toBeGreaterThanOrEqual(4);

        await page.evaluate(async () => {
            const viewer = document.querySelector("perspective-viewer")!;
            await viewer.restore({
                plugin: "Datagrid",
                columns: ["id", "region", "sales"],
                group_by: ["region"],
            });
            await viewer.flush();
        });

        const domState = await getDatagridDOMState(page);
        const finalState = await getViewerInternalState(page);

        expect(domState.error).toBeUndefined();
        expect(finalState.currentPlugin).toBe("Datagrid");
        expect(finalState.viewNumRows).toBe(4);
        expect(finalState.csvDataRows).toBe(4);
        expect(domState.visibleRowCount).toBeGreaterThanOrEqual(4);
    });
});

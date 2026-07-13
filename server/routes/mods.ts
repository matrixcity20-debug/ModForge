import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, modRequestsTable } from "../db/index";
import {
  CreateModRequestBody,
  GetModRequestParams,
  DeleteModRequestParams,
  ListModRequestsResponse,
  GetModRequestResponse,
  CreateModRequestResponse,
  GetModStatsResponse,
} from "../validators";
import { generateMod } from "../lib/modGenerator";
import { buildSourceJar } from "../lib/jarBuilder";

const router: IRouter = Router();

router.get("/mods", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(modRequestsTable)
    .orderBy(desc(modRequestsTable.createdAt))
    .limit(100);
  res.json(ListModRequestsResponse.parse(rows));
});

router.get("/mods/stats", async (_req, res): Promise<void> => {
  const rows = await db.select().from(modRequestsTable);

  const totalMods = rows.length;
  const versionCounts = new Map<string, number>();
  const loaderCounts = new Map<string, number>();

  for (const row of rows) {
    versionCounts.set(row.mcVersion, (versionCounts.get(row.mcVersion) ?? 0) + 1);
    loaderCounts.set(row.modLoader, (loaderCounts.get(row.modLoader) ?? 0) + 1);
  }

  const toBuckets = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

  res.json(
    GetModStatsResponse.parse({
      totalMods,
      byVersion: toBuckets(versionCounts),
      byLoader: toBuckets(loaderCounts),
    }),
  );
});

router.post("/mods", async (req, res): Promise<void> => {
  const parsed = CreateModRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { mcVersion, modLoader, prompt } = parsed.data;

  const [row] = await db
    .insert(modRequestsTable)
    .values({
      mcVersion,
      modLoader,
      prompt,
      title: "Üretiliyor...",
      status: "pending",
      summary: "",
      resultMarkdown: "",
    })
    .returning();

  res.status(201).json(CreateModRequestResponse.parse(row));

  const log = req.log;
  generateMod(mcVersion, modLoader, prompt)
    .then(async (generation) => {
      if (generation.status === "refused") {
        log.warn({ mcVersion, modLoader, id: row.id }, "Mod request refused by model");
      }
      await db
        .update(modRequestsTable)
        .set({
          title: generation.title,
          status: generation.status,
          summary: generation.summary,
          resultMarkdown: generation.resultMarkdown,
        })
        .where(eq(modRequestsTable.id, row.id));
      log.info({ id: row.id, status: generation.status }, "Background mod generation completed");
    })
    .catch(async (err) => {
      log.error({ err, id: row.id }, "Background mod generation failed");
      await db
        .update(modRequestsTable)
        .set({
          title: "Mod üretimi başarısız oldu",
          status: "failed",
          summary: "Tüm AI sağlayıcıları denendi ancak hiçbiri yanıt vermedi.",
          resultMarkdown: "Mod üretimi sırasında bir hata oluştu. Lütfen tekrar deneyin.",
        })
        .where(eq(modRequestsTable.id, row.id));
    });
});

router.get("/mods/:id", async (req, res): Promise<void> => {
  const params = GetModRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(modRequestsTable)
    .where(eq(modRequestsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Mod request not found" });
    return;
  }

  res.json(GetModRequestResponse.parse(row));
});

router.get("/mods/:id/download", async (req, res): Promise<void> => {
  const params = GetModRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(modRequestsTable)
    .where(eq(modRequestsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Mod request not found" });
    return;
  }

  if (row.status !== "completed" || !row.resultMarkdown) {
    res.status(400).json({ error: "Only completed mods can be downloaded" });
    return;
  }

  const jarBuffer = await buildSourceJar({
    title: row.title,
    mcVersion: row.mcVersion,
    modLoader: row.modLoader,
    prompt: row.prompt,
    resultMarkdown: row.resultMarkdown,
  });

  const filename = `${row.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${row.mcVersion}-source.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", jarBuffer.length);
  res.send(jarBuffer);
});

router.delete("/mods/:id", async (req, res): Promise<void> => {
  const params = DeleteModRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(modRequestsTable)
    .where(eq(modRequestsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Mod request not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;

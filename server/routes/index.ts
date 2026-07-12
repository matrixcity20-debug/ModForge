import { Router, type IRouter } from "express";
import healthRouter from "./health";
import modsRouter from "./mods";

const router: IRouter = Router();

router.use(healthRouter);
router.use(modsRouter);

export default router;

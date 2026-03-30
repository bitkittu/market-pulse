import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nseRouter from "./nse";
import insightsRouter from "./insights";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nseRouter);
router.use(insightsRouter);

export default router;

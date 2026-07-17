import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nseRouter from "./nse";
import insightsRouter from "./insights";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nseRouter);
router.use(insightsRouter);
router.use(authRouter);
router.use(adminRouter);

export default router;

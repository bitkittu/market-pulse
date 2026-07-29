import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nseRouter from "./nse";
import stocksRouter from "./stocks";
import insightsRouter from "./insights";
import holdingRouter from "./holding";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nseRouter);
router.use(stocksRouter);
router.use(insightsRouter);
router.use(holdingRouter);
router.use(authRouter);
router.use(adminRouter);

export default router;

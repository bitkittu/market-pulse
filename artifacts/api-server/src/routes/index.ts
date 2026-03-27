import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nseRouter from "./nse";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nseRouter);

export default router;

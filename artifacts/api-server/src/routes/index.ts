import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carsRouter from "./cars";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(carsRouter);

export default router;

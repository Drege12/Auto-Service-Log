import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carsRouter from "./cars";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(carsRouter);

export default router;

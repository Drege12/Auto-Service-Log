import { Router, type IRouter } from "express";
import healthRouter from "./health";
import carsRouter from "./cars";
import authRouter from "./auth";
import adminRouter from "./admin";
import profileRouter from "./profile";
import messagesRouter from "./messages";
import notificationsRouter from "./notifications";
import groupsRouter from "./groups";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(profileRouter);
router.use(messagesRouter);
router.use(notificationsRouter);
router.use(groupsRouter);
router.use(pushRouter);
router.use(carsRouter);

export default router;

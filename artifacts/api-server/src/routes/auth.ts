import { Router } from "express";

const router = Router();

router.post("/auth/login", (req, res) => {
  const { password } = req.body as { password?: string };
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    res.status(500).json({ error: "SITE_PASSWORD is not configured on the server." });
    return;
  }

  if (!password || password !== sitePassword) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }

  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import { downloadFile } from "../controllers/file.controller";

const router = Router();

// Signed, expiring download links for private tenant documents.
router.get("/:token", downloadFile);

export default router;

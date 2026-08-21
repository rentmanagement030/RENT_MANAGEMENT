import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import {
  loginSchema,
  firebaseLoginSchema,
  resetPasswordConfirmSchema,
  resetPasswordRequestSchema,
  changePasswordSchema,
} from "../validators/auth.validator";
import {
  login,
  firebaseLogin,
  logout,
  me,
  sessions,
  revokeSession,
  requestReset,
  confirmReset,
  changePassword,
} from "../controllers/auth.controller";
import { authLimiter } from "../middleware/rateLimit";

const router = Router();

router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post("/firebase-login", authLimiter, validateBody(firebaseLoginSchema), firebaseLogin);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);
router.get("/sessions", authenticate, sessions);
router.delete("/sessions/:id", authenticate, revokeSession);
router.post("/reset-password/request", authLimiter, validateBody(resetPasswordRequestSchema), requestReset);
router.post("/reset-password/confirm", validateBody(resetPasswordConfirmSchema), confirmReset);
router.post("/change-password", authenticate, validateBody(changePasswordSchema), changePassword);

export default router;

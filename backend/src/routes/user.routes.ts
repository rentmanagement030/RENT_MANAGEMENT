import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, requireAny } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import { PERMISSIONS } from "../utils/permissions";
import { createUserSchema, updateUserSchema } from "../validators/auth.validator";
import { paginationSchema } from "../validators/common";
import * as userController from "../controllers/user.controller";

const router = Router();

router.use(authenticate);

router.get("/", authorize(PERMISSIONS.USERS_READ), validateQuery(paginationSchema), userController.list);
router.post("/", authorize(PERMISSIONS.USERS_MANAGE), validateBody(createUserSchema), userController.create);
router.put("/:id", authorize(PERMISSIONS.USERS_MANAGE), validateBody(updateUserSchema), userController.update);
router.delete("/:id", authorize(PERMISSIONS.USERS_MANAGE), userController.remove);
router.get("/roles", requireAny(PERMISSIONS.USERS_READ, PERMISSIONS.ROLES_MANAGE), userController.roles);
router.get("/permissions", requireAny(PERMISSIONS.USERS_READ, PERMISSIONS.ROLES_MANAGE), userController.permissions);

export default router;

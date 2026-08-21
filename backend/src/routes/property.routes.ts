import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize, requireAny } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import { PERMISSIONS } from "../utils/permissions";
import { paginationSchema } from "../validators/common";
import {
  propertyCreateSchema,
  propertyUpdateSchema,
  setPropertyImagesSchema,
  pgRoomCreateSchema,
  pgRoomUpdateSchema,
  pgBedCreateSchema,
  pgBedUpdateSchema,
} from "../validators/property.validator";
import * as propertyController from "../controllers/property.controller";
import { uploadPropertyImage, uploadToCloudinary, publicUrlFor, publicStorageKey } from "../middleware/upload";
import { ok } from "../utils/http";

const router = Router();

router.use(authenticate);

router.get("/", requireAny(PERMISSIONS.PROPERTIES_READ, PERMISSIONS.PROPERTIES_MANAGE), validateQuery(paginationSchema), propertyController.list);
router.get("/:id", requireAny(PERMISSIONS.PROPERTIES_READ, PERMISSIONS.PROPERTIES_MANAGE), propertyController.get);
router.post("/", authorize(PERMISSIONS.PROPERTIES_MANAGE), validateBody(propertyCreateSchema), propertyController.create);
router.put("/:id", authorize(PERMISSIONS.PROPERTIES_MANAGE), validateBody(propertyUpdateSchema), propertyController.update);
router.delete("/:id", authorize(PERMISSIONS.PROPERTIES_MANAGE), propertyController.remove);
router.post("/:id/archive", authorize(PERMISSIONS.PROPERTIES_MANAGE), propertyController.archive);
router.put("/:id/images", authorize(PERMISSIONS.PROPERTIES_MANAGE), validateBody(setPropertyImagesSchema), propertyController.setImages);

// Image upload -> returns a public URL (non-sensitive content) stored on Cloudinary
router.post(
  "/upload/image",
  authorize(PERMISSIONS.PROPERTIES_MANAGE),
  uploadPropertyImage.single("image"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });
    try {
      const result = await uploadToCloudinary(req.file.buffer, "c2d_rentals/properties");
      return ok(res, { url: result.url, storageKey: result.url });
    } catch (err) {
      return res.status(500).json({ success: false, error: "Failed to upload image to cloud storage" });
    }
  },
);

// PG rooms & beds (nested under property)
router.get("/:propertyId/rooms", requireAny(PERMISSIONS.PROPERTIES_READ, PERMISSIONS.PG_MANAGE), propertyController.listRooms);
router.post(
  "/:propertyId/rooms",
  authorize(PERMISSIONS.PG_MANAGE),
  (req, _res, next) => {
    req.body = { ...req.body, propertyId: req.params.propertyId };
    next();
  },
  validateBody(pgRoomCreateSchema),
  propertyController.createRoom,
);
router.put("/rooms/:id", authorize(PERMISSIONS.PG_MANAGE), validateBody(pgRoomUpdateSchema), propertyController.updateRoom);
router.delete("/rooms/:id", authorize(PERMISSIONS.PG_MANAGE), propertyController.deleteRoom);
router.post(
  "/rooms/:roomId/beds",
  authorize(PERMISSIONS.PG_MANAGE),
  validateBody(
    pgBedCreateSchema
      .omit({ roomId: true })
      .partial()
      .extend({ bedNumbers: pgBedCreateSchema.shape.bedNumber.array().max(50).optional() })
      .refine((d) => d.bedNumber || (d.bedNumbers?.length ?? 0) > 0, {
        message: "Provide bedNumber or bedNumbers",
      }),
  ),
  propertyController.createBeds,
);
router.put("/beds/:id", authorize(PERMISSIONS.PG_MANAGE), validateBody(pgBedUpdateSchema), propertyController.updateBed);

import { HomeController } from "../controllers/home.controller";

// Home / Multi-Unit endpoints (nested under property)
router.get("/:propertyId/homes", requireAny(PERMISSIONS.PROPERTIES_READ, PERMISSIONS.PROPERTIES_MANAGE), HomeController.listHomesByProperty);
router.post(
  "/:propertyId/homes",
  authorize(PERMISSIONS.PROPERTIES_MANAGE),
  (req, _res, next) => {
    req.body = { ...req.body, propertyId: req.params.propertyId };
    next();
  },
  HomeController.createHome,
);
router.get("/homes/:id", requireAny(PERMISSIONS.PROPERTIES_READ, PERMISSIONS.PROPERTIES_MANAGE), HomeController.getHomeById);
router.put("/homes/:id", authorize(PERMISSIONS.PROPERTIES_MANAGE), HomeController.updateHome);
router.delete("/homes/:id", authorize(PERMISSIONS.PROPERTIES_MANAGE), HomeController.deleteHome);

export default router;

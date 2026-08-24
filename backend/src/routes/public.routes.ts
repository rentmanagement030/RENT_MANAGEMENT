import { Router } from "express";
import { validateQuery } from "../middleware/validate";
import { paginationSchema } from "../validators/common";
import * as publicController from "../controllers/public.controller";

const router = Router();

router.get("/health", publicController.health);
router.get("/properties", validateQuery(paginationSchema), publicController.properties);
router.get("/properties/cities", publicController.cities);
router.get("/properties/:id", publicController.property);
router.get("/info", publicController.info);
router.post("/contact", publicController.contact);
router.post("/enquiry", publicController.enquiry);
router.get("/agreements/sign/:token", publicController.getAgreementForSigning);
router.post("/agreements/sign/:token", publicController.signAgreement);
router.get("/agreements/sign/:token/pdf", publicController.getSignedAgreementPdf);
router.get("/agreements/sign/:token/document", publicController.getSignedAgreementPdf);

export default router;

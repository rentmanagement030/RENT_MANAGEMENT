import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { TaxController } from "../controllers/tax.controller";

const router = Router();

router.use(authenticate);

router.get("/", TaxController.listTaxRecords);
router.get("/stats", TaxController.getTaxStats);
router.get("/settings", TaxController.getTaxSettings);
router.put("/settings", TaxController.updateTaxSettings);
router.get("/payments/:paymentId/receipt", TaxController.downloadTaxReceipt);
router.get("/:id", TaxController.getTaxRecordById);
router.post("/", TaxController.createTaxRecord);
router.put("/:id", TaxController.updateTaxRecord);
router.post("/payments", TaxController.recordTaxPayment);

export default router;

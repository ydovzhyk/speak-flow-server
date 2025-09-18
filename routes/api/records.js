const express = require("express");
const { ctrlWrapper } = require("../../helpers");
const ctrl = require("../../controllers/recordsController");

const { validateBody, authorize } = require('../../middlewares')
const { schemas } = require("../../models/records");

const router = express.Router();

// * Save record
router.post(
  '/save-record',
  authorize,
  validateBody(schemas.saveRecordSchema),
  ctrlWrapper(ctrl.saveRecord)
);

// *Get user records
router.get('/get-records', authorize, ctrlWrapper(ctrl.getUserRecords));

// *Delete record
router.delete(
  "/delete/:recordId",
  authorize,
  ctrlWrapper(ctrl.deleteRecord)
);

module.exports = router;
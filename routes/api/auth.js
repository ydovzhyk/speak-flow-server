const express = require("express");
const { ctrlWrapper } = require("../../helpers");
const ctrl = require("../../controllers/authController");

const {
  validateBody,
  authorize,
  authenticateRefresh,
} = require("../../middlewares");
const { schemas } = require("../../models/user");
const router = express.Router();

// Register user
router.post(
  "/register",
  validateBody(schemas.registerSchema),
  ctrlWrapper(ctrl.register)
);

// Login user
router.post(
  "/login",
  validateBody(schemas.loginSchema),
  ctrlWrapper(ctrl.login)
);

// Logout user
router.post("/logout", authorize, ctrlWrapper(ctrl.logout));

// Refresh user
router.post(
  "/refresh",
  authenticateRefresh,
  validateBody(schemas.refreshTokenSchema),
  ctrlWrapper(ctrl.refresh)
);

// Get current user
router.post("/current", authorize, ctrlWrapper(ctrl.getUserController));

// Edit user
router.post(
  "/edit",
  authorize,
  validateBody(schemas.editUserSchema),
  ctrlWrapper(ctrl.editUserController)
);

// Delete user
router.delete(
  '/delete/:userId',
  authorize,
  ctrlWrapper(ctrl.deleteUserController)
)

module.exports = router;

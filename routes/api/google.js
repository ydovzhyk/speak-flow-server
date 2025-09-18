const express = require("express");

const { ctrlWrapper } = require("../../helpers");
const ctrl = require("../../controllers/authController");

const { passport } = require("../../middlewares");
const router = express.Router();

const rememberOrigin = (req, res, next) => {
  const { origin, role } = req.query

  if (origin) {
    req.session.origin = origin
  }
  if (role) {
    req.session.role = role
  }
  next()
}

router.get(
  "/",
  rememberOrigin,
  passport.authenticate("google", { scope: ["email", "profile"] })
);

router.get(
  "/callback",
  passport.authenticate("google", { session: false }),
  ctrlWrapper(ctrl.googleAuthController)
);

module.exports = router;

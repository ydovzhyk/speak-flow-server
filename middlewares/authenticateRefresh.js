const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const { User } = require('../models/user')
const { Session } = require('../models/session')

const { REFRESH_SECRET_KEY } = process.env

const authenticateRefresh = async (req, res, next) => {
  const sid = req.body?.sid
  const authHeader = req.get('Authorization')

  if (!authHeader) {
    return res
      .status(403)
      .json({ code: 'NO_TOKEN', message: 'Please login again' })
  }

  const refreshToken = authHeader.replace('Bearer ', '').trim()

  let payload
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET_KEY)
  } catch (err) {
    const code =
      err?.name === 'TokenExpiredError' ? 'REFRESH_EXPIRED' : 'REFRESH_INVALID'
    return res.status(401).json({ code, message: 'Please login again' })
  }

  const user = await User.findById(payload.id)
  if (!user) {
    return res
      .status(404)
      .json({ code: 'USER_NOT_FOUND', message: 'Please login again' })
  }

  if (!sid || !mongoose.Types.ObjectId.isValid(sid)) {
    return res
      .status(404)
      .json({ code: 'SESSION_NOT_FOUND', message: 'Please login again' })
  }

  const session = await Session.findOne({ _id: sid, uid: user._id })
  if (!session) {
    return res
      .status(404)
      .json({ code: 'SESSION_NOT_FOUND', message: 'Please login again' })
  }

  req.user = user
  req.session = session
  return next()
}

module.exports = authenticateRefresh

// const jwt = require("jsonwebtoken");

// const { User } = require("../models/user");
// const { Session } = require("../models/session");

// const { REFRESH_SECRET_KEY } = process.env;

// const authenticateRefresh = async (req, res, next) => {
//   const sidReq = req.body.sid;
//   const authorizationHeader = req.get("Authorization");

//   if (authorizationHeader) {
//     const refreshToken = authorizationHeader.replace("Bearer ", "");
//     let payload = {};
//     try {
//       payload = jwt.verify(refreshToken, REFRESH_SECRET_KEY);
//     } catch (err) {
//       return res
//         .status(401)
//         .send({ message: "Refresh end, please login again" });
//     }

//     const user = await User.findById(payload.id);

//     if (!user) {
//       return res.status(404).send({ message: "Invalid user" });
//     } else {
//       const sessionUser = await Session.findOne({ uid: user._id });
//       const sessionReq = await Session.findOne({ _id: sidReq });

//       if (!sessionReq || !sessionUser) {
//         return res.status(404).send({
//           message: "Invalid sessionSession timed out, please login again",
//         });
//       } else {
//         req.user = user;
//         req.session = sessionReq;
//         next();
//       }
//     }
//   } else return res.status(403).send({ message: "No valid token provided" });
// };

// module.exports = authenticateRefresh;

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { User } = require("../models/user");
const { Session } = require("../models/session");
const { SECRET_KEY, REFRESH_SECRET_KEY } = process.env;
const { RequestError } = require("../helpers");

const register = async (req, res, next) => {
  try {
    const {
      username,
      email,
      password,
      userAvatar,
      sex = '',
    } = req.body
    const user = await User.findOne({ email });
    if (user) {
      throw RequestError(409, "Email in use");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      passwordHash,
      userAvatar,
      sex,
    })

    const paylaod = { id: newUser._id };
    const accessToken = jwt.sign(paylaod, SECRET_KEY, { expiresIn: "12h" });
    const refreshToken = jwt.sign(paylaod, REFRESH_SECRET_KEY, {
      expiresIn: "24h",
    });

    const newSession = await Session.create({
      uid: newUser._id,
    });

    res.status(201).send({
      username: newUser.username,
      email: newUser.email,
      userAvatar: newUser.userAvatar,
      id: newUser._id,
      accessToken: accessToken,
      refreshToken: refreshToken,
      sid: newSession._id,
    })
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      throw RequestError(400, "Invalid email or password");
    }
    const passwordCompare = await bcrypt.compare(password, user.passwordHash);
    if (!passwordCompare) {
      throw RequestError(400, "Invalid email or password");
    }
    const paylaod = { id: user._id };

    const accessToken = jwt.sign(paylaod, SECRET_KEY, { expiresIn: "12h" });
    const refreshToken = jwt.sign(paylaod, REFRESH_SECRET_KEY, {
      expiresIn: "24h",
    });

    const newSession = await Session.create({
      uid: user._id,
    });

    return res.status(200).send({
      accessToken,
      refreshToken,
      sid: newSession._id,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// const refresh = async (req, res, next) => {
//   try {
//     const user = req.user;
//     await Session.deleteMany({ uid: req.user._id });
//     const paylaod = { id: user._id };
//     const newSession = await Session.create({ uid: user._id });
//     const newAccessToken = jwt.sign(paylaod, SECRET_KEY, { expiresIn: "12h" });
//     const newRefreshToken = jwt.sign(paylaod, REFRESH_SECRET_KEY, {
//       expiresIn: "24h",
//     });

//     return res
//       .status(200)
//       .send({ newAccessToken, newRefreshToken, sid: newSession._id });
//   } catch (error) {
//     next(error);
//   }
// };

const refresh = async (req, res, next) => {
  try {
    const user = req.user
    await Session.deleteMany({ uid: user._id })
    const newSession = await Session.create({ uid: user._id })

    const payload = { id: user._id.toString() }
    const newAccessToken = jwt.sign(payload, SECRET_KEY, { expiresIn: '12h' })
    const newRefreshToken = jwt.sign(payload, REFRESH_SECRET_KEY, {
      expiresIn: '24h',
    })

    return res.status(200).json({
      code: 'OK',
      newAccessToken,
      newRefreshToken,
      sid: newSession._id,
    })
  } catch (error) {
    next(error)
  }
}

const logout = async (req, res, next) => {
  try {
    const user = req.user
    if (user?._id) {
      await Session.deleteMany({ uid: user._id })
    }
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

const deleteUserController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await User.findOneAndDelete({ _id: userId });
    const currentSession = req.session;
    await Session.deleteOne({ _id: currentSession._id });

    res.status(200).json({ message: "user deleted successfully" });
  } catch (error) {
    next(error);
  }
};

const getUserController = async (req, res, next) => {
  try {
    const { _id } = req.user;
    const { accessToken, refreshToken, sid } = req.body;
    const user = await User.findOneAndUpdate(
      { _id },
      { lastVisit: new Date() },
      { new: true }
    );
    return res.status(200).send({
      accessToken,
      refreshToken,
      sid,
      user,
    });
  } catch (error) {
    next(error);
  }
};

const editUserController = async (req, res, next) => {
  try {
    const { _id } = req.user;
    const {
      username,
      sex,
      userAvatar,
      email,
    } = req.body;

    const updatedUserData = {
      username: username || req.user.username || "",
      sex: sex || req.user.sex || "",
      userAvatar: userAvatar || req.user.userAvatar || "",
      email: email || req.user.email || "",
    };

    const user = await User.findOneAndUpdate({ _id }, updatedUserData, {
      new: true,
      runValidators: true,
    });

    return res.status(201).send({ user: user, message: "Profile updated successfully" });
  } catch (error) {
    next(error);
  }
};

const googleAuthController = async (req, res, next) => {
  try {
    const { _id: id } = req.user;
    const payload = { id };

    const origin = req.session.origin;
    const roleFromSession = req.session.role;

    if (roleFromSession && req.user.role !== roleFromSession) {
      await User.findByIdAndUpdate(id, { role: roleFromSession })
    }

    const accessToken = jwt.sign(payload, SECRET_KEY, { expiresIn: "12h" });
    const refreshToken = jwt.sign(payload, REFRESH_SECRET_KEY, {
      expiresIn: "24h",
    });
    const newSession = await Session.create({
      uid: id,
    });

    res.redirect(
      `${origin}?accessToken=${accessToken}&refreshToken=${refreshToken}&sid=${newSession._id}`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  deleteUserController,
  refresh,
  getUserController,
  editUserController,
  googleAuthController,
}

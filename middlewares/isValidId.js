const { isValidObjectId } = require("mongoose");
const { RequestError } = require("../helpers");

const isValidId = (req, res, next) => {
  const eventId = req.params.eventId || req.body.eventId;
  const userId = req.params.userId || req.body.userId;
  const textDataId = req.params.textDataId || req.body.textDataId;

  try {
    const objectId = eventId ? eventId : userId ? userId : textDataId;
    if (!isValidObjectId(objectId)) {
      throw new Error("is not a valid ObjectId");
    }
    next();
  } catch (error) {
    next(RequestError(400, error.message));
  }
};

module.exports = isValidId;

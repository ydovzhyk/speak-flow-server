const Joi = require("joi");
const { Schema, model } = require("mongoose");

const { handleSaveErrors } = require("../helpers");

const sessionSchema = new Schema(
  {
    uid: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { versionKey: false, timestamps: true }
);

sessionSchema.post("save", handleSaveErrors);

const addSessionSchema = Joi.object({
  uid: Joi.string().required(),
});

const schemas = {
  addSessionSchema,
};

const Session = model("session", sessionSchema);

module.exports = {
  Session,
  schemas,
};

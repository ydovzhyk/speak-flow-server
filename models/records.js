const Joi = require("joi");
const { Schema, model } = require("mongoose");
const { handleSaveErrors } = require("../helpers");

const recordsSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    transcript: {
      type: String,
      required: true,
    },
    translation: {
      type: String,
      required: true,
    },
    savedAt: {
      type: String,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { minimize: false }
)

recordsSchema.post("save", handleSaveErrors);

const Records = model("records", recordsSchema);

const saveRecordSchema = Joi.object({
  title: Joi.string().required(),
  transcript: Joi.string().required(),
  translation: Joi.string().required(),
  savedAt: Joi.string().required(),
})

const schemas = {
  saveRecordSchema,
};

module.exports = {
  Records,
  schemas,
};
const { Records } = require("../models/records");

const saveRecord = async (req, res) => {
  try {
    const userId = req.user?._id
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { title, transcript, translation, savedAt } = req.body

    await Records.create({
      title,
      transcript,
      translation,
      savedAt,
      owner: userId,
    })

    return res
      .status(201)
      .json({
        message: 'Record successfully saved',
      })
  } catch (error) {
    return res.status(500).json({
      message:
        'An error occurred while saving the record, please try again later',
    })
  }
}

const getUserRecords = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const savedData = await Records.find({ owner: userId }).sort({
      savedAt: -1,
    })

    return res.json({ savedData })
  } catch (error) {
    return res.status(500).json({
      message:
        'An error occurred while getting user records, please try again later',
    })
  }
};

const deleteRecord = async (req, res) => {
  try {
    const userId = req.user?._id
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const { recordId } = req.params

    const deleted = await Records.findOneAndDelete({
      _id: recordId,
      owner: userId,
    })

    if (!deleted) {
      return res.status(404).json({ message: 'Record not found' })
    }

    return res.status(200).json({message: 'Record successfully deleted'})
  } catch (err) {
    return res.status(500).json({
      message:
        'An error occurred while deleting the record, please try again later',
    })
  }
}

module.exports = {
  saveRecord,
  getUserRecords,
  deleteRecord,
}
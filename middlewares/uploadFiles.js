const multer = require("multer");
const path = require("path");
const fs = require("fs");

const tempDir = path.join(__dirname, "../", "temp");

const multerConfig = multer.diskStorage({
  destination: tempDir,
  filename: (req, file, cb) => {
    const originalname = file.originalname;
    const extname = path.extname(originalname);
    const filenameWithoutExtension = path.basename(originalname, extname);
    let newFilename = originalname;

    if (fs.existsSync(path.join(tempDir, originalname))) {
      let i = 1;
      while (fs.existsSync(path.join(tempDir, newFilename))) {
        newFilename = `${filenameWithoutExtension}_${i}${extname}`;
        i++;
      }
    }

    cb(null, newFilename);
  },
});

const uploadFiles = multer({
  storage: multerConfig,
});

module.exports = uploadFiles;

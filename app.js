const express = require("express");
const session = require("express-session");
const logger = require("morgan");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRouter = require("./routes/api/auth");
const googleRouter = require("./routes/api/google");
const recordsRouter = require("./routes/api/records");

const { GOOGLE_CLIENT_SECRET } = process.env;

const app = express();

const formatsLogger = app.get("env") === "development" ? "dev" : "short";

app.use(logger(formatsLogger));
app.use(cors({ credentials: false, origin: "*" }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use('/api/records', recordsRouter);

app.use(
  "/api/google",
  session({
    secret: `${GOOGLE_CLIENT_SECRET}`,
    resave: false,
    saveUninitialized: true,
  })
);
app.use("/api/google", googleRouter);

const staticPath = path.resolve('public')
app.use(express.static(staticPath))

app.get(/^\/(?!api\/).*/, (res) => {
  res.sendFile(path.join(staticPath, 'index.html'))
})

app.use('/api', (req, res) => {
  const payload = {
    message: 'API route not found',
    method: req.method,
    path: req.originalUrl,
  }

  if (process.env.NODE_ENV !== 'production') {
    payload.query = req.query
  }

  res.status(404).json(payload)
})

app.use((err, res) => {
  console.log(err); // eslint-disable-line
  const { status = 500, message = "Server error" } = err;
  res.status(status).json({
    message,
  });
});

module.exports = app;

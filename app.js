const express = require('express')
const session = require('express-session')
const logger = require('morgan')
const cors = require('cors')
require('dotenv').config()

const authRouter = require('./routes/api/auth')
const googleRouter = require('./routes/api/google')
const recordsRouter = require('./routes/api/records')

const { GOOGLE_CLIENT_SECRET, NODE_ENV } = process.env

const app = express()
const formatsLogger = app.get('env') === 'development' ? 'dev' : 'short'

app.use(logger(formatsLogger))

/** CORS **/
const allowedOrigins = ['http://localhost:3000', 'https://speakflow.space']

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      return cb(new Error('CORS not allowed'), false)
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Authorization,Content-Type',
    credentials: false, // зміни на true, для cookies/сесії
  })
)

app.options('*', cors())

app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/records', recordsRouter)

app.use(
  '/api/google',
  session({
    secret: GOOGLE_CLIENT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
)
app.use('/api/google', googleRouter)

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

app.use('/api', (req, res) => {
  const payload = {
    message: 'API route not found',
    method: req.method,
    path: req.originalUrl,
  }
  if (NODE_ENV !== 'production') payload.query = req.query
  res.status(404).json(payload)
})

app.use((err, req, res, next) => {
  console.error(err) // eslint-disable-line
  const status = err.status || 500
  res.status(status).json({ message: err.message || 'Server error' })
})

module.exports = app

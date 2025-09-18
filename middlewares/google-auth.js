// google-auth.js
const passport = require('passport')
const { Strategy } = require('passport-google-oauth2')
const bcrypt = require('bcrypt')
const shortid = require('shortid')
const { User } = require('../models/user')

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  BASE_URL,
  NODE_ENV,
  BASE_URL_HEROKU,
} = process.env

const callbackURL =
  NODE_ENV === 'production'
    ? `${BASE_URL || BASE_URL_HEROKU}/api/google/callback`
    : `${BASE_URL}/api/google/callback`

const googleParams = {
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL,
  passReqToCallback: true,
}

const googleCallback = async (
  req,
  accessToken,
  refreshToken,
  profile,
  done
) => {
  try {
    const date = new Date()
    const today = date.toISOString().slice(0, 10)

    const email = profile.email || profile.emails?.[0]?.value || null

    const username =
      profile.given_name ||
      profile.name?.givenName ||
      profile.displayName ||
      'User'

    const userAvatar = profile.picture || profile.photos?.[0]?.value || ''

    if (!email) {
      return done(new Error('Google did not return an email'), false)
    }

    let user = await User.findOne({ email })

    if (user) {
      await User.findOneAndUpdate(
        { email },
        { referer: req.session.origin || null },
        { new: true }
      )
      return done(null, user)
    }

    const passwordHash = await bcrypt.hash(shortid.generate(), 10)

    user = await User.create({
      email,
      passwordHash,
      username,
      userAvatar,
      dateCreate: today,
      referer: req.session.origin || null,
    })

    return done(null, user)
  } catch (error) {
    return done(error, false)
  }
}

passport.use('google', new Strategy(googleParams, googleCallback))
module.exports = passport

const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const authConfig = require('./authConfig');

const jwtAuthStrategy = new JwtStrategy(
  {
    secretOrKey: authConfig.key,
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  },
  async (token, done) => {
    try {
      return done(null, token.user);
    } catch (error) {
      console.error("JWT failed: " + error);
      return done(error);
    }
  }
);

module.exports = jwtAuthStrategy;
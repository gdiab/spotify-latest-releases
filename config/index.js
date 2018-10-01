//const dotenv = require('..dotenv').config();
if(typeof process.env.SPOTIFY_CLIENT_SECRET == "undefined") { 
    require("dotenv").config();
}
const clientConfig = require('./client');


module.exports = Object.assign({
  port: process.env.PORT,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
}, clientConfig)
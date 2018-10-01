console.log("process.env.CLIENT_ID", process.env.SPOTIFY_CLIENT_ID)
console.log("process.env.SPOTIFY_REDIRECT", process.env.SPOTIFY_REDIRECT)

module.exports = {
  clientId: process.env.SPOTIFY_CLIENT_ID,
  redirectUri: process.env.SPOTIFY_REDIRECT
}	
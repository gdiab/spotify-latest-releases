import bluebird from 'bluebird'
import moment from 'moment'
import _ from 'lodash'
import axios from 'axios'
import Qs from 'qs'

function unpackArray (datas, unpack) {
  return _.flatten(datas.map(unpack))
}

function unpackItem (body, key) {
  if (key) {
    return body[key].items
  } else {
    return body.items
  }
}

function Api (token) {
  const http = axios.create({
    headers: {
      Authorization: `Bearer ${token}`
    },

    paramsSerializer (params) {
      return Qs.stringify(params, { arrayFormat: 'brackets' })
    }
  })

  async function load (url, options) {
    // We'll retry until we're successfull,
    // or until we get an error that's not 429

    try {
      console.log('options: ', options);
      return await http.get(url, options)
    } catch (err) {
      if (err.response.status === 429) {
        // If Spotify wants us to wait, we'll wait.
        await wait(err.response.headers['Retry-After'])
        return await load(url, options)
      } else {
        throw err
      }
    }
  }

  return {
    getFollowedArtists (_params) {
      const params = Object.assign({}, _params, { type: 'artist' })

      return load('https://api.spotify.com/v1/me/following', {
        params
      })
    },

    getNewReleases (_params) {
      const params = Object.assign({}, _params)
      
      return load('https://api.spotify.com/v1/browse/new-releases', {
        params
      })
    },

    getTopReleasesLongTerm (_params) {
      const params = Object.assign({}, _params, { time_range: 'long_term' })
      
      return load('https://api.spotify.com/v1/me/top/artists', {
        params
      })
    },

    getTopReleasesMediumTerm (_params) {
      const params = Object.assign({}, _params)
      
      return load('https://api.spotify.com/v1/me/top/artists?time_range=medium_term', {
        params
      })
    },

    getTopReleasesShortTerm (_params) {
      const params = Object.assign({}, _params)
      
      return load('https://api.spotify.com/v1/me/top/artists?time_range=short_term', {
        params
      })
    },

    getArtistAlbums (artistId, _params) {
      const params = Object.assign({}, _params)

      return load(`https://api.spotify.com/v1/artists/${artistId}/albums`, {
        params
      })
    },

    getAlbums (albumIds) {
      return load(`https://api.spotify.com/v1/albums`, {
        params: {
          ids: albumIds.join(',')
        }
      })
    }
  }
}

function wait (s) {
  return new Promise (resolve => {
    setTimeout(resolve, s * 1000)
  })
}

export default function Service (TOKEN) {
  const spotifyApi = Api(TOKEN)
  // console.log('spotifyApi: ', spotifyApi);
  async function getFollowedArtists (after) {
    const limit = 50
    const country = 'US'
    const response = await spotifyApi.getFollowedArtists({ limit, country, after })

    const nextAfter = response.data.artists.cursors.after
    const artists = response.data.artists.items

    if (nextAfter) {
      return [].concat(artists, await getFollowedArtists(nextAfter))
    } else {
      return artists
    }
  }

  async function getTopReleasesMediumTerm (after) {
    const limit = 50
    const country = 'US'
    const response = await spotifyApi.getFollowedArtists({ limit, country, after })

    const nextAfter = response.data.artists.cursors.after
    const artists = response.data.artists.items

    if (nextAfter) {
      return [].concat(artists, await getFollowedArtists(nextAfter))
    } else {
      return artists
    }
  }

  async function getTopReleasesLongTerm (after) {
    const limit = 50
    const country = 'US'
    const response = await spotifyApi.getTopReleasesLongTerm({ limit, country, after })

    const nextAfter = response.data.artists.cursors.after
    const artists = response.data.artists.items

    if (nextAfter) {
      return [].concat(artists, await getTopReleasesLongTerm(nextAfter))
    } else {
      return artists
    }
  }

  async function getTopReleasesShortTerm (after) {
    const limit = 50
    const country = 'US'
    const response = await spotifyApi.getTopReleasesShortTerm({ limit, country, after })

    const nextAfter = response.data.artists.cursors.after
    const artists = response.data.artists.items

    if (nextAfter) {
      return [].concat(artists, await getTopReleasesShortTerm(nextAfter))
    } else {
      return artists
    }
  }

  async function getNewReleases (after, offset) {
    offset = offset || 0
    const limit = 50
    const response = await spotifyApi.getNewReleases({ limit, offset, after })
    console.log('data: %j', response.data.albums.items);
    const nextAfter = response.data.albums.next
    const albums = response.data.albums.items
    console.log('next offset: %j', offset);
    console.log('next url: %j', nextAfter);
    console.log('albums.length: ', albums.length);


    //return albums
    if (offset == 0) {
      offset = 50
      return [].concat(albums, await getNewReleases(nextAfter, offset))
    } else {
      return albums
    }
  }

  async function getNewReleasesV2 (after, offset) {
    offset = offset || 0
    const limit = 50
    const response = await spotifyApi.getTopReleasesLongTerm({ limit, offset, after })


    console.log('data.items: %j', response.data.items);
    console.log('data: %j', response.data);
    const nextAfter = response.data.next

    const albums = await getAlbumIds(response.data.items);
    console.log('albums? : %j', albums);
    console.log('next offset: %j', offset);
    console.log('next url: %j', nextAfter);
    // console.log('albums.length: ', albums.length);


    //return albums
    if (offset == 0 && nextAfter) {
      offset = 50
      return [].concat(albums, await getNewReleasesV2(nextAfter, offset))
    } else {
      return albums
    }
  }

  async function getAlbumIds (artists) {
    const allAlbumsDataArray = await bluebird.map(artists, artist => {
      //console.log('getAlbumIds::artist: ', artist);
      return spotifyApi.getArtistAlbums(artist.id, {
        limit: 5,
        album_type: 'album,single',
        country: 'US'
      })
    })
    //console.log('allAlbumsDataArray.data.items: %j', allAlbumsDataArray);
    const allAlbumIds = unpackArray(allAlbumsDataArray, response => response.data.items)

    const allAlbums = await getAlbumInformation(allAlbumIds.map(album => album.id));
    return allAlbums;
  }

  async function getAlbumInformation (albumIds) {
    const chunks = _.chunk(albumIds, 20)

    // returns [[body.albums.20 Albums], [body.albums.20 Albums]]
    const albumDataArray = await bluebird.map(chunks, albumIds => {
      return spotifyApi.getAlbums(albumIds)
    })

    console.log('getAlbumInformation::albums: %j', albumDataArray);

    // returns [[20 Albums], [20 Albums]]
    const albums = unpackArray(albumDataArray, response => response.data.albums)

    return albums
  }

  function transformAlbums (albums) {
    return albums.map(_album => {
      const album = _.pick(_album, [
        'album_type',
        'artists',
        'external_urls',
        'href',
        'id',
        'images',
        'name',
        'release_date'
      ])

      const formats = ['YYYY-MM-DD', 'YYYY-MM', 'YYYY']

      album.release_date = moment.utc(album.release_date, formats).toDate()

      return album
    })
  }

  function orderAlbums (albums) {
    return _.orderBy(albums, ['release_date'], 'desc')
  }

  return {
    getFollowedArtists,
    getAlbumIds,
    getNewReleases,
    getNewReleasesV2,
    getTopReleasesMediumTerm,
    getTopReleasesLongTerm,
    getTopReleasesShortTerm,
    getAlbumInformation,
    transformAlbums,
    orderAlbums
  }
}

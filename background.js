// Constants
const SPOTIFY_API = {
  BASE_URL: 'https://api.spotify.com/v1',
  AUTH_URL: 'https://accounts.spotify.com/authorize',
  SCOPES: [
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-private',
    'playlist-read-private',
    'playlist-read-collaborative'
  ]
};

const SIMILARITY_THRESHOLDS = {
  PERFECT_MATCH: 0.8,
  GOOD_MATCH: 0.7,
  ACCEPTABLE_MATCH: 0.5
};

// Spotify API Client
class SpotifyClient {
  constructor() {
    this.token = null;
  }

  async getToken() {
    if (this.token) {
      const isValid = await this.validateToken(this.token);
      if (isValid) return this.token;
    }

    const storage = await chrome.storage.local.get(['spotify_token', 'client_id']);

    if (storage.spotify_token) {
      const isValid = await this.validateToken(storage.spotify_token);
      if (isValid) {
        this.token = storage.spotify_token;
        return this.token;
      }
    }

    if (!storage.client_id) {
      throw new Error('Client ID not found');
    }

    this.token = await this.getNewToken(storage.client_id);
    return this.token;
  }

  async validateToken(token) {
    try {
      const response = await fetch(`${SPOTIFY_API.BASE_URL}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return false;

      // Validate playlist if exists
      const storedPlaylist = await chrome.storage.local.get('playlist_id');
      if (storedPlaylist.playlist_id) {
        const playlistResponse = await fetch(
          `${SPOTIFY_API.BASE_URL}/playlists/${storedPlaylist.playlist_id}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!playlistResponse.ok) {
          console.log('Playlist was deleted, clearing token to force re-auth');
          await chrome.storage.local.remove(['spotify_token', 'playlist_id']);
          return false;
        }
      }

      return true;
    } catch (error) {
      await chrome.storage.local.remove(['spotify_token', 'playlist_id']);
      return false;
    }
  }

  async getNewToken(clientId) {
    const REDIRECT_URI = chrome.identity.getRedirectURL();
    const authUrl = `${SPOTIFY_API.AUTH_URL}?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_API.SCOPES.join(' '))}`;

    try {
      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });

      const hash = redirectUrl.split('#')[1];
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');

      if (accessToken) {
        await chrome.storage.local.set({ spotify_token: accessToken });
        return accessToken;
      }
    } catch (error) {
      throw new Error('Authentication failed: ' + error.message);
    }
  }

  async searchTrack(query) {
    const token = await this.getToken();
    const { artist, song } = query;

    const searchQueries = this.generateSearchQueries(artist, song);
    let allResults = [];

    for (const searchQuery of searchQueries) {
      const response = await fetch(
        `${SPOTIFY_API.BASE_URL}/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to search song');
      }

      const data = await response.json();
      if (data.tracks?.items.length > 0) {
        allResults = allResults.concat(data.tracks.items);
      }
    }

    return this.processSearchResults(allResults, artist, song);
  }

  generateSearchQueries(artist, song) {
    const cleanArtist = this.cleanString(artist);
    const cleanSong = this.cleanString(song);

    return [
      `${cleanArtist} ${cleanSong}`, // Full search
      cleanSong, // Just song name
      // Handle multiple artists
      ...cleanArtist.split(/\s+/).map(artistPart => `${artistPart} ${cleanSong}`)
    ];
  }

  processSearchResults(results, targetArtist, targetSong) {
    // Remove duplicates based on URI
    const uniqueResults = Array.from(new Map(results.map(track => [track.uri, track])).values());

    if (!uniqueResults.length) {
      return { matches: [] };
    }

    const processedTracks = uniqueResults.map(track => {
      const cleanTrackName = this.cleanString(track.name);
      const cleanTrackArtist = this.cleanString(track.artists.map(a => a.name).join(' '));

      const songSimilarity = this.calculateSimilarity(cleanTrackName, this.cleanString(targetSong));
      const artistSimilarity = this.calculateSimilarity(cleanTrackArtist, this.cleanString(targetArtist));
      const totalScore = (artistSimilarity * 0.6) + (songSimilarity * 0.4);

      return {
        uri: track.uri,
        name: track.name,
        artist: track.artists[0].name,
        allArtists: track.artists.map(a => a.name).join(', '),
        confidence: totalScore,
        preview_url: track.preview_url,
        duration: track.duration_ms,
        album: track.album.name,
        songSimilarity,
        artistSimilarity
      };
    });

    // Sort tracks by confidence score
    const sortedTracks = processedTracks.sort((a, b) => b.confidence - a.confidence);

    // Find the best match
    const bestMatch = sortedTracks.find(track =>
      track.confidence > SIMILARITY_THRESHOLDS.PERFECT_MATCH &&
      track.songSimilarity > SIMILARITY_THRESHOLDS.GOOD_MATCH &&
      track.artistSimilarity > SIMILARITY_THRESHOLDS.GOOD_MATCH
    );

    return {
      bestMatch: bestMatch || null,
      matches: bestMatch ? [] : sortedTracks
    };
  }

  cleanString(str) {
    return str
      .toLowerCase()
      // Replace Turkish characters
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      // Remove special characters and extra spaces
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      // Remove common words and symbols
      .replace(/\b(official|video|audio|lyrics|music|hd|4k|resmi|klip|clip|mv)\b/g, '')
      .replace(/\b(ft|feat|featuring|with|x|&|and|ve)\b/g, '')
      .trim();
  }

  calculateSimilarity(str1, str2) {
    const s1 = this.cleanString(str1);
    const s2 = this.cleanString(str2);

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    const words1 = s1.split(' ');
    const words2 = s2.split(' ');
    let matches = 0;

    // Count matching words
    for (const word of words1) {
      if (word.length > 2 && words2.includes(word)) {
        matches++;
      }
    }

    // Calculate similarity score
    return (2.0 * matches) / (words1.length + words2.length);
  }

  async getPlaylistId() {
    const token = await this.getToken();
    const storage = await chrome.storage.local.get('playlist_id');

    if (storage.playlist_id) {
      const isValid = await this.verifyPlaylist(storage.playlist_id, token);
      if (isValid) return storage.playlist_id;
    }

    const existingPlaylist = await this.findExistingPlaylist(token);
    if (existingPlaylist) {
      await chrome.storage.local.set({ playlist_id: existingPlaylist });
      return existingPlaylist;
    }

    return await this.createNewPlaylist(token);
  }

  async verifyPlaylist(playlistId, token) {
    try {
      const response = await fetch(
        `${SPOTIFY_API.BASE_URL}/playlists/${playlistId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async findExistingPlaylist(token) {
    try {
      const response = await fetch(
        `${SPOTIFY_API.BASE_URL}/me/playlists?limit=50`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const playlist = data.items.find(p => p.name === 'YouTube Songs');
      return playlist?.id;
    } catch {
      return null;
    }
  }

  async createNewPlaylist(token) {
    try {
      const userResponse = await fetch(
        `${SPOTIFY_API.BASE_URL}/me`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!userResponse.ok) throw new Error('Failed to get user info');

      const userData = await userResponse.json();
      const response = await fetch(
        `${SPOTIFY_API.BASE_URL}/users/${userData.id}/playlists`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'YouTube Songs',
            description: 'Songs added from YouTube videos',
            public: false
          })
        }
      );

      if (!response.ok) throw new Error('Failed to create playlist');

      const playlist = await response.json();
      await chrome.storage.local.set({ playlist_id: playlist.id });
      return playlist.id;
    } catch (error) {
      throw new Error('Failed to create playlist: ' + error.message);
    }
  }

  async addToPlaylist(trackUri) {
    const token = await this.getToken();
    const playlistId = await this.getPlaylistId();

    const response = await fetch(
      `${SPOTIFY_API.BASE_URL}/playlists/${playlistId}/tracks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [trackUri]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to add track to playlist');
    }

    return true;
  }
}

// Initialize Spotify client
const spotifyClient = new SpotifyClient();

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ADD_TO_SPOTIFY') {
    handleAddToSpotify(request.data, sendResponse);
    return true; // Keep the message channel open for async response
  } else if (request.type === 'ADD_SELECTED_SONG') {
    handleSelectedSong(request.data, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Handle add to Spotify request
async function handleAddToSpotify(songInfo, sendResponse) {
  try {
    const searchResult = await spotifyClient.searchTrack(songInfo);

    if (searchResult.bestMatch) {
      // Direct match found
      await spotifyClient.addToPlaylist(searchResult.bestMatch.uri);
      sendResponse({
        success: true,
        trackInfo: {
          ...searchResult.bestMatch,
          confidence: Math.round(searchResult.bestMatch.confidence * 100)
        }
      });
    } else if (searchResult.matches.length > 0) {
      // Multiple potential matches
      sendResponse({
        success: false,
        searchResults: searchResult.matches.map(track => ({
          ...track,
          confidence: Math.round(track.confidence * 100)
        }))
      });
    } else {
      // No matches found
      sendResponse({
        success: false,
        error: 'No matching songs found on Spotify'
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Handle manually selected song
async function handleSelectedSong(track, sendResponse) {
  try {
    await spotifyClient.addToPlaylist(track.uri);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: error.message
    });
  }
} 

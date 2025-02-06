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
    try {
      if (this.token) {
        const isValid = await this.validateToken(this.token);
        if (isValid) return this.token;
      }

      const storage = await chrome.storage.local.get(['spotify_token', 'client_id']);
      console.log('Storage state:', { hasToken: !!storage.spotify_token, hasClientId: !!storage.client_id });

      if (storage.spotify_token) {
        const isValid = await this.validateToken(storage.spotify_token);
        if (isValid) {
          this.token = storage.spotify_token;
          return this.token;
        }
      }

      if (!storage.client_id) {
        throw new Error('Client ID not found. Please set your Spotify Client ID in the extension settings.');
      }

      console.log('Getting new token with client ID:', storage.client_id);
      this.token = await this.getNewToken(storage.client_id);
      return this.token;
    } catch (error) {
      console.error('Error in getToken:', error);
      throw error;
    }
  }

  async validateToken(token) {
    try {
      console.log('Validating token...');
      const response = await fetch(`${SPOTIFY_API.BASE_URL}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.log('Token validation failed:', response.status, response.statusText);
        return false;
      }

      // Validate playlist if exists
      const storedPlaylist = await chrome.storage.local.get('playlist_id');
      if (storedPlaylist.playlist_id) {
        console.log('Validating playlist:', storedPlaylist.playlist_id);
        const playlistResponse = await fetch(
          `${SPOTIFY_API.BASE_URL}/playlists/${storedPlaylist.playlist_id}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!playlistResponse.ok) {
          console.log('Playlist validation failed, clearing token');
          await chrome.storage.local.remove(['spotify_token', 'playlist_id']);
          return false;
        }
      }

      console.log('Token validation successful');
      return true;
    } catch (error) {
      console.error('Error in validateToken:', error);
      await chrome.storage.local.remove(['spotify_token', 'playlist_id']);
      return false;
    }
  }

  async getNewToken(clientId) {
    try {
      const REDIRECT_URI = chrome.identity.getRedirectURL();
      console.log('Redirect URI:', REDIRECT_URI);

      // Validate Client ID format
      if (!clientId || !/^[0-9a-f]{32}$/i.test(clientId)) {
        throw new Error('Invalid Client ID format. Please check your Client ID.');
      }

      const scope = SPOTIFY_API.SCOPES.join(' ');
      const authUrl = new URL(SPOTIFY_API.AUTH_URL);

      // Build auth URL with state parameter for security
      const state = Math.random().toString(36).substring(2, 15);
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('response_type', 'token');
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('scope', scope);
      authUrl.searchParams.append('show_dialog', 'true');
      authUrl.searchParams.append('state', state);

      console.log('Starting authentication with URL:', authUrl.toString());

      try {
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl.toString(),
          interactive: true
        });

        console.log('Received redirect URL:', redirectUrl);

        if (!redirectUrl) {
          throw new Error('Authentication window was closed or blocked. Please try again and allow the popup.');
        }

        const hash = redirectUrl.split('#')[1];
        if (!hash) {
          throw new Error('Spotify did not return any authentication data. Please check your Client ID and Redirect URI in Spotify Dashboard.');
        }

        const params = new URLSearchParams(hash);
        const returnedState = params.get('state');
        const error = params.get('error');
        const accessToken = params.get('access_token');

        // Verify state to prevent CSRF
        if (returnedState !== state) {
          throw new Error('Security validation failed. Please try again.');
        }

        if (error) {
          if (error === 'access_denied') {
            throw new Error('Access was denied. Please accept the permissions when prompted.');
          }
          if (error === 'invalid_client') {
            throw new Error('Invalid Client ID. Please check your Client ID in Spotify Dashboard.');
          }
          throw new Error(`Spotify authentication error: ${error}`);
        }

        if (!accessToken) {
          throw new Error('No access token received. Please check your Spotify Developer Dashboard settings:\n1. Verify your Client ID\n2. Add this Redirect URI: ' + REDIRECT_URI);
        }

        // Validate the token with Spotify API
        const validateResponse = await fetch('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!validateResponse.ok) {
          throw new Error('Received invalid access token. Please check your Spotify Developer Dashboard settings.');
        }

        console.log('Authentication successful');
        await chrome.storage.local.set({ spotify_token: accessToken });
        return accessToken;

      } catch (flowError) {
        console.error('WebAuthFlow error:', flowError);
        if (flowError.message.includes('cannot establish connection')) {
          throw new Error('Could not open authentication window. Please check your popup blocker settings.');
        }
        throw flowError;
      }

    } catch (error) {
      console.error('Authentication error:', error);
      await chrome.storage.local.remove('spotify_token');

      // Create a more user-friendly error message
      let errorMessage = 'Authentication failed. ';
      if (error.message.includes('Client ID')) {
        errorMessage += 'Please check your Client ID in the Spotify Dashboard and ensure it is correct.';
      } else if (error.message.includes('Redirect URI')) {
        errorMessage += `Please add this Redirect URI to your Spotify Dashboard: ${REDIRECT_URI}`;
      } else {
        errorMessage += error.message;
      }

      throw new Error(errorMessage);
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

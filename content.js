// Constants
const TOAST_DISPLAY_DURATION = 3000;
const TOAST_FADE_DURATION = 300;
const SPOTIFY_COLORS = {
  PRIMARY: '#1DB954',
  HOVER: '#1ed760',
  ERROR: '#E22134',
  DARK: '#282828',
  BLUE: '#2E77D0'
};

// Utility functions
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Get song information from YouTube page
function getSongInfo() {
  const title = document.querySelector('h1.style-scope.ytd-watch-metadata')?.textContent;
  if (!title) return null;

  const separators = [' - ', ' – ', ' — ', ' • ', ' | '];

  // Try to extract artist and song name using separators
  for (const separator of separators) {
    if (title.includes(separator)) {
      const [artist, songName] = title.split(separator);
      return {
        artist: artist.trim(),
        song: songName.trim()
      };
    }
  }

  // If no separator found, use the entire title as song name
  return {
    song: title.trim(),
    artist: ''
  };
}

// UI Components
class Toast {
  constructor() {
    this.element = null;
    this.spinner = null;
    this.message = null;
  }

  create() {
    // Remove existing toast if any
    this.remove();

    // Create toast container
    this.element = document.createElement('div');
    this.element.id = 'spotify-toast';
    this.element.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background-color: ${SPOTIFY_COLORS.DARK};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Create spinner
    this.spinner = document.createElement('div');
    this.spinner.style.cssText = `
      width: 20px;
      height: 20px;
      border: 2px solid ${SPOTIFY_COLORS.PRIMARY};
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 1s linear infinite;
    `;

    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Create message element
    this.message = document.createElement('span');
    this.message.style.flex = '1';

    // Assemble toast
    this.element.appendChild(this.spinner);
    this.element.appendChild(this.message);
    document.body.appendChild(this.element);

    // Show toast with animation
    setTimeout(() => {
      this.element.style.opacity = '1';
    }, 100);

    return this;
  }

  async show(text, { type = 'info', duration = TOAST_DISPLAY_DURATION } = {}) {
    this.message.textContent = text;
    this.spinner.style.display = type === 'loading' ? 'block' : 'none';

    switch (type) {
      case 'success':
        this.element.style.backgroundColor = SPOTIFY_COLORS.PRIMARY;
        break;
      case 'error':
        this.element.style.backgroundColor = SPOTIFY_COLORS.ERROR;
        break;
      default:
        this.element.style.backgroundColor = SPOTIFY_COLORS.DARK;
    }

    if (duration) {
      await delay(duration);
      await this.hide();
    }
  }

  async hide() {
    this.element.style.opacity = '0';
    await delay(TOAST_FADE_DURATION);
    this.remove();
  }

  remove() {
    if (this.element && this.element.parentNode) {
      document.body.removeChild(this.element);
    }
  }
}

class SpotifyButton {
  constructor() {
    this.element = null;
    this.toast = new Toast();
  }

  create() {
    if (document.getElementById('add-to-spotify-btn')) return;

    const spotifyIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: 8px;">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.851-.16-.954-.583-.1-.422.16-.851.583-.954 4.91-1.121 9.084-.62 12.451 1.432.39.241.49.721.241 1.101zm1.472-3.272c-.301.47-.842.619-1.312.319-3.474-2.14-8.761-2.76-12.871-1.511-.533.159-1.082-.16-1.232-.682-.15-.533.16-1.082.682-1.232 4.721-1.432 10.561-.72 14.511 1.812.46.301.619.842.319 1.312zm.129-3.402c-4.151-2.468-11.022-2.698-15.002-1.492-.633.191-1.312-.16-1.503-.803-.191-.633.16-1.312.803-1.503 4.581-1.392 12.192-1.121 17.002 1.722.582.34.773 1.082.432 1.662-.341.571-1.082.762-1.662.421z"/>
      </svg>
    `;

    this.element = document.createElement('button');
    this.element.id = 'add-to-spotify-btn';
    this.element.innerHTML = `${spotifyIcon}Add to Spotify`;
    this.setupStyles();
    this.setupEventListeners();
    document.documentElement.appendChild(this.element);
  }

  setupStyles() {
    this.element.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: ${SPOTIFY_COLORS.PRIMARY};
      color: white;
      border: none;
      border-radius: 24px;
      padding: 12px 24px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateZ(0);
      -webkit-transform: translateZ(0);
      letter-spacing: 0.3px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      min-width: 160px;
    `;
  }

  setupEventListeners() {
    // Hover effects
    this.element.addEventListener('mouseenter', () => {
      this.element.style.transform = 'translateZ(0) scale(1.05)';
      this.element.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
      this.element.style.backgroundColor = SPOTIFY_COLORS.HOVER;
    });

    this.element.addEventListener('mouseleave', () => {
      this.element.style.transform = 'translateZ(0) scale(1)';
      this.element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      this.element.style.backgroundColor = SPOTIFY_COLORS.PRIMARY;
    });

    // Click effects
    this.element.addEventListener('mousedown', () => {
      this.element.style.transform = 'translateZ(0) scale(0.98)';
      this.element.style.boxShadow = '0 3px 8px rgba(0,0,0,0.3)';
    });

    this.element.addEventListener('mouseup', () => {
      this.element.style.transform = 'translateZ(0) scale(1.05)';
      this.element.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
    });

    // Main click handler
    this.element.addEventListener('click', () => this.handleClick());
  }

  async handleClick() {
    const songInfo = getSongInfo();
    if (!songInfo) {
      this.toast.create().show('Could not detect song information!', { type: 'error' });
      return;
    }

    // Disable button during process
    this.setLoading(true);

    // Show progress
    this.toast.create();
    await this.toast.show(`Searching for "${songInfo.artist} - ${songInfo.song}"...`, { type: 'loading', duration: 0 });

    // Send song info to background script
    chrome.runtime.sendMessage({ type: 'ADD_TO_SPOTIFY', data: songInfo }, async response => {
      this.setLoading(false);

      if (response?.success) {
        // Direct match found and added
        await this.handleSuccess(response.trackInfo);
      } else if (response?.searchResults?.length > 0) {
        // Multiple matches found
        await this.toast.hide();
        createSongSelectionModal(response.searchResults);
      } else {
        // Error or no matches
        const errorMessage = response?.error || 'No matching songs found on Spotify';
        await this.toast.show(`Error: ${errorMessage}`, { type: 'error' });
      }
    });
  }

  setLoading(isLoading) {
    this.element.disabled = isLoading;
    this.element.style.opacity = isLoading ? '0.7' : '1';
    this.element.style.cursor = isLoading ? 'not-allowed' : 'pointer';
  }

  async handleSuccess(trackInfo) {
    const spotifyIcon = this.element.querySelector('svg').outerHTML;
    await this.toast.show(
      `✓ Added "${trackInfo.artist} - ${trackInfo.name}" (${trackInfo.confidence}% match)`,
      { type: 'success' }
    );

    // Update button temporarily
    this.element.innerHTML = `${spotifyIcon}✓ Added`;
    this.element.style.backgroundColor = SPOTIFY_COLORS.BLUE;

    // Reset button after delay
    await delay(TOAST_DISPLAY_DURATION);
    this.element.innerHTML = `${spotifyIcon}Add to Spotify`;
    this.element.style.backgroundColor = SPOTIFY_COLORS.PRIMARY;
  }
}

// Create song selection modal
function createSongSelectionModal(searchResults) {
  // Create modal container
  const modal = document.createElement('div');
  modal.id = 'spotify-song-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #282828;
    border-radius: 12px;
    padding: 24px;
    z-index: 99999;
    width: 400px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `;

  // Create backdrop overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 99998;
    backdrop-filter: blur(5px);
  `;

  // Add click event to close modal when clicking outside
  overlay.addEventListener('click', () => {
    document.body.removeChild(modal);
    document.body.removeChild(overlay);
  });

  // Create modal header
  const title = document.createElement('h2');
  title.textContent = 'Select the correct song';
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 20px;
    color: white;
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'We found multiple matches. Please select the correct song:';
  subtitle.style.cssText = `
    margin: 0 0 20px 0;
    font-size: 14px;
    color: #b3b3b3;
  `;

  // Create song list container
  const songList = document.createElement('div');
  songList.style.cssText = `
    overflow-y: auto;
    margin-bottom: 16px;
    max-height: 400px;
  `;

  // Add songs to the list
  searchResults.forEach(track => {
    const songItem = document.createElement('div');
    songItem.style.cssText = `
      padding: 12px 16px;
      margin-bottom: 8px;
      background: #333333;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 12px;
    `;

    // Add Spotify icon
    const icon = document.createElement('div');
    icon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#1DB954">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.851-.16-.954-.583-.1-.422.16-.851.583-.954 4.91-1.121 9.084-.62 12.451 1.432.39.241.49.721.241 1.101zm1.472-3.272c-.301.47-.842.619-1.312.319-3.474-2.14-8.761-2.76-12.871-1.511-.533.159-1.082-.16-1.232-.682-.15-.533.16-1.082.682-1.232 4.721-1.432 10.561-.72 14.511 1.812.46.301.619.842.319 1.312zm.129-3.402c-4.151-2.468-11.022-2.698-15.002-1.492-.633.191-1.312-.16-1.503-.803-.191-.633.16-1.312.803-1.503 4.581-1.392 12.192-1.121 17.002 1.722.582.34.773 1.082.432 1.662-.341.571-1.082.762-1.662.421z"/>
      </svg>
    `;

    // Add song info
    const songInfo = document.createElement('div');
    songInfo.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    const songName = document.createElement('div');
    songName.textContent = track.name;
    songName.style.cssText = `
      font-weight: 500;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    const artistAlbum = document.createElement('div');
    artistAlbum.textContent = `${track.artist} • ${track.album}`;
    artistAlbum.style.cssText = `
      font-size: 13px;
      color: #b3b3b3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    // Add match confidence
    const confidence = document.createElement('div');
    confidence.textContent = `${track.confidence}%`;
    confidence.style.cssText = `
      font-size: 12px;
      color: ${track.confidence > 70 ? '#1DB954' : '#b3b3b3'};
      margin-left: 8px;
      white-space: nowrap;
    `;

    songInfo.appendChild(songName);
    songInfo.appendChild(artistAlbum);
    songItem.appendChild(icon);
    songItem.appendChild(songInfo);
    songItem.appendChild(confidence);

    // Add hover effects
    songItem.addEventListener('mouseenter', () => {
      songItem.style.background = '#404040';
    });

    songItem.addEventListener('mouseleave', () => {
      songItem.style.background = '#333333';
    });

    // Add click event to select song
    songItem.addEventListener('click', () => {
      document.body.removeChild(modal);
      document.body.removeChild(overlay);
      addSelectedSong(track);
    });

    songList.appendChild(songItem);
  });

  // Create cancel button
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    padding: 12px 24px;
    background: transparent;
    border: 1px solid #727272;
    color: white;
    border-radius: 20px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    margin-top: 8px;
  `;

  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.background = '#404040';
  });

  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.background = 'transparent';
  });

  cancelButton.addEventListener('click', () => {
    document.body.removeChild(modal);
    document.body.removeChild(overlay);
  });

  // Assemble modal
  modal.appendChild(title);
  modal.appendChild(subtitle);
  modal.appendChild(songList);
  modal.appendChild(cancelButton);

  // Add to page
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

// Function to add selected song
function addSelectedSong(track) {
  const button = document.getElementById('add-to-spotify-btn');
  const toast = new Toast();
  toast.create();

  toast.show(`Adding "${track.artist} - ${track.name}"...`, { type: 'loading', duration: 0 });

  // Send selected track to background script
  chrome.runtime.sendMessage({
    type: 'ADD_SELECTED_SONG',
    data: track
  }, async response => {
    if (response?.success) {
      // Success state
      const spotifyIcon = button.querySelector('svg').outerHTML;
      await toast.show(`✓ Added "${track.artist} - ${track.name}"`, { type: 'success' });

      button.innerHTML = `${spotifyIcon}✓ Added`;
      button.style.backgroundColor = SPOTIFY_COLORS.BLUE;

      await delay(TOAST_DISPLAY_DURATION);
      button.innerHTML = `${spotifyIcon}Add to Spotify`;
      button.style.backgroundColor = SPOTIFY_COLORS.PRIMARY;
    } else {
      // Error state
      const errorMessage = response?.error || 'Unknown error';
      await toast.show(`Error: ${errorMessage}`, { type: 'error' });
    }
  });
}

// Initialize button when page loads and URL changes
function init() {
  const spotifyButton = new SpotifyButton();
  spotifyButton.create();
}

// Start on page load
init();

// Watch for YouTube's dynamic page loads
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    init();
  }
}).observe(document, { subtree: true, childList: true }); 

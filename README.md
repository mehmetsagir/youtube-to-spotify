# YouTube to Spotify

A Chrome extension that lets you add songs from YouTube directly to your Spotify playlists.

## Features

- Add YouTube songs to Spotify with one click
- Smart song title parsing
- Multiple track matching options
- Beautiful and intuitive interface
- Secure OAuth2 authentication with Spotify

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a Spotify Developer Application:

   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new application
   - Add `chrome-extension://<extension-id>/callback.html` to the Redirect URIs
   - Copy your Client ID

4. Build the extension:

   ```bash
   npm run build
   ```

5. Load the extension in Chrome:

   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

6. Configure the extension:
   - Click the extension icon
   - Enter your Spotify Client ID
   - Click "Connect to Spotify"

## Usage

1. Go to any YouTube music video
2. Click the "Add to Spotify" button below the video
3. Select the correct track from the search results
4. The song will be added to your Spotify library

## Development

To run the extension in development mode with hot reloading:

```bash
npm run dev
```

## License

MIT

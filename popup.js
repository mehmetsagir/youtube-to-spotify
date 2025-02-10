document.addEventListener('DOMContentLoaded', async () => {
  const clientIdInput = document.getElementById('client-id');
  const saveButton = document.getElementById('save-button');
  const statusText = document.getElementById('status');
  const redirectUriElement = document.getElementById('redirect-uri');
  const copyUriButton = document.getElementById('copy-uri');
  const setupSection = document.getElementById('setup-section');
  const statusIcon = document.getElementById('status-icon');
  const statusTextElement = document.getElementById('status-text');
  const disconnectButton = document.getElementById('disconnect-button');

  // Add accordion functionality
  const accordionHeaders = document.querySelectorAll('.accordion-header');

  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      // Close all other sections
      accordionHeaders.forEach(otherHeader => {
        if (otherHeader !== header) {
          otherHeader.parentElement.classList.remove('active');
        }
      });

      // Toggle current section
      const section = header.parentElement;
      section.classList.toggle('active');
    });
  });

  // Open first accordion by default
  if (accordionHeaders.length > 0) {
    accordionHeaders[0].parentElement.classList.add('active');
  }

  // Display Redirect URI
  const redirectUri = chrome.identity.getRedirectURL();
  redirectUriElement.textContent = redirectUri;

  // Copy Redirect URI button
  copyUriButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      copyUriButton.textContent = 'Copied!';
      setTimeout(() => {
        copyUriButton.textContent = 'Copy to Clipboard';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });

  // Check connection status
  async function updateConnectionStatus() {
    const storage = await chrome.storage.local.get(['spotify_token', 'client_id']);

    if (storage.spotify_token) {
      try {
        // Validate token
        const response = await fetch('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${storage.spotify_token}` }
        });

        if (response.ok) {
          // Connected
          statusIcon.className = 'status-icon connected';
          statusTextElement.textContent = 'Connected to Spotify';
          disconnectButton.style.display = 'block';
          setupSection.classList.remove('show');
          return true;
        }
      } catch (error) {
        console.error('Token validation error:', error);
      }
    }

    // Not connected
    statusIcon.className = 'status-icon disconnected';
    statusTextElement.textContent = 'Not connected to Spotify';
    disconnectButton.style.display = 'none';
    setupSection.classList.add('show');

    // Load saved client ID if exists
    if (storage.client_id) {
      clientIdInput.value = storage.client_id;
    }

    return false;
  }

  // Initial status check
  await updateConnectionStatus();

  // Disconnect button handler
  disconnectButton.addEventListener('click', async () => {
    try {
      await chrome.storage.local.remove(['spotify_token', 'playlist_id']);
      await updateConnectionStatus();
      statusText.className = 'success';
      statusText.textContent = 'Successfully disconnected from Spotify';
      setTimeout(() => {
        statusText.className = '';
        statusText.textContent = '';
      }, 3000);
    } catch (error) {
      console.error('Disconnect error:', error);
      statusText.className = 'error';
      statusText.textContent = 'Failed to disconnect: ' + error.message;
    }
  });

  // Save button handler
  saveButton.addEventListener('click', async () => {
    const clientId = clientIdInput.value.trim();

    // Reset status
    statusText.textContent = '';
    statusText.className = '';

    try {
      // Validate client ID format
      if (!clientId) {
        throw new Error('Please enter a Client ID');
      }

      if (!/^[0-9a-f]{32}$/i.test(clientId)) {
        throw new Error('Invalid Client ID format. It should be 32 characters long and contain only letters and numbers.');
      }

      // Save client ID
      await chrome.storage.local.set({ client_id: clientId });

      // Clear any existing token to force re-authentication
      await chrome.storage.local.remove(['spotify_token', 'playlist_id']);

      // Test authentication
      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('response_type', 'token');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('scope', [
        'playlist-modify-public',
        'playlist-modify-private',
        'user-read-private',
        'playlist-read-private',
        'playlist-read-collaborative'
      ].join(' '));
      authUrl.searchParams.append('show_dialog', 'true');

      console.log('Testing authentication with redirect URI:', redirectUri);

      const redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true
      });

      if (!redirectUrl) {
        throw new Error('Authentication window was closed. Please try again and allow the popup.');
      }

      const hash = redirectUrl.split('#')[1];
      if (!hash) {
        throw new Error('No response from Spotify. Please verify your Client ID and make sure you\'ve added this Redirect URI to your Spotify Dashboard: ' + redirectUri);
      }

      const params = new URLSearchParams(hash);
      const error = params.get('error');
      const accessToken = params.get('access_token');

      if (error) {
        if (error === 'invalid_client') {
          throw new Error('Invalid Client ID. Please check your Client ID in Spotify Dashboard.');
        }
        throw new Error(`Spotify error: ${error}`);
      }

      if (!accessToken) {
        throw new Error('No access token received. Please make sure you\'ve added this Redirect URI to your Spotify Dashboard: ' + redirectUri);
      }

      // Validate token with Spotify API
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to validate access token. Please check your Spotify Developer settings.');
      }

      // Save the validated token
      await chrome.storage.local.set({ spotify_token: accessToken });

      // Update connection status
      await updateConnectionStatus();

      // Show success message
      statusText.textContent = 'Successfully connected to Spotify!';
      statusText.className = 'success';

      // Hide after 3 seconds
      setTimeout(() => {
        statusText.textContent = '';
        statusText.className = '';
      }, 3000);

    } catch (error) {
      console.error('Authentication error:', error);

      // Show error message
      statusText.textContent = error.message;
      statusText.className = 'error';

      // Add helper text for common issues
      if (error.message.includes('Redirect URI')) {
        const helperText = document.createElement('div');
        helperText.className = 'helper-text';
        helperText.innerHTML = `
          <p>To fix this:</p>
          <ol>
            <li>Go to <a href="https://developer.spotify.com/dashboard" target="_blank">Spotify Dashboard</a></li>
            <li>Select your app</li>
            <li>Click "Edit Settings"</li>
            <li>Add this Redirect URI: <code>${redirectUri}</code></li>
            <li>Click "Add" and then "Save"</li>
          </ol>
        `;
        statusText.appendChild(helperText);
      }
    }
  });
}); 

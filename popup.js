document.addEventListener('DOMContentLoaded', async () => {
  const statusElement = document.getElementById('status');
  const authButton = document.getElementById('auth-button');
  const clientIdGroup = document.getElementById('client-id-group');
  const clientIdInput = document.getElementById('client-id-input');

  // Client ID ve token kontrolü yap
  const storage = await chrome.storage.local.get(['spotify_token', 'client_id']);

  if (storage.spotify_token) {
    statusElement.textContent = 'Connected to Spotify';
    authButton.textContent = 'Disconnect';
    clientIdGroup.classList.remove('show');
  } else {
    if (storage.client_id) {
      clientIdInput.value = storage.client_id;
    }
    clientIdGroup.classList.add('show');
  }

  // Auth butonuna tıklandığında
  authButton.addEventListener('click', async () => {
    const storage = await chrome.storage.local.get(['spotify_token', 'client_id']);

    if (storage.spotify_token) {
      // Bağlantıyı kes
      await chrome.storage.local.remove(['spotify_token', 'playlist_id', 'client_id']);
      statusElement.textContent = 'Click the green button on YouTube video pages to add songs to your Spotify playlist.';
      authButton.textContent = 'Connect Spotify';
      clientIdGroup.classList.add('show');
      clientIdInput.value = '';
    } else {
      // Client ID kontrolü
      const clientId = clientIdInput.value.trim();
      if (!clientId) {
        statusElement.textContent = 'Please enter your Spotify Client ID';
        return;
      }

      // Client ID'yi kaydet
      await chrome.storage.local.set({ client_id: clientId });

      // Background script'e auth başlatması için mesaj gönder
      chrome.runtime.sendMessage({
        type: 'SPOTIFY_AUTH',
        clientId: clientId
      }, response => {
        if (response?.success) {
          statusElement.textContent = 'Connected to Spotify';
          authButton.textContent = 'Disconnect';
          clientIdGroup.classList.remove('show');
        } else {
          statusElement.textContent = 'Authentication failed. Please check your Client ID and try again.';
        }
      });
    }
  });
}); 

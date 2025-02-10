// Constants
const TOAST_DISPLAY_DURATION = 1500;
const TOAST_FADE_DURATION = 200;
const BUTTON_RESET_DURATION = 1000;
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
  constructor(buttonElement) {
    this.element = null;
    this.spinner = null;
    this.message = null;
    this.buttonElement = buttonElement;
  }

  create() {
    // Remove existing toast if any
    this.remove();

    // Create toast container
    this.element = document.createElement('div');
    this.element.id = 'spotify-toast';
    this.element.style.cssText = `
    position: fixed;
      background-color: ${SPOTIFY_COLORS.DARK};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 9999;
    font-family: Arial, sans-serif;
    min-width: 200px;
      max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transition: opacity 0.3s ease;
      word-wrap: break-word;
      box-sizing: border-box;
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
      flex-shrink: 0;
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

    // Position toast after it's added to get correct dimensions
    this.positionToast();

    // Show toast with animation
    setTimeout(() => {
      this.element.style.opacity = '1';
    }, 100);

    return this;
  }

  positionToast() {
    const buttonRect = this.buttonElement.getBoundingClientRect();
    const toastRect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 10; // Margin between toast and button/screen edges

    // Calculate initial position (prefer above the button)
    let top = buttonRect.top - toastRect.height - margin;
    let left = buttonRect.left;

    // If toast would go off the top, position it below the button
    if (top < margin) {
      top = buttonRect.bottom + margin;
    }

    // If toast would go off the bottom, position it above the button
    if (top + toastRect.height > viewportHeight - margin) {
      top = buttonRect.top - toastRect.height - margin;
    }

    // If toast would go off the right, align it with the right edge of the screen
    if (left + toastRect.width > viewportWidth - margin) {
      left = viewportWidth - toastRect.width - margin;
    }

    // If toast would go off the left, align it with the left edge of the screen
    if (left < margin) {
      left = margin;
    }

    // Apply the calculated position
    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
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

    // Reposition after content update
    this.positionToast();

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
    this.toast = null; // Initialize toast as null
    this.fullscreenHandler = this.handleFullscreenChange.bind(this);
    this.isDragging = false;
    this.currentX = 0;
    this.currentY = 0;
    this.initialX = 0;
    this.initialY = 0;
    this.xOffset = 0;
    this.yOffset = 0;
    this.longPressTimer = null;
    this.longPressDuration = 500; // 500ms for long press
    this.handleResize = this.handleResize.bind(this);
  }

  async create() {
    console.log('SpotifyButton create method called');
    // Check if button already exists
    if (document.getElementById('spotify-button-container')) {
      console.log('Button container already exists, returning');
      return;
    }

    if (document.getElementById('add-to-spotify-btn')) {
      console.log('Button already exists, returning');
      return;
    }

    console.log('Creating new button...');
    const spotifyIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: 0">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.851-.16-.954-.583-.1-.422.16-.851.583-.954 4.91-1.121 9.084-.62 12.451 1.432.39.241.49.721.241 1.101zm1.472-3.272c-.301.47-.842.619-1.312.319-3.474-2.14-8.761-2.76-12.871-1.511-.533.159-1.082-.16-1.232-.682-.15-.533.16-1.082.682-1.232 4.721-1.432 10.561-.72 14.511 1.812.46.301.619.842.319 1.312zm.129-3.402c-4.151-2.468-11.022-2.698-15.002-1.492-.633.191-1.312-.16-1.503-.803-.191-.633.16-1.312.803-1.503 4.581-1.392 12.192-1.121 17.002 1.722.582.34.773 1.082.432 1.662-.341.571-1.082.762-1.662.421z"/>
    </svg>
  `;

    const settingsIcon = `
      <div class="settings-handle" title="Settings">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </div>
    `;

    const dragHandle = `
      <div class="drag-handle" title="Drag to move button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="7" r="1" fill="currentColor"/>
          <circle cx="12" cy="12" r="1" fill="currentColor"/>
          <circle cx="12" cy="17" r="1" fill="currentColor"/>
          <circle cx="17" cy="7" r="1" fill="currentColor"/>
          <circle cx="17" cy="12" r="1" fill="currentColor"/>
          <circle cx="17" cy="17" r="1" fill="currentColor"/>
          <circle cx="7" cy="7" r="1" fill="currentColor"/>
          <circle cx="7" cy="12" r="1" fill="currentColor"/>
          <circle cx="7" cy="17" r="1" fill="currentColor"/>
        </svg>
      </div>
    `;

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'spotify-button-container';
    buttonContainer.style.cssText = `
      position: fixed;
      z-index: 9999999;
      display: flex;
      align-items: center;
      gap: 8px;
      visibility: visible !important;
      opacity: 1 !important;
    `;

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'controls-container';
    controlsContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'settings-container';
    settingsContainer.innerHTML = settingsIcon;
    settingsContainer.style.cssText = `
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    this.element = document.createElement('button');
    this.element.id = 'add-to-spotify-btn';
    this.element.innerHTML = spotifyIcon;
    this.element.style.cssText = `
      display: flex !important;
      align-items: center;
      justify-content: center;
      background-color: ${SPOTIFY_COLORS.PRIMARY};
      color: white;
      border: none;
      border-radius: 20px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      visibility: visible !important;
      opacity: 1 !important;
    `;

    // Load button style preference
    const storage = await chrome.storage.local.get('spotify_button_style');
    const showText = storage.spotify_button_style !== 'icon_only';
    this.updateButtonStyle(showText);

    buttonContainer.appendChild(settingsContainer);
    buttonContainer.appendChild(this.element);
    buttonContainer.appendChild(controlsContainer);
    controlsContainer.insertAdjacentHTML('beforeend', dragHandle);

    // Create settings dropdown first
    const settingsDropdown = document.createElement('div');
    settingsDropdown.className = 'settings-dropdown';
    settingsDropdown.innerHTML = `
      <div class="settings-item" id="toggle-button-style">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
        <span>Toggle Button Style</span>
      </div>
      <div class="settings-item" id="reset-position">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        <span>Reset Position</span>
      </div>
    `;
    settingsContainer.appendChild(settingsDropdown);

    // Add hover effect for controls
    buttonContainer.addEventListener('mouseenter', () => {
      settingsContainer.style.opacity = '1';
      controlsContainer.style.opacity = '1';
    });

    buttonContainer.addEventListener('mouseleave', (e) => {
      // Check if the mouse is moving to the settings dropdown
      if (settingsDropdown.contains(e.relatedTarget) || settingsContainer.contains(e.relatedTarget)) {
        return;
      }

      settingsContainer.style.opacity = '0';
      controlsContainer.style.opacity = '0';
      settingsContainer.classList.remove('active');
    });

    // Add mouseleave event for the settings dropdown
    settingsDropdown.addEventListener('mouseleave', (e) => {
      // Only close if not moving back to the button container
      if (!buttonContainer.contains(e.relatedTarget)) {
        settingsContainer.style.opacity = '0';
        controlsContainer.style.opacity = '0';
        settingsContainer.classList.remove('active');
      }
    });

    // Add styles for settings
    const style = document.createElement('style');
    style.textContent = `
      .settings-container {
        position: relative;
      }

      .settings-handle {
        width: 28px;
        height: 28px;
        background: rgba(128, 128, 128, 0.15);
        border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .settings-handle:hover {
        background: rgba(128, 128, 128, 0.25);
      }

      .settings-handle svg {
        width: 16px;
        height: 16px;
        color: rgba(255, 255, 255, 0.8);
        opacity: 0.8;
        transition: all 0.2s ease;
      }

      .settings-handle:hover svg {
        opacity: 1;
        color: rgba(255, 255, 255, 1);
      }

      .settings-dropdown {
        position: absolute;
        left: 0;
        top: calc(100% - 4px);
        background: #282828;
        border-radius: 8px;
        padding: 4px;
        display: none;
        flex-direction: column;
        gap: 2px;
        min-width: 180px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }

      .settings-dropdown::before {
        content: '';
        position: absolute;
        top: -10px;
        left: 0;
        right: 0;
        height: 10px;
        background: transparent;
      }

      .settings-container.active .settings-dropdown {
        display: flex;
      }

      .settings-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: white;
      }

      .settings-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .settings-item svg {
        width: 16px;
        height: 16px;
        opacity: 0.8;
      }

      .settings-item:hover svg {
        opacity: 1;
      }

      .settings-item span {
        font-size: 13px;
      }

      .drag-handle {
        width: 28px;
        height: 28px;
        background: rgba(128, 128, 128, 0.15);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        transition: all 0.2s ease;
      }

      .drag-handle:hover {
        background: rgba(128, 128, 128, 0.25);
      }

      .drag-handle:active {
        cursor: grabbing;
        background: rgba(128, 128, 128, 0.35);
      }

      .drag-handle svg {
        width: 16px;
        height: 16px;
        color: rgba(255, 255, 255, 0.8);
        opacity: 0.8;
      }

      .drag-handle:hover svg {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    // Load saved position
    const position = await this.loadPosition();

    // Set initial position
    if (position.x === 0 && position.y === 0) {
      // If no saved position, place it at the bottom right
      this.xOffset = window.innerWidth - 200; // 200px from right
      this.yOffset = window.innerHeight - 100; // 100px from bottom
    } else {
      this.xOffset = position.x;
      this.yOffset = position.y;
    }

    this.setupDragListeners(buttonContainer);
    document.body.appendChild(buttonContainer);
    this.setupFullscreenHandlers();
    this.setupResizeHandler(buttonContainer);

    // Make sure the button is visible
    buttonContainer.style.display = 'flex';
    buttonContainer.style.visibility = 'visible';

    // Apply position
    this.setTranslate(this.xOffset, this.yOffset, buttonContainer);

    this.toast = new Toast(this.element);

    // Settings dropdown functionality
    const settingsHandle = settingsContainer.querySelector('.settings-handle');
    const toggleButtonStyle = settingsDropdown.querySelector('#toggle-button-style');
    const resetPosition = settingsDropdown.querySelector('#reset-position');

    settingsHandle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // First, make dropdown temporarily visible but hidden to calculate dimensions
      settingsDropdown.style.display = 'flex';
      settingsDropdown.style.visibility = 'hidden';

      // Calculate available space
      const dropdownRect = settingsDropdown.getBoundingClientRect();
      const containerRect = settingsContainer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - containerRect.bottom;
      const spaceAbove = containerRect.top;

      // Reset previous positioning
      settingsDropdown.style.top = '';
      settingsDropdown.style.bottom = '';
      settingsDropdown.style.left = '';
      settingsDropdown.style.right = '';

      // Position dropdown based on available space
      if (spaceBelow < dropdownRect.height && spaceAbove > dropdownRect.height) {
        // Open upwards if there's more space above
        settingsDropdown.style.bottom = '100%';
        settingsDropdown.style.top = 'auto';
        settingsDropdown.style.marginTop = '0';
        settingsDropdown.style.marginBottom = '4px';
      } else {
        // Open downwards (default)
        settingsDropdown.style.top = '100%';
        settingsDropdown.style.bottom = 'auto';
        settingsDropdown.style.marginTop = '4px';
        settingsDropdown.style.marginBottom = '0';
      }

      // Reset visibility and toggle active state
      settingsDropdown.style.visibility = '';
      settingsDropdown.style.display = '';
      settingsContainer.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!settingsContainer.contains(e.target)) {
        settingsContainer.classList.remove('active');
      }
    });

    // Toggle button style handler
    toggleButtonStyle.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const storage = await chrome.storage.local.get('spotify_button_style');
      const showText = storage.spotify_button_style === 'icon_only';
      await chrome.storage.local.set({ 'spotify_button_style': showText ? 'with_text' : 'icon_only' });
      this.updateButtonStyle(showText);
      settingsContainer.classList.remove('active');
    });

    // Reset position handler
    resetPosition.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Default position (bottom right)
      this.xOffset = window.innerWidth - 200; // 200px from right
      this.yOffset = window.innerHeight - 100; // 100px from bottom

      // Apply position with animation
      buttonContainer.style.transition = 'transform 0.3s ease';
      this.setTranslate(this.xOffset, this.yOffset, buttonContainer);

      // Save the position
      await this.savePosition(this.xOffset, this.yOffset);

      // Reset transition after animation
      setTimeout(() => {
        buttonContainer.style.transition = '';
      }, 300);

      settingsContainer.classList.remove('active');
    });

    // Update styles for dropdown
    style.textContent = `
      ${style.textContent}
      .settings-dropdown::before {
        content: '';
        position: absolute;
        height: 10px;
        left: 0;
        right: 0;
        background: transparent;
      }

      .settings-container.active .settings-dropdown[style*="bottom: 100%"] {
        padding-bottom: 8px;
      }

      .settings-container.active .settings-dropdown[style*="bottom: 100%"]::before {
        bottom: -10px;
      }

      .settings-container.active .settings-dropdown[style*="top: 100%"] {
        padding-top: 8px;
      }

      .settings-container.active .settings-dropdown[style*="top: 100%"]::before {
        top: -10px;
      }
    `;
  }

  setupDragListeners(container) {
    const dragHandle = container.querySelector('.drag-handle');
    let isDragging = false;

    const handleDragStart = (e) => {
      if (e.type === 'mousedown' && e.button !== 0) return; // Only left click
      e.preventDefault();
      e.stopPropagation();

      isDragging = true;
      container.setAttribute('data-dragging', 'true');
      dragHandle.style.cursor = 'grabbing';
      container.style.transition = 'none';

      const startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
      const startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;

      this.initialX = startX - this.xOffset;
      this.initialY = startY - this.yOffset;
    };

    const handleDragMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();

      const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
      const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;

      this.currentX = clientX - this.initialX;
      this.currentY = clientY - this.initialY;

      this.xOffset = this.currentX;
      this.yOffset = this.currentY;

      this.setTranslate(this.currentX, this.currentY, container);
    };

    const handleDragEnd = () => {
      if (!isDragging) return;

      isDragging = false;
      container.setAttribute('data-dragging', 'false');
      dragHandle.style.cursor = 'grab';
      container.style.transition = 'box-shadow 0.3s ease';

      this.savePosition(this.xOffset, this.yOffset);
    };

    // Mouse events
    dragHandle.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    // Touch events
    dragHandle.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
    document.addEventListener('touchcancel', handleDragEnd);

    // Prevent context menu
    dragHandle.addEventListener('contextmenu', e => e.preventDefault());
  }

  setTranslate(xPos, yPos, container) {
    const rect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Ensure button stays within viewport bounds
    if (xPos < 0) xPos = 0;
    if (xPos > viewportWidth - rect.width) xPos = viewportWidth - rect.width;
    if (yPos < 0) yPos = 0;
    if (yPos > viewportHeight - rect.height) yPos = viewportHeight - rect.height;

    // Apply transform
    container.style.transform = `translate(${xPos}px, ${yPos}px)`;
  }

  async savePosition(x, y) {
    try {
      await chrome.storage.local.set({ 'spotify_button_position': { x, y } });
    } catch (error) {
      console.error('Failed to save button position:', error);
    }
  }

  async loadPosition() {
    try {
      const result = await chrome.storage.local.get('spotify_button_position');
      return result.spotify_button_position || { x: 0, y: 0 };
    } catch (error) {
      console.error('Failed to load button position:', error);
      return { x: 0, y: 0 };
    }
  }

  setupFullscreenHandlers() {
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', this.fullscreenHandler);
    document.addEventListener('webkitfullscreenchange', this.fullscreenHandler);
    document.addEventListener('mozfullscreenchange', this.fullscreenHandler);
    document.addEventListener('MSFullscreenChange', this.fullscreenHandler);

    // Initial check
    this.handleFullscreenChange();
  }

  handleFullscreenChange() {
    const isFullscreen =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (this.element) {
      this.element.style.display = isFullscreen ? 'none' : 'flex';
    }
  }

  setupEventListeners() {
    // Hover effects
    this.element.addEventListener('mouseenter', () => {
      if (!this.isDragging) {
        this.element.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
        this.element.style.backgroundColor = SPOTIFY_COLORS.HOVER;
      }
    });

    this.element.addEventListener('mouseleave', () => {
      if (!this.isDragging) {
        this.element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        this.element.style.backgroundColor = SPOTIFY_COLORS.PRIMARY;
      }
    });

    // Main click handler
    this.element.addEventListener('click', (e) => {
      // Only handle click if we're not dragging
      if (!this.isDragging) {
        this.handleClick();
      }
    });
  }

  async handleClick() {
    // First check if connected to Spotify
    try {
      const storage = await chrome.storage.local.get(['spotify_token', 'client_id']);

      if (!storage.spotify_token || !storage.client_id) {
        // Not connected, open popup
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        this.toast.create().show('Please connect your Spotify account first', { type: 'info' });
        return;
      }

      // Check if token is valid
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${storage.spotify_token}` }
      });

      if (!response.ok) {
        // Token invalid, open popup
        chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        this.toast.create().show('Spotify connection expired. Please reconnect.', { type: 'info' });
        return;
      }

      // If we're here, we're connected. Proceed with normal flow
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
    } catch (error) {
      this.toast.create().show('An error occurred. Please try again.', { type: 'error' });
      console.error('Error in handleClick:', error);
    }
  }

  setLoading(isLoading) {
    this.element.disabled = isLoading;
    this.element.style.opacity = isLoading ? '0.7' : '1';
    this.element.style.cursor = isLoading ? 'not-allowed' : 'pointer';
  }

  updateButtonStyle(showText) {
    const spotifyIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: ${showText ? '8px' : '0'}">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.851-.16-.954-.583-.1-.422.16-.851.583-.954 4.91-1.121 9.084-.62 12.451 1.432.39.241.49.721.241 1.101zm1.472-3.272c-.301.47-.842.619-1.312.319-3.474-2.14-8.761-2.76-12.871-1.511-.533.159-1.082-.16-1.232-.682-.15-.533.16-1.082.682-1.232 4.721-1.432 10.561-.72 14.511 1.812.46.301.619.842.319 1.312zm.129-3.402c-4.151-2.468-11.022-2.698-15.002-1.492-.633.191-1.312-.16-1.503-.803-.191-.633.16-1.312.803-1.503 4.581-1.392 12.192-1.121 17.002 1.722.582.34.773 1.082.432 1.662-.341.571-1.082.762-1.662.421z"/>
      </svg>
    `;

    this.element.innerHTML = showText ? `${spotifyIcon}Add to Spotify` : spotifyIcon;
    this.element.className = showText ? 'with-text' : 'icon-only';
    this.element.style.padding = showText ? '8px 16px' : '8px';
    this.element.style.minWidth = showText ? 'auto' : '32px';
    this.element.style.width = showText ? 'auto' : '32px';
    this.element.style.height = showText ? 'auto' : '32px';
    this.element.style.borderRadius = showText ? '20px' : '50%';
  }

  async handleSuccess(trackInfo) {
    const storage = await chrome.storage.local.get('spotify_button_style');
    const showText = storage.spotify_button_style !== 'icon_only';
    const spotifyIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right: ${showText ? '8px' : '0'}">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.371-.721.49-1.101.241-3.021-1.858-6.832-2.278-11.322-1.237-.422.1-.851-.16-.954-.583-.1-.422.16-.851.583-.954 4.91-1.121 9.084-.62 12.451 1.432.39.241.49.721.241 1.101zm1.472-3.272c-.301.47-.842.619-1.312.319-3.474-2.14-8.761-2.76-12.871-1.511-.533.159-1.082-.16-1.232-.682-.15-.533.16-1.082.682-1.232 4.721-1.432 10.561-.72 14.511 1.812.46.301.619.842.319 1.312zm.129-3.402c-4.151-2.468-11.022-2.698-15.002-1.492-.633.191-1.312-.16-1.503-.803-.191-.633.16-1.312.803-1.503 4.581-1.392 12.192-1.121 17.002 1.722.582.34.773 1.082.432 1.662-.341.571-1.082.762-1.662.421z"/>
      </svg>
    `;

    // Hemen buton durumunu güncelle
    if (showText) {
      this.element.innerHTML = `${spotifyIcon}✓ Added`;
      this.element.style.backgroundColor = SPOTIFY_COLORS.BLUE;
    }

    // Toast mesajını göster
    await this.toast.show(
      `✓ Added "${trackInfo.artist} - ${trackInfo.name}" (${trackInfo.confidence}% match)`,
      { type: 'success' }
    );

    // Butonu eski haline getir
    setTimeout(() => {
      this.updateButtonStyle(showText);
      this.element.style.backgroundColor = SPOTIFY_COLORS.PRIMARY;
    }, BUTTON_RESET_DURATION);
  }

  setupResizeHandler(container) {
    // Add resize event listener
    window.addEventListener('resize', () => this.handleResize(container));
  }

  handleResize(container) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // Calculate position as percentage of viewport
    const rightPercentage = ((viewportWidth - (this.xOffset + containerWidth)) / viewportWidth) * 100;
    const bottomPercentage = ((viewportHeight - (this.yOffset + containerHeight)) / viewportHeight) * 100;

    // If button was positioned relative to right side (less than 50% from right edge)
    if (rightPercentage < 50) {
      // Maintain distance from right edge
      this.xOffset = viewportWidth - containerWidth - (rightPercentage * viewportWidth / 100);
    }

    // If button was positioned relative to bottom (less than 50% from bottom edge)
    if (bottomPercentage < 50) {
      // Maintain distance from bottom edge
      this.yOffset = viewportHeight - containerHeight - (bottomPercentage * viewportHeight / 100);
    }

    // Ensure button stays within viewport bounds
    if (this.xOffset < 0) this.xOffset = 0;
    if (this.xOffset > viewportWidth - containerWidth) this.xOffset = viewportWidth - containerWidth;
    if (this.yOffset < 0) this.yOffset = 0;
    if (this.yOffset > viewportHeight - containerHeight) this.yOffset = viewportHeight - containerHeight;

    // Apply the new position
    this.setTranslate(this.xOffset, this.yOffset, container);

    // Save the new position
    this.savePosition(this.xOffset, this.yOffset);
  }

  // Update cleanup in the class
  cleanup() {
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('fullscreenchange', this.fullscreenHandler);
    document.removeEventListener('webkitfullscreenchange', this.fullscreenHandler);
    document.removeEventListener('mozfullscreenchange', this.fullscreenHandler);
    document.removeEventListener('MSFullscreenChange', this.fullscreenHandler);
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
  const toast = new Toast(button);
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

// Watch for YouTube's dynamic page loads
let lastUrl = location.href;
let navigationObserver = null;

let isButtonInitialized = false;
let isProcessingMutation = false;

function removeExistingButton() {
  const containers = document.querySelectorAll('#spotify-button-container');
  containers.forEach(container => {
    const spotifyButton = container.spotifyButton;
    if (spotifyButton) {
      spotifyButton.cleanup();
    }
    container.remove();
  });
  isButtonInitialized = false;
}

function createOrUpdateButton() {
  console.log('createOrUpdateButton called');
  if (isProcessingMutation) {
    console.log('Processing mutation, skipping button creation');
    return;
  }

  if (!isButtonInitialized) {
    console.log('Button not initialized, creating new button');
    isButtonInitialized = true;
    const spotifyButton = new SpotifyButton();
    spotifyButton.create().then(() => {
      console.log('Button created successfully');
      spotifyButton.setupEventListeners();
    }).catch(error => {
      console.error('Error creating button:', error);
      isButtonInitialized = false;
    });
  } else {
    console.log('Button already initialized');
  }
}

function setupNavigationObserver() {
  console.log('Setting up navigation observer');
  // If there's an existing observer, disconnect it
  if (navigationObserver) {
    navigationObserver.disconnect();
  }

  // Create new observer for the main app container
  navigationObserver = new MutationObserver((mutations) => {
    // If already processing or button is being dragged, skip
    if (isProcessingMutation) {
      console.log('Already processing mutation, skipping');
      return;
    }

    // Check if URL has changed
    if (location.href !== lastUrl) {
      console.log('URL changed, reinitializing button');
      lastUrl = location.href;
      isButtonInitialized = false;
      checkAndInitializeButton();
      return;
    }

    // Don't check for changes if we're dragging the button
    const container = document.getElementById('spotify-button-container');
    if (container?.getAttribute('data-dragging') === 'true') {
      console.log('Button is being dragged, skipping');
      return;
    }

    // Set processing flag
    isProcessingMutation = true;

    try {
      // Check for video content changes
      for (const mutation of mutations) {
        if (mutation.target.id === 'content' ||
          mutation.target.id === 'info' ||
          mutation.target.id === 'container' ||
          mutation.target.tagName === 'YTD-WATCH-METADATA' ||
          mutation.target.tagName === 'YTD-WATCH-FLEXY') {
          console.log('Video content changed, checking button');
          checkAndInitializeButton();
          break;
        }
      }
    } finally {
      // Reset processing flag
      isProcessingMutation = false;
    }
  });

  // Start observing
  const appContainer = document.querySelector('ytd-app');
  if (appContainer) {
    console.log('Found app container, starting observation');
    navigationObserver.observe(appContainer, {
      childList: true,
      subtree: true,
      attributes: true
    });
  } else {
    console.log('App container not found');
  }
}

function checkAndInitializeButton() {
  console.log('checkAndInitializeButton called');
  // Check if we're on a video page
  if (!window.location.pathname.startsWith('/watch')) {
    console.log('Not on a video page, removing button');
    removeExistingButton();
    return;
  }

  console.log('On video page, waiting for elements...');
  // Wait for video metadata to load
  waitForElements({
    selectors: [
      'ytd-watch-metadata',
      'h1.style-scope.ytd-watch-metadata',
      '#description-inline-expander'
    ],
    timeout: 10000,
    onSuccess: () => {
      console.log('Elements found, checking if music video');
      if (isMusicVideo()) {
        console.log('Music video detected, creating button');
        createOrUpdateButton();
      } else {
        console.log('Not a music video, removing button');
        removeExistingButton();
      }
    },
    onTimeout: () => {
      console.log('Timeout waiting for video metadata');
      removeExistingButton();
    }
  });
}

function waitForElements({ selectors, timeout, onSuccess, onTimeout }) {
  const startTime = Date.now();

  function checkElements() {
    const allElementsExist = selectors.every(selector => {
      const element = document.querySelector(selector);
      return element !== null;
    });

    if (allElementsExist) {
      onSuccess();
      return;
    }

    if (Date.now() - startTime >= timeout) {
      onTimeout();
      return;
    }

    requestAnimationFrame(checkElements);
  }

  checkElements();
}

// Initialize on page load
function initialize() {
  setupNavigationObserver();
  checkAndInitializeButton();
}

// Start observing when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Re-initialize on navigation
window.addEventListener('popstate', checkAndInitializeButton);
window.addEventListener('pushstate', checkAndInitializeButton);
window.addEventListener('replacestate', checkAndInitializeButton);

// Cleanup on unload
window.addEventListener('unload', () => {
  if (navigationObserver) {
    navigationObserver.disconnect();
  }
});

// Check if the current video is a song
function isMusicVideo() {
  console.log('Checking if music video...');
  // First check for music metadata
  const categoryRows = document.querySelectorAll('ytd-metadata-row-renderer');
  let isInMusicCategory = false;
  let hasMusicMetadata = false;

  console.log('Found category rows:', categoryRows.length);
  // Check each metadata row
  categoryRows.forEach(row => {
    const title = row.querySelector('#title')?.textContent?.toLowerCase()?.trim() || '';
    const content = row.querySelector('#content')?.textContent?.toLowerCase()?.trim() || '';
    console.log('Metadata row:', { title, content });

    // Check if video is in Music category
    if (title === 'category' && content === 'music') {
      isInMusicCategory = true;
      console.log('Music category detected');
    }

    // Check for music-specific metadata
    if (['song', 'artist', 'album', 'licensed to youtube by', 'music', 'provided to youtube by'].includes(title)) {
      hasMusicMetadata = true;
      console.log('Music metadata detected');
    }
  });

  // If we found direct music metadata, it's definitely a music video
  if (hasMusicMetadata) {
    console.log('Has music metadata, returning true');
    return true;
  }

  // Check video title for music indicators
  const videoTitle = document.querySelector('h1.style-scope.ytd-watch-metadata')?.textContent?.toLowerCase() || '';
  console.log('Video title:', videoTitle);
  const titleIndicators = [
    'official music video',
    'official audio',
    'lyrics',
    'music video',
    '(audio)',
    '[audio]',
    '(official video)',
    '[official video]',
    'ft.',
    'feat.',
    'remix',
    'cover',
    'official',
    'resmi',
    'klip',
    'clip',
    'mv',
    'lyric video',
    'performance',
    'live',
    'acoustic'
  ];

  if (titleIndicators.some(indicator => videoTitle.includes(indicator))) {
    return true;
  }

  // Check description for additional confirmation
  const description = document.querySelector('#description-inline-expander')?.textContent?.toLowerCase() || '';
  const musicIndicators = [
    'official music video',
    'official audio',
    'official video',
    'lyrics',
    'provided to youtube by',
    'released on:',
    'track:',
    '℗',
    '©',
    'listen on spotify',
    'stream on spotify',
    'available on spotify',
    'music video',
    'audio visualizer',
    'lyric video',
    'artist:',
    'song:',
    'album:',
    'genre:',
    'music video by',
    'official music video by',
    'all rights reserved',
    'auto-generated by youtube',
    'provided to youtube'
  ];

  if (musicIndicators.some(indicator => description.includes(indicator))) {
    return true;
  }

  // If it's in the Music category, it's likely a music video
  return isInMusicCategory;
} 

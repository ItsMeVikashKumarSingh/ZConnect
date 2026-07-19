(function() {
  // Prevent duplicate load
  if (window.ZConnectLoaded) return;
  window.ZConnectLoaded = true;

  // Retrieve configuration from script attributes
  const scriptTag = document.currentScript;
  const projectId = scriptTag.getAttribute('data-project-id');
  const userId = scriptTag.getAttribute('data-user-id');
  const userEmail = scriptTag.getAttribute('data-user-email');
  const userName = scriptTag.getAttribute('data-user-name');
  const signature = scriptTag.getAttribute('data-signature');
  const priority = scriptTag.getAttribute('data-priority') || 'false';

  if (!projectId) {
    console.error('ZConnect: Missing data-project-id attribute.');
    return;
  }

  // Inject Styles for Widget & Iframe container
  const style = document.createElement('style');
  style.innerHTML = `
    .zconnect-wrapper {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .zconnect-iframe-container {
      display: none;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 120px);
      max-width: calc(100vw - 48px);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    .zconnect-iframe-container.active {
      display: block;
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .zconnect-bubble-btn {
      float: right;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary-accent, #0D2B5C);
      box-shadow: 0 4px 16px rgba(13, 43, 92, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      outline: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .zconnect-bubble-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(13, 43, 92, 0.4);
    }
    .zconnect-bubble-icon {
      fill: #ffffff;
      width: 24px;
      height: 24px;
      transition: transform 0.3s ease;
    }
    .zconnect-bubble-btn.active .zconnect-bubble-icon {
      transform: rotate(90deg);
    }
  `;
  document.head.appendChild(style);

  // Create Wrapper Div
  const wrapper = document.createElement('div');
  wrapper.className = 'zconnect-wrapper';

  // Create Iframe Container
  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'zconnect-iframe-container';

  // Build iframe URL
  const hostUrl = scriptTag.src.replace('/widget.js', '');
  const query = new URLSearchParams({
    projectId,
    ...(userId && { userId }),
    ...(userEmail && { email: userEmail }),
    ...(userName && { name: userName }),
    ...(signature && { signature }),
    ...(priority && { priority }),
  });
  
  const iframe = document.createElement('iframe');
  iframe.src = `${hostUrl}/widget?${query.toString()}`;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframeContainer.appendChild(iframe);
  wrapper.appendChild(iframeContainer);

  // Create Toggle Button
  const button = document.createElement('button');
  button.className = 'zconnect-bubble-btn';
  button.innerHTML = `
    <svg class="zconnect-bubble-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
    </svg>
  `;
  wrapper.appendChild(button);
  document.body.appendChild(wrapper);

  // Toggle Functionality
  let isOpen = false;
  button.addEventListener('click', () => {
    isOpen = !isOpen;
    if (isOpen) {
      iframeContainer.classList.add('active');
      button.classList.add('active');
      button.innerHTML = `
        <svg class="zconnect-bubble-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      `;
    } else {
      iframeContainer.classList.remove('active');
      button.classList.remove('active');
      button.innerHTML = `
        <svg class="zconnect-bubble-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      `;
    }
  });

  // Handle cross-document messaging if needed
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'zconnect_started') {
      console.log('ZConnect: Ticket created successfully.', event.data.conversationId);
    }
  });
})();

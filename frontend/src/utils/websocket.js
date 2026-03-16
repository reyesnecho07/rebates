// frontend/src/utils/websocket.js
class PermissionWebSocket {
  constructor() {
    this.socket = null;
    this.listeners = [];
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectToken = null;
  }

  // ✅ NEW: Get WebSocket URL from environment
  getWebSocketUrl(token) {
    // Get base URL from environment or fallback to localhost
    const wsBaseUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3006';
    
    // Remove any trailing slashes
    const cleanUrl = wsBaseUrl.replace(/\/$/, '');
    
    // Construct full WebSocket URL
    return `${cleanUrl}/ws/permissions?token=${token}`;
  }

  connect(token) {
    // ✅ Prevent multiple connection attempts
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      return;
    }
    
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    // ✅ Check if we've exceeded max reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('⚠️ Max WebSocket reconnection attempts reached. WebSocket disabled.');
      return;
    }

    this.reconnectToken = token;
    
    try {
      // ✅ FIXED: Use dynamic WebSocket URL
      const wsUrl = this.getWebSocketUrl(token);
      //console.log('🔌 Attempting WebSocket connection to:', wsUrl.replace(/token=.+/, 'token=***'));
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        //console.log('✅ WebSocket connected for permission updates');
        this.connected = true;
        this.reconnectAttempts = 0; // Reset on successful connection
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'PERMISSION_UPDATE') {
            // Notify all listeners
            this.listeners.forEach(listener => listener(data.payload));
            
            // Trigger global event
            window.dispatchEvent(new CustomEvent('permissions-updated', {
              detail: data.payload
            }));
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        } 
      };
      
      this.socket.onerror = (error) => {
        // ✅ Don't spam console with errors - just log once
        if (this.reconnectAttempts === 0) {
          console.warn('⚠️ WebSocket connection failed. Real-time updates disabled.');
          console.warn('   Check that backend is running at:', this.getWebSocketUrl('').replace(/\?token=$/, ''));
        }
        this.connected = false;
      };
      
      this.socket.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason || 'No reason provided');
        this.connected = false;
        this.socket = null;
        
        // ✅ Only attempt reconnection if under limit
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.reconnectToken) {
          this.reconnectAttempts++;
          console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in 5s...`);
          setTimeout(() => {
            if (this.reconnectToken) {
              this.connect(this.reconnectToken);
            }
          }, 5000);
        } else {
          console.log('⚠️ WebSocket reconnection stopped. Continuing without real-time updates.');
        }
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      this.connected = false;
    }
  }
  
  disconnect() {
    this.reconnectToken = null; // Prevent auto-reconnection
    this.reconnectAttempts = 0;
    
    if (this.socket) {
      try {
        this.socket.close();
      } catch (error) {
        console.warn('⚠️ Error closing WebSocket:', error);
      }
      this.socket = null;
      this.connected = false;
    }
  }
  
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // ✅ Manual reconnect with reset
  forceReconnect(token) {
    console.log('🔄 Force reconnecting WebSocket...');
    this.reconnectAttempts = 0;
    this.disconnect();
    setTimeout(() => {
      this.connect(token);
    }, 100);
  }

  // ✅ NEW: Get connection status
  isConnected() {
    return this.connected && this.socket?.readyState === WebSocket.OPEN;
  }

  // ✅ NEW: Get current WebSocket URL (for debugging)
  getCurrentUrl() {
    return this.getWebSocketUrl('').replace(/\?token=$/, '');
  }
}

export const permissionWebSocket = new PermissionWebSocket();
const EventEmitter = require('events');
const CryptoJS = require('crypto-js');

class DataChannel extends EventEmitter {
  /**
   * Constructor
   * @param {Object} middleMAM - The MiddleMAM object
   * @param {String} dataChannelSecretKey - The secret key used to encrypt
   * and decrypt data channel messages
   */
  constructor(middleMAM, dataChannelSecretKey) {
    super();
    this.middleMAM = middleMAM;
    this.encryptionKey = dataChannelSecretKey;

    this.dataChannel = this.middleMAM.peerConnection.createDataChannel(
      'datachannel',
      {
        reliable: false
      }
    );
    this.dataChannel.onopen = () => {
      console.log('|------ Data Channel Opened ------|');
      this.emit('channelOpen');
      this.middleMAM.stop = true;
    };
    this.dataChannel.onclose = () => {
      console.log('|------ Data Channel Closed ------|');
    };
    this.dataChannel.onerror = () => {
      console.log('|------ Data Channel Error ------|');
    };
    this.middleMAM.peerConnection.ondatachannel = event => {
      event.channel.onopen = () => {
        console.log('|------ Data Channel Ready ------|');
      };
      event.channel.onmessage = e => {
        let msgComing = this.decrypt(e.data);
        console.log('Message coming from DataChannel: ' + msgComing);
        this.emit('msgComing', msgComing);
      };
    };
  }

  /**
   * Start connection
   */
  connect() {
    this.middleMAM.connect();
  }

  /**
   * Send a message through the data channel
   * @param {String} message
   */
  sendMessage(message) {
    console.log('Sending Message over DataChannel: ' + message);
    this.dataChannel.send(this.encrypt(message));
  }

  /**
   * Encrypt a message
   * @param {String} message
   * @returns {String} The encrypted message
   */
  encrypt(message) {
    return CryptoJS.AES.encrypt(message, this.encryptionKey).toString();
  }

  /**
   * Decrypt a message
   * @param {String} message
   * @returns {String} The decrypted message
   */
  decrypt(message) {
    return CryptoJS.AES.decrypt(message, this.encryptionKey).toString(
      CryptoJS.enc.Utf8
    );
  }
}

module.exports = DataChannel;

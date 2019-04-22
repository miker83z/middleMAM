const EventEmitter = require('events');

class VideoChannel extends EventEmitter {
  /**
   * Constructor
   * @param {Object} middleMAM - The MiddleMAM object
   */
  constructor(middleMAM) {
    super();
    this.middleMAM = middleMAM;

    this.middleMAM.peerConnection.onaddstream = event => {
      console.log('Stream coming from Channel');
      this.middleMAM.stop = true;
      this.emit('streamComing', event.stream);
    };
  }

  /**
   * Start connection
   */
  connect() {
    this.middleMAM.connect();
  }

  /**
   * Add a stream
   * @param {Object} stream
   */
  addStream(stream) {
    this.middleMAM.peerConnection.addStream(stream);
  }
}

module.exports = VideoChannel;

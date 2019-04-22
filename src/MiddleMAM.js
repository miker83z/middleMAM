const MAMChannel = require('./MAMChannel.js');

class MiddleMAM {
  /**
   * Constructor
   * @param {Object} settings - Parameters required for middleMAM
   */
  constructor(settings) {
    this.mode = 'private';
    this.config = settings.peerConfig;
    this.connection = settings.connection;
    this.sdpConstraints = settings.sdpConstraints;
    this.id = Math.floor(Math.random() * 1000000000);

    this.offered = false;
    this.localDescriptionSet = false;
    this.stop = false;

    // Open MAMChannel
    this.mam = new MAMChannel(
      this.mode,
      settings.iotaProvider,
      settings.seedSecretKey,
      null
    );
    this.mam.openChannel();
    console.log(this.mam.getRoot());

    // Create a PeerConnection with connection and config parameters
    this.peerConnection = new RTCPeerConnection(this.config, this.connection);
  }

  /**
   * Starts reading from MAM Channel every 2 sec searcing for offers or answers
   */
  async connect() {
    let actualRoot = this.mam.getRoot();
    while (!this.stop) {
      console.log('Searching for ' + actualRoot);
      const result = await this.mam.fetchFrom(actualRoot);
      if (
        typeof result.messages !== 'undefined' &&
        result.messages.length > 0
      ) {
        result.messages.forEach(message => this.processNegotiationMsg(message));
        actualRoot = result.nextRoot;
      }
      if (!this.offered) {
        this.sendOffer();
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  /**
   * Start Data Channel sending an offer
   */
  async sendOffer() {
    // Create the offer, then set the local description and send the offer
    try {
      // Create offer
      const offer = await this.peerConnection.createOffer();
      // Set LocalDescription if not already done
      if (!this.localDescriptionSet) {
        await this.peerConnection.setLocalDescription(offer);
        await this.waitForAllICEs();
        this.localDescriptionSet = true;
      }
      // Send offer
      console.log('|------- Sending Offer -------|');
      this.sendNegotiationMsg(
        'offer',
        this.peerConnection.localDescription
      ).then(() => (this.offered = true));
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Send message to the signaling server i.e. MAM channel
   * @param {String} type - The message type: 'offer' or 'answer'
   * @param {Object} payload - The message's payload
   * @returns {String} The message's root
   */
  async sendNegotiationMsg(type, payload) {
    const msg = {
      from: this.id,
      action: type,
      data: payload
    };
    console.log('Sending: ' + JSON.stringify(msg));
    return await this.mam.publish(msg);
  }

  /**
   * Process msgs coming from the signaling server i.e. MAM channel
   * @param {Object} msg - The message received from the other peer
   */
  processNegotiationMsg(msg) {
    if (msg.from !== this.id) {
      console.log('Fetched', msg, '\n');
      if (msg.action == 'offer') {
        this.offered = true;
        this.processOffer(msg.data);
      } else if (msg.action == 'answer') {
        this.processAnswer(msg.data);
      }
    }
  }

  /**
   * Connect to offered Data Channel
   * @param {Object} offer - The offer received from the other peer
   */
  async processOffer(offer) {
    // Create answer and set the remoteDescription to the offer sdp
    try {
      // Set remote description
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      // Create answer
      const answer = await this.peerConnection.createAnswer(
        this.sdpConstraints
      );
      // Set LocalDescription if not already done
      if (!this.localDescriptionSet) {
        await this.peerConnection.setLocalDescription(answer);
        await this.waitForAllICEs();
        this.localDescriptionSet = true;
      }
      // Send answer
      console.log('|------ Sending Answer ------|');
      this.sendNegotiationMsg('answer', this.peerConnection.localDescription);
      console.log('|------ Processed Offer ------|');
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Process the answer received
   * @param {Object} answer - The answer received from the other peer
   */
  processAnswer(answer) {
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('|------ Processed Answer ------|');
  }

  /**
   * Wait for all ice candidates
   */
  waitForAllICEs() {
    // Set PeerConnection onIceCandidate event handler, to gather ice candidates and send them to the other user
    return new Promise((fufill, reject) => {
      this.peerConnection.onicecandidate = iceEvent => {
        if (iceEvent.candidate === null) fufill();
      };
      setTimeout(
        () => reject('Waited a long time for ice candidates...'),
        10000
      );
    });
  }
}

module.exports = MiddleMAM;

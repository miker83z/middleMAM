const MiddleMAM = require('./MiddleMAM.js');
const EventEmitter = require('events');

class VideoChannel extends EventEmitter {
    constructor(mamChannelSecretKey, iotaProvider, peerConfig) {
        super();
        let settings = {
            mamChannelSecretKey: mamChannelSecretKey,
            iotaProvider: iotaProvider,
            peerConfig: peerConfig,
            sdpConstraints: {},
            connection: null
        };
        this.middleMAM = new MiddleMAM(settings);

        this.middleMAM.peerConnection.onaddstream = (event => {
            console.log("Stream coming from Channel");
            this.middleMAM.stop = true;
            this.emit('streamComing', event.stream);
        });
    }

    connect(root, secretKey) {
        this.middleMAM.connect(root, secretKey);
    }

    addStream(stream) {
        this.middleMAM.peerConnection.addStream(stream);
    }

}

export default VideoChannel;
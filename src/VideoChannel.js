import MiddleMAM from './MiddleMAM.js';
import EventEmitter from 'events';

class VideoChannel extends EventEmitter {
    constructor(seedSecretKey, iotaProvider, peerConfig) {
        super();
        let settings = {
            seedSecretKey: seedSecretKey,
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

    connect() {
        this.middleMAM.connect();
    }

    addStream(stream) {
        this.middleMAM.peerConnection.addStream(stream);
    }

}

export default VideoChannel;
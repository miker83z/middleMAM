const MiddleMAM = require('./MiddleMAM.js');
const CryptoJS = require("crypto-js");
const EventEmitter = require('events');

class DataChannel extends EventEmitter {
    constructor(mamChannelSecretKey, dataChannelSecretKey, iotaProvider, peerConfig) {
        super();
        let settings = {
            mamChannelSecretKey: mamChannelSecretKey,
            iotaProvider: iotaProvider,
            peerConfig: peerConfig,
            sdpConstraints: {
                'mandatory': {
                    'OfferToReceiveAudio': false,
                    'OfferToReceiveVideo': false
                }
            },
            connection: null
        };
        this.middleMAM = new MiddleMAM(settings);
        this.encryptionKey = dataChannelSecretKey;

        this.dataChannel = this.middleMAM.peerConnection.createDataChannel("datachannel", { reliable: false });
        this.dataChannel.onopen = () => {
            console.log("|------ Data Channel Opened ------|");
            this.emit('channelOpen');
            this.middleMAM.stop = true;
        };
        this.dataChannel.onclose = () => {
            console.log("|------ Data Channel Closed ------|");
        };
        this.dataChannel.onerror = () => {
            console.log("|------ Data Channel Error ------|");
        };
        this.middleMAM.peerConnection.ondatachannel = event => {
            event.channel.onopen = () => {
                console.log('|------ Data Channel Ready ------|');
            };
            event.channel.onmessage = (e) => {
                let msgComing = this.decrypt(e.data);
                console.log("Message coming from DataChannel: " + (msgComing));
                this.emit('msgComing', msgComing);
            };
        };
    }

    connect(root, secretKey) {
        this.middleMAM.connect(root, secretKey);
    }

    sendMessage(msg) {
        console.log("Sending Message over DataChannel: " + (msg));
        this.dataChannel.send(this.encrypt(msg));
    }

    encrypt(msg) {
        return CryptoJS.AES.encrypt(msg, this.encryptionKey).toString();
    }

    decrypt(msg) {
        return CryptoJS.AES.decrypt(msg, this.encryptionKey).toString(CryptoJS.enc.Utf8);
    }
}

export default DataChannel;
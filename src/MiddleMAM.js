const Mam = require('@iota/mam');
const { asciiToTrytes, trytesToAscii } = require('@iota/converter');

class MAMChannel {
    constructor(mode, secretKey, provider) {
        this.mode = mode;
        this.secretKey = secretKey;
        this.provider = provider;
        this.mamState = null;
    }

    // Create and set channel mode
    createChannel() {
        this.mamState = Mam.init(this.provider);
        this.mamState = Mam.changeMode(this.mamState, this.mode, this.secretKey);
    }

    // Return the root of the state
    getRoot() {
        return Mam.getRoot(this.mamState);
    }

    // Publish to tangle
    async publish(packet) {
        // Create MAM Payload - STRING OF TRYTES
        const trytes = asciiToTrytes(JSON.stringify(packet));
        const message = Mam.create(this.mamState, trytes);

        // Save new mamState
        this.mamState = message.state;

        // Attach the payload
        await Mam.attach(message.payload, message.address, 3, 9);
        console.log('Published:', packet, '\nRoot:', message.root, '\n');
        return message.root;
    }

    async fetch(root, secretKey) {
        let result = await Mam.fetch(root, this.mode, secretKey);
        if (typeof result.messages !== 'undefined' && result.messages.length > 0) {
            for (var i = result.messages.length - 1; i >= 0; i--) {
                result.messages[i] = JSON.parse(trytesToAscii(result.messages[i]));
            }
        }
        return result;
    }
}

class MiddleMAM {
    constructor(settings) {
        this.mode = 'restricted';
        this.config = settings.peerConfig;
        this.connection = settings.connection;
        this.sdpConstraints = settings.sdpConstraints;

        this.offered = false;
        this.stop = false;

        // 0 - Create MAMChannel
        this.mam = new MAMChannel(this.mode, settings.mamChannelSecretKey, settings.iotaProvider);
        this.mam.createChannel();
        console.log(this.mam.getRoot());

        // 1 - Create PeerConnection with connection and config parameters
        this.peerConnection = new webkitRTCPeerConnection(this.config, this.connection);
        // Set PeerConnection onIceCandidate event handler, to gather ice candidates and send them to the other user
        this.peerConnection.onicecandidate = e => {
            if (!this.peerConnection || !e || !e.candidate) return;
            var candidate = event.candidate;
            this.sendNegotiationMsg("candidate", candidate);
        };
    }

    // Send message to the signaling server - MAM channel
    async sendNegotiationMsg(type, sdp) {
        const json = { action: type, data: sdp };
        console.log("Sending: " + JSON.stringify(json));
        return await this.mam.publish(json);
    }

    processNegotiationMsg(json) {
        console.log('Fetched', json, '\n');
        if (json.action == "candidate") {
            this.peerConnection.addIceCandidate(
                new RTCIceCandidate(json.data)
            ).catch(e => console.log(e));

        } else if (json.action == "offer") {
            this.offered = true;
            this.processOffer(json.data);

        } else if (json.action == "answer") {
            this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(json.data));
            console.log("|------ Processed Answer ------|");
        }
    }

    // 3B - Connect to offered Data Channel
    processOffer(offer) {
        // Create answer and set the remoteDescription to the offer sdp
        this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            ).then(() => this.peerConnection.createAnswer(this.sdpConstraints))
            .then(sdp => this.peerConnection.setLocalDescription(sdp))
            .then(() => {
                console.log("|------ Sending Answer ------|");
                this.sendNegotiationMsg("answer", this.peerConnection.localDescription);
            })
            .catch(e => console.log(e));

        console.log("|------ Processed Offer ------|");
    }

    // 3 - Start Data Channel sending an offer
    sendOffer() {
        // 4 - Create offer, set LocalDescription and send it: Creates the offer, then sets the local description and sends the offer
        this.peerConnection.createOffer(this.sdpConstraints)
            .then(sdp => this.peerConnection.setLocalDescription(sdp))
            .then(() => {
                console.log("|------- Sending Offer -------|");
                this.sendNegotiationMsg("offer", this.peerConnection.localDescription);
            })
            .then(() => this.offered = true)
            .catch(e => console.log(e));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async connect(root, secretKey) {
        let tmpRoot = root;
        while (!this.stop) {
            console.log('Searching for ' + tmpRoot);
            const result = await this.mam.fetch(tmpRoot, secretKey);
            if (typeof result.messages !== 'undefined' && result.messages.length > 0) {
                result.messages.forEach(message => {
                    this.processNegotiationMsg(message);
                });
                tmpRoot = result.nextRoot;
            }
            if (!this.offered) {
                this.sendOffer();
            }
            await this.sleep(3000);
        }
    }
}

module.exports = MiddleMAM;
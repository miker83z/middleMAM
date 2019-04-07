import MAMChannel from './MAMChannel.js';

class MiddleMAM {
    constructor(settings) {
        this.mode = 'private';
        this.config = settings.peerConfig;
        this.connection = settings.connection;
        this.sdpConstraints = settings.sdpConstraints;
        this.id = Math.floor(Math.random() * 1000000000);

        this.offered = false;
        this.localDescriptionSet = false;
        this.stop = false;

        // 0 - Create MAMChannel
        this.mam = new MAMChannel(this.mode, settings.seedSecretKey, null, settings.iotaProvider);
        this.mam.createChannel();
        console.log(this.mam.getRoot());

        // 1 - Create PeerConnection with connection and config parameters
        this.peerConnection = new RTCPeerConnection(this.config, this.connection);
        // Set PeerConnection onIceCandidate event handler, to gather ice candidates and send them to the other user
        this.peerConnection.onicecandidate = e => {
            if (!this.peerConnection || !e || !e.candidate) return;
            var candidate = event.candidate;
            this.sendNegotiationMsg(this.id, "candidate", candidate);
        };
    }

    // Send message to the signaling server - MAM channel
    async sendNegotiationMsg(from, type, sdp) {
        const json = {
            from: from,
            action: type,
            data: sdp
        };
        console.log("Sending: " + JSON.stringify(json));
        return await this.mam.publish(json);
    }

    processNegotiationMsg(json) {
        if (json.from !== this.id) {
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
    }

    // 3B - Connect to offered Data Channel
    processOffer(offer) {
        // Create answer and set the remoteDescription to the offer sdp
        this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            ).then(() => this.peerConnection.createAnswer(this.sdpConstraints))
            .then(sdp => {
                if (!this.localDescriptionSet) {
                    this.peerConnection.setLocalDescription(sdp);
                    this.localDescriptionSet = true;
                }
            })
            .then(() => {
                console.log("|------ Sending Answer ------|");
                this.sendNegotiationMsg(this.id, "answer", this.peerConnection.localDescription);
            })
            .catch(e => console.log(e));

        console.log("|------ Processed Offer ------|");
    }

    // 3 - Start Data Channel sending an offer
    sendOffer() {
        // 4 - Create offer, set LocalDescription and send it: Creates the offer, then sets the local description and sends the offer
        this.peerConnection.createOffer(this.sdpConstraints)
            .then(sdp => {
                if (!this.localDescriptionSet) {
                    this.peerConnection.setLocalDescription(sdp);
                    this.localDescriptionSet = true;
                }
            })
            .then(() => {
                console.log("|------- Sending Offer -------|");
                this.sendNegotiationMsg(this.id, "offer", this.peerConnection.localDescription);
            })
            .then(() => this.offered = true)
            .catch(e => console.log(e));
    }

    async connect() {
        let tmpRoot = this.mam.getRoot();
        while (!this.stop) {
            console.log('Searching for ' + tmpRoot);
            const result = await this.mam.fetch(tmpRoot);
            if (typeof result.messages !== 'undefined' && result.messages.length > 0) {
                result.messages.forEach(message => {
                    this.processNegotiationMsg(message);
                });
                tmpRoot = result.nextRoot;
            }
            if (!this.offered) {
                this.sendOffer();
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

export default MiddleMAM;
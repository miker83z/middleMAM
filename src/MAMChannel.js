import {
    init,
    changeMode,
    getRoot as _getRoot,
    create,
    attach,
    fetch as _fetch,
    fetchSingle
} from '@iota/mam';
import {
    asciiToTrytes,
    trytesToAscii
} from '@iota/converter';
import seedrandom from 'seedrandom';

class MAMChannel {
    constructor(mode, seedKey, sideKey, provider) {
        this.mode = mode;
        this.seed = this.iotaSeedGen(seedKey);
        this.sideKey = sideKey;
        this.provider = provider;
        this.mamState = null;
    }

    // Generate a random iota seed through the key  
    iotaSeedGen(key) {
        const rng = seedrandom(key);
        const iotaSeedLength = 81;
        const seedCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ9';
        let result = '';

        for (let i = 0; i < iotaSeedLength; i++) {
            const x = Math.round(rng() * seedCharset.length) % seedCharset.length;
            result += seedCharset[x];
        }

        return result;
    }

    // Create and set channel mode
    createChannel() {
        this.mamState = init(this.provider, this.seed);
        this.mamState = changeMode(this.mamState, this.mode, this.sideKey);
    }

    // Return the root of the state
    getRoot() {
        return _getRoot(this.mamState);
    }

    // Publish to tangle
    async publish(packet) {
        // Create MAM Payload - STRING OF TRYTES
        let trytes = asciiToTrytes(JSON.stringify(packet));
        let message = null;
        let limit = 0;
        do {
            message = create(this.mamState, trytes);
            this.mamState = message.state;
        } while (typeof (await fetchSingle(message.root, this.mode)).payload !== 'undefined' && limit++ < 20);

        // Attach the payload
        try {
            await attach(message.payload, message.address, 3, 9);
            console.log('Published:', packet, '\nRoot:', message.root, '\n');
        } catch (e) {
            console.log(e);
        }
        return message.root;
    }

    async fetch(root) {
        let result = await _fetch(root, this.mode, this.sideKey);
        if (typeof result.messages !== 'undefined' && result.messages.length > 0) {
            for (var i = result.messages.length - 1; i >= 0; i--) {
                result.messages[i] = JSON.parse(trytesToAscii(result.messages[i]));
            }
        }
        return result;
    }
}

export default MAMChannel;
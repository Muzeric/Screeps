var utils = require('utils');
const profiler = require('screeps-profiler');

var queue = {
    producing: {},

    init: function () {
        Memory.labRequests = Memory.labRequests || {};
        this.producing = {};
        for (let reqID in Memory.labRequests) {
            let request = Memory.labRequests[reqID];
            if (request.amount < LAB_REACTION_AMOUNT)
                request.amount = LAB_REACTION_AMOUNT;
            this.producing[request.roomName] = this.producing[request.roomName] || {};
            this.producing[request.roomName][request.type] = this.producing[request.roomName][request.type] || {};
            this.producing[request.roomName][request.type][request.outputType] = (this.producing[request.roomName][request.type][request.outputType] || 0) + request.amount;
        }
    },

    getProducing: function (roomName, type, rt) {
        if (!roomName || !type || !rt || !(roomName in this.producing) || !(type in this.producing[roomName]) || !(rt in this.producing[roomName][type]))
            return 0;
        
        return this.producing[roomName][type][rt];
    },

    addRequest: function (roomName, rt, amountTotal = LAB_REQUEST_AMOUNT, type = LAB_REQUEST_TYPE_TERMINAL, chainID) {
        if (!roomName || !rt) {
            console.log(`queueLab.addRequest: no roomName (${roomName}) or rt (${rt})`);
            return null;
        }
        let reqID = _.ceil(Math.random() * 1000000);
        if (reqID in Memory.labRequests) {
            console.log(`queueLab.addRequest: req_id (${reqID}) already exists`);
            return null;
        }

        let inputTypes = global.cache.minerals.getInputTypes(rt);
        if (inputTypes.length != 2) {
            console.log(`queueLab.addRequest: length input rt for ${rt} = ${inputTypes.length}`);
            return null;
        }

        while (amountTotal > 0) {
            let amount = utils.clamp(amountTotal, 0, LAB_REQUEST_AMOUNT);
            amountTotal -= amount;

            Memory.labRequests[reqID] = {
                id: reqID,
                chainID,
                roomName,
                type,
                outputType: rt,
                amount,
                done: 0,
                startTime: 0,
                inputType1: inputTypes[0],
                inputType2: inputTypes[1],
                createTime: Game.time,
            };

            this.producing[roomName] = this.producing[roomName] || {};
            this.producing[roomName][type] = this.producing[roomName][type] || {};
            this.producing[roomName][type][rt] = (this.producing[roomName][type][rt] || 0) + amount;

            console.log("queueLab.addRequest: ADDED: " + JSON.stringify(Memory.labRequests[reqID]));
        }

        return reqID;
    },

    produceAmount: function (reqID, amount) {
        let request = Memory.labRequests[reqID];
        if (!request)
            return null;
        request.amount -= amount;
        request.done += amount;
        if (request.amount <= 0) {
            console.log("queueLab: finished request: " + JSON.stringify(request));
            delete Memory.labRequests[reqID];
            return null;
        } else if ( request.amount < LAB_REACTION_AMOUNT) {
            request.amount = LAB_REACTION_AMOUNT;
        }

        return request.amount;
    },

    badRequest: function (reqID) {
        if (reqID in Memory.labRequests) {
            console.log("queueLab.badRequest: " + JSON.stringify(Memory.labRequests[reqID]));
            delete Memory.labRequests[reqID];
        }
        return;
    }
};

module.exports = queue;
profiler.registerObject(queue, 'queueLab');
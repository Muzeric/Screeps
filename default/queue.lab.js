var utils = require('utils');
const profiler = require('screeps-profiler');

var queue = {
    labReserved: {},

    init: function () {
        Memory.labRequests = Memory.labRequests || {};
        this.labReserved = this.genReserved();
    },

    genReserved: function () {
        let res = {};
        for (let reqID in Memory.labRequests) {
            let request = Memory.labRequests[reqID];
            res[request.roomName] = res[request.roomName] || {};
            res[request.roomName][request.rt] = res[request.roomName][request.rt] + request.amount;
        }
        return res;
    },

    getReserved: function (roomName, rt) {
        if (!(roomName in this.labReserved))
            return 0;
        
        if (!(rt in this.labReserved[roomName]))
            return 0;
        
        return this.labReserved[roomName][rt];
    },

    addRequest: function (roomName, rt, amount = LAB_REQUEST_AMOUNT, type = LAB_REQUEST_TYPE_TERMINAL) {
        if (!roomName || !rt) {
            console.log(`minerals.addRequest: no roomName (${roomName}) or rt (${rt})`);
            return null;
        }
        let reqID = _.ceil(Math.random() * 1000000);
        if (reqID in Memory.labRequests) {
            console.log(`minerals.addRequest: req_id (${reqID}) already exists`);
            return null;
        }

        Memory.labRequests[reqID] = {
            id: reqID,
            roomName,
            type,
            resourceType: rt,
            amount,
            reacted: 0,
            startTime: 0,
            lab1ID: 0,
            lab2ID: 0,
            outputLabs: [],
            stage: LAB_REQUEST_STAGE_CREATED,
            createTime: Game.time,
        };

        console.log("minerals.addRequest: ADDED: " + JSON.stringify(Memory.labRequests[reqID]));

        return reqID;
    },
};

module.exports = queue;
profiler.registerObject(queue, 'queueLab');
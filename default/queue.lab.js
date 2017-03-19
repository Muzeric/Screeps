var utils = require('utils');
const profiler = require('screeps-profiler');

var queue = {
    resourceReservedByLabs: {},
    labsReserved: {},

    init: function () {
        Memory.labRequests = Memory.labRequests || {};
        for (let reqID in Memory.labRequests) {
            let request = Memory.labRequests[reqID];
            this.resourceReservedByLabs[request.roomName] = this.resourceReservedByLabs[request.roomName] || {};
            this.resourceReservedByLabs[request.roomName][request.rt] = this.resourceReservedByLabs[request.roomName][request.rt] + request.amount;
            //if (request.lab1ID)
            //    this.labsReserved[request.lab1ID] = ;
        }
        
    },

    getReserved: function (roomName, rt) {
        if (!(roomName in this.resourceReservedByLabs))
            return 0;
        
        return this.resourceReservedByLabs[roomName][rt] || 0;
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

    badRequest: function (reqID) {
        let request = Memory.labRequests[reqID];
        if (!request)
            return OK;

        request.lab1ID = null;
        request.lab2ID = null;
        request.outputLabs = [];
        request.stage = LAB_REQUEST_STAGE_CREATED;

        return OK;
    }
};

module.exports = queue;
profiler.registerObject(queue, 'queueLab');
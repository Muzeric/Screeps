var utils = require('utils');
const profiler = require('screeps-profiler');

var queue = {
    resourceReservedByLabs: {},
    busyLabs: {},
    
    init: function () {
        Memory.labRequests = Memory.labRequests || {};
        for (let reqID in Memory.labRequests) {
            let request = Memory.labRequests[reqID];
            this.resourceReservedByLabs[request.roomName] = this.resourceReservedByLabs[request.roomName] || {};
            this.resourceReservedByLabs[request.roomName][request.rt] = this.resourceReservedByLabs[request.roomName][request.rt] + request.amount;
            if (request.stage > LAB_REQUEST_STAGE_CREATED) {
                let inputResourceTypes = global.cache.minerals.getInputResourceTypes(request.resourceType);
                this.busyLabs[request.roomName] = this.busyLabs[request.roomName] || {};
                this.busyLabs[request.roomName][request.lab1ID] = inputResourceTypes[0];
                this.busyLabs[request.roomName][request.lab2ID] = inputResourceTypes[1];
                for (let labID in request.outputLabs)
                    this.busyLabs[request.roomName][request.labID] = request.resourceType;
            }
        }
    },

    setRequestLabs: function (reqID, lab1ID, lab2ID, outputLabID) {
        let request = Memory.labRequests[reqID];
        if (!request)
            return ERR_NOT_FOUND;
        request.lab1ID = lab1ID;
        request.lab2ID = lab2ID;
        request.outputLabs = [outputLabID];
        request.stage = LAB_REQUEST_STAGE_PREPARE;

        return OK;
    },

    searchLabs: function (roomName, rt) {
        let res = [];
        for (let request of _.filter(Memory.labRequests, r => r.roomName == roomName && r.stage > LAB_REQUEST_STAGE_CREATED)) {
            let inputResourceTypes = global.cache.minerals.getInputResourceTypes(request.resourceType);
            if (rt == inputResourceTypes[0])
                res.push(request.lab1ID);
            else if (rt == inputResourceTypes[1])
                res.push(request.lab2ID);
            else if (rt == request.resourceType)
                res.concat(request.outputLabs);
        }

        return res;
    },

    getFreeLabs: function (room, exclude = []) {
        let roomName = room.name;
        freeLabs = {};
        this.busyLabs[roomName] = this.busyLabs[roomName] || {};

        for (let labID in _.map( room.getLabs(), l => l.id)) {
            if (!(labID in this.busyLabs[roomName]) && !(labID in exclude))
                freeLabs[labID] = 1;
        }

        return freeLabs;
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
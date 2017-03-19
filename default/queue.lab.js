var utils = require('utils');
const profiler = require('screeps-profiler');

var queue = {
    producing: {},
    reserved: {},
    busyLabs: {},
    
    init: function () {
        Memory.labRequests = Memory.labRequests || {};
        for (let reqID in Memory.labRequests) {
            let request = Memory.labRequests[reqID];
            this.producing[request.roomName] = this.producing[request.roomName] || {};
            this.producing[request.roomName][request.outputType] = this.producing[request.roomName][request.outputType] + request.amount;
            if (request.stage > LAB_REQUEST_STAGE_PREPARE) {
                this.busyLabs[request.roomName] = this.busyLabs[request.roomName] || {};
                if (request.lab1ID && request.lab2ID) {
                    this.busyLabs[request.roomName][request.lab1ID] = request.inputType1;
                    this.busyLabs[request.roomName][request.lab2ID] = request.inputType2;
                    this.reserved[request.roomName][request.inputType1] = request.amount;
                    this.reserved[request.roomName][request.inputType2] = request.amount;
                }
                for (let labID of request.outputLabs)
                    this.busyLabs[request.roomName][request.labID] = request.outputType;
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
        this.busyLabs[request.roomName][request.lab1ID] = request.inputType1;
        this.busyLabs[request.roomName][request.lab2ID] = request.inputType2;
        this.busyLabs[request.roomName][outputLabID] = request.outputType;
        request.stage = LAB_REQUEST_STAGE_PREPARE;

        return OK;
    },

    searchLabs: function (roomName, rt) {
        let res = [];
        for (let request of _.filter(Memory.labRequests, r => r.roomName == roomName && r.stage > LAB_REQUEST_STAGE_CREATED)) {
            if (rt == request.inputType1)
                res.push(request.lab1ID);
            else if (rt == request.inputType2)
                res.push(request.lab2ID);
            else if (rt == request.outputType)
                res.concat(request.outputLabs);
        }

        return res;
    },

    getFreeLab: function (room, exclude = []) {
        let roomName = room.name;
        let freeLabs = {};
        this.busyLabs[roomName] = this.busyLabs[roomName] || {};

        for (let labID of _.map( room.getLabs(), l => l.id)) {
            if (!(labID in this.busyLabs[roomName]) && exclude.indexOf(labID) == -1)
                return labID;
        }

        return null;
    },

    getProducing: function (roomName, rt) {
        if (!(roomName in this.producing))
            return 0;
        
        return this.producing[roomName][rt] || 0;
    },

    getReserved: function (roomName, rt) {
        if (!(roomName in this.reserved))
            return 0;
        
        return this.reserved[roomName][rt] || 0;
    },

    getFreeAmount: function (roomName, rt) {
        return this.getProducing(roomName, rt) - this.getReserved(roomName, rt);
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

        let inputTypes = global.cache.minerals.getInputTypes(rt);
        if (inputTypes.length != 2) {
            console.log(`minerals.addRequest: length input rt for ${rt} = ${inputTypes.length}`);
            return null;
        }

        Memory.labRequests[reqID] = {
            id: reqID,
            roomName,
            type,
            outputType: rt,
            amount,
            reacted: 0,
            startTime: 0,

            lab1ID: 0,
            inputType1: inputTypes[0],
            requestID1: null,

            lab2ID: 0,
            inputType2: inputTypes[1],
            requestID2: null,

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
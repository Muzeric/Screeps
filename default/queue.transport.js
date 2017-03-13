var utils = require('utils');
const profiler = require('screeps-profiler');

var queue = {
    mainRoomName: "W48N4",

    getDefaultStorage: function (point) {
        return Game.rooms[this.mainRoomName].storage;
    },

    getDefaultTerminal: function (point) {
        return Game.rooms[this.mainRoomName].terminal;
    },

    addRequest: function (from, to, resourceType, amount) {
        if (!from && !to) {
            console.log("queueTransport.addRequest: no from and to");
            return null;
        }
        if (!resourceType && !from) {
            console.log("queueTransport.addRequest: no from and resourceType");
            return null;
        }
        if (!amount && !from) {
            console.log("queueTransport.addRequest: no from and amoount");
            return null;
        }
        
        let req_from = from || this.getDefaultStorage();
        let req_to = to || this.getDefaultStorage();
        if (!req_from || !req_to) {
            console.log(`queueTransport.addRequest: can't calc any of these: from=${req_from}, to=${req_to}`);
            return null;
        }
        let req_resourceType = resourceType || _.filter(Object.keys(req_from.store), k => req_from.store[k])[0];
        let req_amount = amount || req_from.store[req_resourceType];
        if (!req_resourceType || !req_amount) {
            console.log(`queueTransport.addRequest: can't calc any of these: resourceType=${req_resourceType}, amount=${req_amount}`);
            return null;
        }
        let req_id = _.ceil(Math.random() * 1000000);
        if (req_id in Memory.transportRequests) {
            console.log(`queueTransport.addRequest: req_id (${req_id}) already exists`);
            return null;
        }
        
        Memory.transportRequests[req_id] = {
            fromID: req_from.id,
            toID: req_to.id,
            resourceType: req_resourceType,
            amount: req_amount,
            id: req_id,
            got: 0,
            put: 0,
        };
        console.log("queueTransport.addRequest: ADDED: " + JSON.stringify(Memory.transportRequests[req_id]));

        return req_id;
    },

    getRequest: function (reqID, creepID) {
        if (!reqID) {
            let request = this.getNewRequest(creepID);
            if (creepID && request)
                request.creepID = creepID;
            return request;
        }

        if (!(reqID in Memory.transportRequests)) {
            console.log("queueTransport.getRequest: no request with id=" + reqID);
            return null;
        }

        let request = Memory.transportRequests[reqID];
        if (creepID && request.creepID != creepID) {
            console.log("queueTransport.getRequest: request (" + reqID + ") belongs to " + request.creepID + " instead of " + creepID);
            return null;
        }

        return request;
    },

    getNewRequest: function (creepID) {
        return _.filter(Memory.transportRequests, r => !r.creepID || r.creepID == creepID)[0];
    },

    badRequest: function (reqID) {
        if (reqID in Memory.transportRequests) {
            console.log("queueTransport.badRequest: " + JSON.stringify(Memory.transportRequests[reqID]));
            delete Memory.transportRequests[reqID];
        }
        return;
    },

    gotResource: function (reqID, amount) {
        let request = this.getRequest(reqID);
        if (!request)
            return null;
        
        request.got = (request.got || 0) + amount;
    },

    putResource: function (reqID, amount) {
        let request = this.getRequest(reqID);
        if (!request)
            return null;
        
        if (amount > request.got)
            console.log(`queueTransport.putResource: amount (${amount}) > request.got (${request.got}) for reqID=${reqID}`);
        
        request.put = (request.put || 0) + amount;
        request.amount -= amount;
        if (request.amount <= 0) {
            console.log("queueTransport: finished request: " + JSON.stringify(request));
            delete Memory.transportRequests[reqID];
            return null;
        }

        return reqID;
    },

    getReserved: function () {
        let res = {};
        for (let reqID in Memory.transportRequests) {
            let request = Memory.transportRequests[reqID];
            let got = 0;
            if (request.creepID) {
                let creep = Game.getObjectById(request.creepID);
                if (!creep)
                    request.creepID = null;
                else
                    got += creep.carry[request.resourceType] || 0;
            }
            res[request.fromID] = res[request.fromID] || {};
            res[request.fromID][request.resourceType] = (res[request.fromID][request.resourceType] || 0) + request.amount - got;
        }

        return res;
    },

    getStoreWithReserved: function (object, resourceType) {
        let reserved = 0;
        if (global.cache.transportReserved[object.id] && global.cache.transportReserved[object.id][resourceType])
            reserved = global.cache.transportReserved[object.id][resourceType];
        return (object.store[resourceType] || 0) - reserved;
    },
};

module.exports = queue;
profiler.registerObject(queue, 'queueTransport');
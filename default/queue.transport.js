const profiler = require('screeps-profiler');

var queue = {
    mainRoomName: Game.rooms["sim"] ? "sim" : "E27S15",
    transportReserved: {},
    indexByCreep: {},

    init: function () {
        Memory.transportRequests = Memory.transportRequests || {};
        this.indexByCreep = {};
        this.transportReserved = {};
        this.carring = {};
        this.getReserved();
    },

    getDefaultStorage: function (creep) {
        return creep && creep.memory.arg == "in" && creep.room.storage ? creep.room.storage : Game.rooms[this.mainRoomName].storage;
    },

    getDefaultTerminal: function (creep) {
        return creep && creep.memory.arg == "in" && creep.room.terminal ? creep.room.terminal : Game.rooms[this.mainRoomName].terminal;
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
        let req_resourceType = resourceType || ("store" in req_from ? _.filter(Object.keys(req_from.store), k => req_from.store[k])[0] : req_from.mineralType);
        let req_amount = amount || ("store" in req_from ? req_from.store[req_resourceType] : req_from.mineralAmount);
        if (!req_resourceType || req_amount <= 0) {
            console.log(`queueTransport.addRequest: can't calc any of these: resourceType=${req_resourceType}, amount=${req_amount}`);
            return null;
        }
        let req_id = _.ceil(Math.random() * 1000000);
        if (req_id in Memory.transportRequests) {
            console.log(`queueTransport.addRequest: req_id (${req_id}) already exists`);
            return null;
        }
        let caller = (new Error()).stack.split('\n')[3].trim();
        
        Memory.transportRequests[req_id] = {
            fromID: req_from.id,
            toID: req_to.id,
            fromRoomName: req_from.pos.roomName,
            fromStructureType: req_from.structureType,
            toRoomName: req_to.pos.roomName,
            toStructureType: req_to.structureType,
            resourceType: req_resourceType,
            amount: req_amount,
            id: req_id,
            got: 0,
            put: 0,
            createTime: Game.time,
            creepID: null,
            state: 0,
            caller,
        };
        //console.log("queueTransport.addRequest: ADDED: " + JSON.stringify(Memory.transportRequests[req_id]));
        console.log(`transport ADDED: ${req_id}. ${req_from.pos.roomName} ${req_from.structureType} -> ${req_to.pos.roomName} ${req_to.structureType} ${req_amount} of ${req_resourceType} called ${caller}`);

        return req_id;
    },

    loadRequest: function (reqID) {
        if (!(reqID in Memory.transportRequests)) {
            console.log("queueTransport.loadRequest: no request with id=" + reqID);
            return null;
        }

        let request = Memory.transportRequests[reqID];
        return request;
    },

    checkRequest: function (creepID) {
        return creepID in this.indexByCreep;
    },

    unbindRequest: function (reqID) {
        let request = this.loadRequest(reqID);
        if (!request)
            return null;
        
        delete this.indexByCreep[request.creepID];
        request.creepID = null;
    },

    getRequest: function (creepID, creepPos, type) {
        if (creepID in this.indexByCreep)
            return this.loadRequest(this.indexByCreep[creepID]);
        
        let minCost;
        let minRequest;
        for (let request of _.filter(Memory.transportRequests, r => 
            !r.creepID && 
            (
                type == "in" && r.fromRoomName == creepPos.roomName && r.fromRoomName == r.toRoomName ||
                type == "out" && (r.fromRoomName != r.toRoomName || creepPos.roomName == r.fromRoomName)
            )
        )) {
            let from = Game.getObjectById(request.fromID);
            let to = Game.getObjectById(request.toID);
            if (!from || !to || request.amount <= 0) {
                this.badRequest(request.id);
                continue;
            }
            if ("mineralAmount" in to && to.mineralAmount + request.amount > to.mineralCapacity
                || "store" in to && _.sum(to.store) + request.amount > to.storeCapacity
                || "mineralAmount" in from && from.mineralAmount < request.amount
                || "store" in from && (from.store[request.resourceType] || 0) < request.amount
                || "mineralType" in to && to.mineralType && to.mineralType != request.resourceType
                || "mineralType" in from && from.mineralType && from.mineralType != request.resourceType
                || to.structureType == STRUCTURE_NUKER && request.resourceType == "G" && to.ghodium + request.amount > to.ghodiumCapacity
            ) {
                this.changeState(request.id, 1);
                continue;
            }
            this.changeState(request.id, 0);
            let range = (creepPos.roomName == from.pos.roomName ? creepPos.getRangeTo(from) : (from.room.getPathToRoom(creepPos.roomName) || undefined));
            if (minCost === undefined || (range && range < minCost)) {
                minCost = range; //request.createTime;
                minRequest = request;
            }
        }

        if (minRequest) {
            minRequest.creepID = creepID;
            this.indexByCreep[creepID] = minRequest.id;
        }

        return minRequest;
    },

    changeState: function (reqID, state) {
        let request = this.loadRequest(reqID);
        if (!request)
            return null;
        
        return request.state = state;
    },

    badRequest: function (reqID) {
        if (reqID in Memory.transportRequests) {
            console.log("queueTransport.badRequest: " + JSON.stringify(Memory.transportRequests[reqID]));
            delete this.indexByCreep[Memory.transportRequests[reqID].creepID];
            delete Memory.transportRequests[reqID];
        }
        return;
    },

    gotResource: function (reqID, amount) {
        let request = this.loadRequest(reqID);
        if (!request)
            return null;
        
        request.got = (request.got || 0) + amount;
    },

    putResource: function (reqID, amount) {
        let request = this.loadRequest(reqID);
        if (!request)
            return null;
        
        if (amount > request.got)
            console.log(`queueTransport.putResource: amount (${amount}) > request.got (${request.got}) for reqID=${reqID}`);
        
        request.put = (request.put || 0) + amount;
        request.amount -= amount;
        if (request.amount <= 0) {
            //console.log("queueTransport: finished request: " + JSON.stringify(request));
            console.log(`transport DONE: ${reqID}. ${request.fromRoomName} ${request.fromStructureType} -> ${request.toRoomName} ${request.toStructureType} ${request.put} of ${request.resourceType}`);
            delete this.indexByCreep[request.creepID];
            delete Memory.transportRequests[reqID];
            return null;
        }

        return reqID;
    },

    getReserved: function () {
        let res = {};
        let cache = {};
        for (let reqID in Memory.transportRequests) {
            let request = Memory.transportRequests[reqID];
            let got = 0;
            if (request.creepID) {
                let creep = Game.getObjectById(request.creepID);
                if (!creep) {
                    request.creepID = null;
                } else {
                    got += creep.carry[request.resourceType] || 0;
                    if (request.creepID in this.indexByCreep)
                        console.log("queueTransport: getReserved double (reqID=" + this.indexByCreep[request.creepID] + ") index for request=" + JSON.stringify(request));
                    else
                        this.indexByCreep[request.creepID] = reqID;
                    if (got > 0) {
                        this.carring[request.toRoomName] = this.carring[request.toRoomName] || {};
                        this.carring[request.toRoomName][request.resourceType] = (this.carring[request.toRoomName][request.resourceType] || 0) + got;
                    }
                }
            } else if (Game.time - request.createTime > TRANSPORT_REQUEST_TIMEOUT && request.state > 0) {
                console.log("Timeout transport request: " + JSON.stringify(request));
                this.badRequest(request.id);
                continue;
            } else {
                let key = request.resourceType + "-" + request.fromID + "-" + request.toID;
                let yek = request.resourceType + "-" + request.toID + "-" + request.fromID;
                if (key in cache) {
                    let cachedRequest = this.loadRequest(cache[key]);
                    if (cachedRequest.amount + request.amount > MERGE_TRANSPORT_AMOUNT) {
                        cache[key] = reqID;
                    } else {
                        cachedRequest.amount += request.amount;
                        console.log("Merged transport request: " + JSON.stringify(request) + " to " + JSON.stringify(cachedRequest));
                        this.badRequest(request.id);
                    }
                } else if (yek in cache) {
                    let cachedRequest = this.loadRequest(cache[yek]);
                    if (cachedRequest.amount > request.amount) {
                        cachedRequest.amount -= request.amount;
                        console.log("Merged INVERT1 transport request: " + JSON.stringify(request) + " to " + JSON.stringify(cachedRequest));
                        this.badRequest(request.id);
                    } else if (cachedRequest.amount < request.amount) {
                        request.amount -= cachedRequest.amount;
                        console.log("Merged INVERT2 transport request: " + JSON.stringify(request) + " to " + JSON.stringify(cachedRequest));
                        this.badRequest(cachedRequest.id);
                    } else {
                        console.log("Merged INVERT3 transport request: " + JSON.stringify(request) + " and " + JSON.stringify(cachedRequest));
                        this.badRequest(request.id);
                        this.badRequest(cachedRequest.id);
                    }
                } else {
                    cache[key] = reqID;
                }
            }
            if (request.amount > 0) {
                this.transportReserved[request.fromID] = this.transportReserved[request.fromID] || {};
                this.transportReserved[request.fromID][request.resourceType] = (this.transportReserved[request.fromID][request.resourceType] || 0) - request.amount + got;

                this.transportReserved[request.toID] = this.transportReserved[request.toID] || {};
                this.transportReserved[request.toID][request.resourceType] = (this.transportReserved[request.toID][request.resourceType] || 0) + request.amount;
            }
        }

        return OK;
    },

    getStoreWithReserved: function (object, resourceType) {
        let reserved = 0;
        if (this.transportReserved[object.id] && this.transportReserved[object.id][resourceType])
            reserved = this.transportReserved[object.id][resourceType];
        let store = reserved;
        if ("store" in object) {
            store += object.store[resourceType] || 0;
        } else if ("mineralType" in object && object.mineralType == resourceType) {
            store += object.mineralAmount || 0;
        } else if ("ghodium" in object && resourceType == "G") {
            store += object.ghodium || 0;
        }
        return store;
    },

    getTypeAndAmount: function (objectID) {
        return this.transportReserved[objectID];
    },

    getRoomStoreWithCarring: function (roomName, rt) {
        if (!(roomName in Memory.rooms) || !("store" in Memory.rooms[roomName]))
            return null;
        
        return Memory.rooms[roomName].store[rt] || 0 + (roomName in this.carring ? this.carring[roomName][rt] || 0 : 0);
    },

    status: function () {
        _.sortBy(Memory.transportRequests, r => r.fromRoomName || r.createTime).forEach(r => 
            console.log(
                r.id + "\t" + r.amount + "\t" + r.resourceType + "\t" + 
                r.fromRoomName + " " + r.fromStructureType + " -> " + r.toRoomName + " " + r.toStructureType + 
                "\tfor " + (Game.time - r.createTime) + " sec\tby " +
                (Game.getObjectById(r.creepID) || {}).name + "\tcalled " + r.caller
        ));
    },
};

module.exports = queue;
profiler.registerObject(queue, 'queueTransport');
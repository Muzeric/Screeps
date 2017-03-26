var utils = require('utils');
const profiler = require('screeps-profiler');

var minerals = {
    needList: {
        "sim": {
            "LO": 100,
        },
    },
    library: {},
    orders: null,
    labCache: {},

    init: function () {
        for (let rt1 in REACTIONS)
            for (let rt2 in REACTIONS)
                this.library[REACTIONS[rt1][rt2]] = {
                    inputTypes: [rt1, rt2],
                };
    },

    getInputTypes: function (rt) {
        if (!(rt in this.library))
            return null;
        
        return this.library[rt].inputTypes;
    },

    getMaxCost: function (resourceType, amount = 1000, roomName = "W48N4") {
        if (!this.orders)
            this.orders = Game.market.getAllOrders({type: ORDER_BUY});
        
        let credits = 0;
        let energy = 0;
        let leftAmount = amount;
        for (let order of _.filter(this.orders, o => o.resourceType == resourceType).sort((a,b) => b.price - a.price)) {
            if (leftAmount <= 0)
                break;
            let curAmount = _.min([leftAmount, order.remainingAmount]);
            credits += order.price * curAmount;
            leftAmount -= curAmount;
            energy += Game.market.calcTransactionCost(curAmount, order.roomName, roomName); 
        }

        return {credits, energy, amount: amount - leftAmount};
    },

    searchCombination: function (roomName = "W48N4", elems) { // second+ args - array of elems
        let res = {};
        for (let elem1 of elems) {
            let rt1 = elem1.resourceType;
            if (!(rt1 in REACTIONS))
                continue;
            for (let elem2 of elems) {
                let rt2 = elem2.resourceType;
                let amount = _.min([elem1.amount, elem2.amount]);
                if (rt1 == rt2 || !(rt2 in REACTIONS[rt1]) || REACTIONS[rt1][rt2] in res)
                    continue;
                let cost = this.getMaxCost(REACTIONS[rt1][rt2], amount, roomName);
                res[REACTIONS[rt1][rt2]] = {resourceTypes: [rt1, rt2], amount: cost.amount, credits: cost.credits, energy: cost.energy};
            }
        }

        return res;
    },

    calcSelling: function (roomName) {
        let room = Game.rooms[roomName];
        if (!room)
            return null;
        
        let storage = room.storage;
        if (!storage)
            return null;
        
        let elems = [];
        for (let resourceType in storage.store) {
            if (storage.store[resourceType] < MIN_RES_AMOUNT + MIN_RES_SELLING_AMOUNT)
                continue;
            elems.push({
                resourceType,
                amount: storage.store[resourceType] - MIN_RES_AMOUNT,
            });
        }

        if (!elems.length)
            return null;
        
        return this.searchCombination(roomName, elems);
    },

    checkNeeds: function (roomName) {
        if (!(roomName in this.needList))
            return null;
        let room = Game.rooms[roomName];
        if (!room)
            return null;
        let storage = room.storage;
        if (!storage)
            return null;
        let terminal = room.terminal;
        if (!terminal)
            return null;
        
        for (let rt in this.needList[roomName]) {
            let amount = (storage.store[rt] || 0) + (terminal.store[rt] || 0) + global.cache.queueLab.getProducing(roomName, rt);
            if (amount > this.needList[roomName][rt])
                continue;
            
            global.cache.queueLab.addRequest(roomName, rt, _.min([this.needList[roomName][rt] - amount, LAB_REQUEST_AMOUNT]), LAB_REQUEST_TYPE_TERMINAL);
        }

        return OK;
    },

    loadLabs: function () {
        let res = [];
        for (let i =0; i < arguments.length; i++) {
            let labID = arguments[i];
            if (!(labID in this.labCache))
                    this.labCache[labID] = Game.getObjectById(labID);
            res.push(this.labCache[labID]);
        }
        return res;
    },

    checkLabs: function (roomName) {
        let room = Game.rooms[roomName];
        if (!room)
            return null;
        let storage = room.storage;
        if (!storage)
            return null;
        let terminal = room.terminal;
        if (!terminal)
            return null;
        let labs = room.getLabs();
        if (!labs.length)
            return null;
        
        let labInfo = {"_free": []};
        for (let lab in labs) {
            if (lab.mineralType) {
                labInfo[lab.mineralType] = labInfo[lab.mineralType] || [];
                labInfo[lab.mineralType].push({id: lab.id, amount: lab.mineralAmount, capacity: lab.amountCapacity, reacted: 0});
            } else {
                labInfo["__free"].push({id: lab.id, amount: 0, capacity: lab.amountCapacity, reacted: 0});
            }
        }

        // Get requests
        // sum needs
        // deal nneds

        let labNeeds = {};
        for (let request of _.filter()) {
            if (request.stage == LAB_REQUEST_STAGE_CREATED) {

            } else if (request.stage == LAB_REQUEST_STAGE_PROCCESSING) {
                if (   !(request.inputType1 in labInfo) 
                    || !(request.inputType2 in labInfo) 
                    || !(request.resourceType in labInfo) && !labInfo["__free"].length
                )
                    continue;
                let lab1 = _.filter(labInfo[request.inputType1], l => l.amount)[0];
                let lab2 = _.filter(labInfo[request.inputType2], l => l.amount)[0];
                let outputLab = _.filter(labInfo[request.resourceType], l => l.amount < l.capacity && !reacted)[0];
                let free = 0;
                if (!outputLab && labInfo["__free"].length) {
                    outputLab = labInfo["__free"][0];
                    free = 1;
                }
                if (!lab1 || !lab2 || !outputLab)
                    continue;
                let lab1Obj = this.loadLabs(lab1.id);
                let lab2Obj = this.loadLabs(lab2.id);
                let outputLabObj = this.loadLabs(outputLab.id);
                if (!lab1Obj || !lab2Obj || !outputLabObj) {
                    console.log(`checkLabs: roomName=${roomName}, lab1=${lab1Obj}, lab2=${lab2Obj}, outputLabObj=${outputLabObj} ID=${request.id}`);
                    global.cache.queueLab.badRequest(request.id);
                    continue;
                }
                if (free) {
                    labInfo["__free"].pop();
                    labInfo[request.resourceType].push(outputLab);
                }
                let res;// = outputLabObj.runReaction(lab1Obj, lab2Obj);
                console.log(`checkLabs: runReaction(lab1, lab2) for reqID=${request.id} with res=${res}`);
                if (res == OK) {
                    let amount = _.min([lab1.amount, lab2.amount, 5, outputLab.capacity - outputLab.amount]);
                    lab1.amount -= amount;
                    lab2.amount -= amount;
                    outputLab.amount += amount;
                    outputLab.reacted = 1;
                }
            }
        }
    },
};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');
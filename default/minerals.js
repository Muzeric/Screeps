var utils = require('utils');
const profiler = require('screeps-profiler');

var minerals = {
    needList: {
        "W48N4": {
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
                    resourceTypes: [rt1, rt2],
                };
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
            let amount = (storage.store[rt] || 0) + (termiinal.store[rt] || 0) + global.cache.queueLab.getReserved(roomName, rt);
            if (amount > this.needList[roomName][rt])
                continue;
            
            global.cache.queueLab.addRequest(roomName, rt, _.min([this.needList[roomName][rt] - amount, LAB_REQUEST_AMOUNT]), LAB_REQUEST_TYPE_TERMINAL);
        }
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
        
        for (let request of _.filter(Memory.labRequests, r => r.roomName == roomName).sort((a,b) => b.stage - a.stage || a.type - b.type)) {
            if (request.stage == LAB_REQUEST_STAGE_PROCCESSING) {
                let lab1 = this.loadLabs(request.lab1ID);
                let lab2 = this.loadLabs(request.lab2ID);
                if (!lab1 || !lab2) {
                    console.log(`checkLabs: roomName=${roomName}, lab1=${lab1}, lab2=${lab2}, ID=${request.id}`);
                    request.lab1ID = null;
                    request.lab2ID = null;
                    request.stage = LAB_REQUEST_STAGE_CREATED;
                    continue;
                }
            }
        }
    },
};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');
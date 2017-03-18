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

    init: function () {
        for (let rt1 in REACTIONS)
            for (let rt2 in REACTIONS)
                this.library[REACTIONS[rt1][rt2]] = {
                    resourceTypes: [rt1, rt2],
                };
        Memory.labRequests = Memory.labRequests || {};
        global.cache.labReserved = this.getReserved();
    },

    getReserved: function () {
        let res = {};
        for (let reqID in Memory.labRequests) {
            let request = Memory.labRequests[reqID];
            res[request.roomName] = res[request.roomName] || {};
            res[request.roomName][request.rt] = res[request.roomName][request.rt] + request.amount;
        }
        return res;
    },

    addRequest: function (roomName, rt, amount = LAB_REQUEST_AMOUNT) {
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
            resourceType: rt,
            amount,
            reacted: 0,
            createTime: Game.time,
        };

        console.log("minerals.addRequest: ADDED: " + JSON.stringify(Memory.labRequests[reqID]));

        return reqID;
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

    getNeeds: function (roomName) {
        let room = Game.rooms[roomName];
        if (!room)
            return null;
        let storage = room.storage;
        if (!storage)
            return null;
        let terminal = room.terminal;
        if (!terminal)
            return null;
        if (!(roomName in this.needList))
            return null;
        
        for (let rt in this.needList[roomName]) {
            let amount = (storage.store[rt] || 0) + (termiinal.store[rt] || 0) + (global.cache.labReserved[roomName][rt] || 0);
            if (amount > this.needList[roomName][rt])
                continue;
            
            this.addRequest(roomName, rt, _.min([this.needList[roomName][rt] - amount, LAB_REQUEST_AMOUNT]));
        }
    },

    checkLabs: function (roomName) {
        let room = Game.rooms[roomName];
        if (!room)
            return null;
        let storage = room.storage;
        if (!storage)
            return null;
        let labs = room.getLabs();
        if (!labs.length)
            return null;
        

    },
};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');
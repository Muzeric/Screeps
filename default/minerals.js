var utils = require('utils');
const profiler = require('screeps-profiler');

var minerals = {
    library: {},
    orders: null,

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

        return {credits, energy};
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
                res[REACTIONS[rt1][rt2]] = {resourceTypes: [rt1, rt2], amount, credits: cost.credits, energy: cost.energy};
            }
        }

        return res;
    },

    calcSelling: function (roomName) {
        if (!Game.rooms[roomName])
            return null;
        let storage = Game.rooms[roomName].storage;
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
};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');
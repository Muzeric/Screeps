var utils = require('utils');
const profiler = require('screeps-profiler');

var minerals = {
    library: {},
    topBoosts: {},
    orders: null,
    labCache: {},

    init: function () {
        for (let rt1 in REACTIONS) {
            for (let rt2 in REACTIONS) {
                if (rt2 in REACTIONS[rt1]) {
                    this.library[REACTIONS[rt1][rt2]] = {
                        inputTypes: [rt1, rt2],
                    };
                }
            }
        }
        
        for (let bodyPart in BOOSTS) {
            for (let bt in BOOSTS[bodyPart]) {
                for (let skill in BOOSTS[bodyPart][bt]) {
                    this.topBoosts[bodyPart] = this.topBoosts[bodyPart] || {};
                    this.topBoosts[bodyPart][skill] = this.topBoosts[bodyPart][skill] || {};
                    if (!this.topBoosts[bodyPart][skill].power || BOOSTS[bodyPart][bt][skill] > this.topBoosts[bodyPart][skill].power) {
                        this.topBoosts[bodyPart][skill].power = BOOSTS[bodyPart][bt][skill];
                        this.topBoosts[bodyPart][skill].bt = bt;
                    }
                }
            }
        }
    },

    getBoostResource: function (bodyPart, skill) {
        if (bodyPart in this.topBoosts && skill in this.topBoosts[bodyPart]) {
            return this.topBoosts[bodyPart][skill].bt;
        }

        return null;
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
        for (let order of _.filter(this.orders, o => o.resourceType == resourceType).sort((a,b) =>
            (b.price - Game.market.calcTransactionCost(_.min([b.remainingAmount, amount]), b.roomName, roomName) * 0.01)
            - (a.price - Game.market.calcTransactionCost(_.min([a.remainingAmount, amount]), a.roomName, roomName) * 0.01)
        )) {
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
            if (!(rt1 in this.library)) {
                let cost = this.getMaxCost(rt1, elem1.amount, roomName);
                res[rt1] = {resourceTypes: null, amount: cost.amount, credits: cost.credits, energy: cost.energy};
            }
            
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

    clearLabs: function (labs, storage) {
        for (let lab of labs) {
            if (lab.mineralType && lab.mineralAmount) {
                let stored = global.cache.queueTransport.getStoreWithReserved(lab, lab.mineralType);
                if (stored > 0)
                    global.cache.queueTransport.addRequest(lab, storage, lab.mineralType, stored);
            }
        }
    },

    runLabs: function (roomName) {
        let room = Game.rooms[roomName];
        if (!room)
            return null;
        let storage = room.storage;
        if (!storage)
            return null;
        let inputLabs = room.getInputLabs();
        if (inputLabs.length < 2)
            return null;
        let outputLabs = room.getOutputLabs();
        if (outputLabs.length < 1)
            return null;
        
        let request;
        if (room.memory.labRequest) {
            request = room.memory.labRequest;
            if (request.amount < LAB_REACTION_AMOUNT || request.outputType == "undefined") {
                console.log(`${roomName}: bad request for ${request.amount} of ${request.outputType}`);
                Game.notify(`${roomName}: bad request for ${request.amount} of ${request.outputType}`);
                room.memory.labRequest = null;
            }
        }
        if (!room.memory.labRequest) {
            for (let outputType of _.keys(this.library).sort((a, b) => a.length - b.length)) {
                let elem = this.library[outputType];
                let in1 = storage.store[elem.inputTypes[0]] || 0;
                let in2 = storage.store[elem.inputTypes[1]] || 0;
                let out = storage.store[outputType] || 0;
                let amount = _.min([BALANCE_MIN - out, in1, in2, LAB_REQUEST_AMOUNT]);
                if (amount < BALANCE_LAB_MIN)
                    continue;
                
                console.log(`${roomName}: start request for ${amount} of ${outputType}`);
                
                room.memory.labRequest = {
                    outputType,
                    amount,
                    done: 0,
                    inputType1: elem.inputTypes[0],
                    inputType2: elem.inputTypes[1],
                    createTime: Game.time,
                };

                break;
            }
        }
        if (!room.memory.labRequest) {
            this.clearLabs(inputLabs, storage);
            this.clearLabs(outputLabs, storage);
            return null;
        }

        request = room.memory.labRequest;
        let ready = 0;
        let i = 0;
        
        for (let inputType of [request.inputType1, request.inputType2]) {
            let lab = inputLabs[i++];
            let futureAmount = global.cache.queueTransport.getStoreWithReserved(lab, inputType);
            let transportableAmount = global.cache.queueTransport.getStoreWithReserved(storage, inputType);
            if (lab.mineralType == inputType && lab.mineralAmount >= LAB_REACTION_AMOUNT)
                ready++;
            if ((lab.mineralType == inputType || !lab.mineralType) && futureAmount < request.amount) {
                if (transportableAmount < request.amount - futureAmount) {
                    room.memory.labRequest = null;
                    global.cache.queueTransport.addRequest(lab, storage, inputType, futureAmount);
                } else {
                    global.cache.queueTransport.addRequest(storage, lab, inputType, request.amount - futureAmount);
                }

            } else if (lab.mineralType && lab.mineralType != inputType) {
                let stored = global.cache.queueTransport.getStoreWithReserved(lab, lab.mineralType);
                if (stored > 0)
                    global.cache.queueTransport.addRequest(lab, storage, lab.mineralType, stored );
            }
        }

        if (ready < 2)
            return null;

        let lab1 = Game.getObjectById(inputLabs[0].id);
        let lab2 = Game.getObjectById(inputLabs[1].id);
        for (let lab of outputLabs) {
            if (global.cache.boostingLabs.indexOf(lab.id) !== -1) {
                if (lab.mineralAmount) {
                    let stored = global.cache.queueTransport.getStoreWithReserved(lab, lab.mineralType);
                    if (stored > 0)
                        global.cache.queueTransport.addRequest(lab, storage, lab.mineralType, stored);
                }
                continue;
            }
            if (lab.mineralType && lab.mineralType != request.outputType || lab.mineralAmount >= LAB_TRANSPORT_AMOUNT) {
                let stored = global.cache.queueTransport.getStoreWithReserved(lab, lab.mineralType);
                if (lab.mineralType != request.outputType ? stored > 0 : stored >= LAB_TRANSPORT_AMOUNT)
                    global.cache.queueTransport.addRequest(lab, storage, lab.mineralType, stored);
            }
            if (lab.mineralType && lab.mineralType != request.outputType)
                continue;

            let lab3 = Game.getObjectById(lab.id);
            let res = lab3.runReaction(lab1, lab2);
            if (res == OK) {
                request.amount -= LAB_REACTION_AMOUNT;
                request.done += LAB_REACTION_AMOUNT;
                inputLabs[0].mineralAmount -= LAB_REACTION_AMOUNT;
                inputLabs[1].mineralAmount -= LAB_REACTION_AMOUNT;
                lab.mineralAmount -= LAB_REACTION_AMOUNT;
                if (request.amount <= 0)
                    room.memory.labRequest = null;
            } else {
                console.log(`runLabs: ${lab3.id}.runReaction(${lab1.id},${lab2.id}) with res=${res}`);
            }
        }
        if (!room.memory.labRequest) {
            this.clearLabs(inputLabs, storage);
            this.clearLabs(outputLabs, storage);
        }
    },
};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');
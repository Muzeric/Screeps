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

    searchLab: function (room, rt, amount) {
        for (let lab of _.filter(room.getLabs(), l => !l.mineralType || l.mineralType == rt)) {
            let reserved = global.cache.queueLab.getReserved(lab.id);
            if (reserved.resourceType && reserved.resourceType != rt)
                continue;
            let left = lab.mineralAmount + reserved.amount + amount;
            if (left >= 0 && left <= lab.mineralCapacity)
                return lab.id;
        }
    },

    searchFreeLab: function (room, chainID) {
        // TODO: working with chainID
        let lab = _.filter(room.getLabs(), l => !global.cache.queueLab.getReserved(l.id))[0];
        if (lab)
            return lab.id;
        
        return null;
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
                    global.cache.queueLab.badRequest(request.id);
                    continue;
                }
                if (!lab1.mineralAmount || !lab2.mineralAmount)
                    continue;

                if (   lab1.mineralType != request.inputType1
                    || lab2.mineralType != request.inputType2
                ) {
                    console.log(`checkLabs: bad mineralType, roomName=${roomName}, lab1=${lab1.id} with ${lab1.mineralType} lab2=${lab2.id} with ${lab2.mineralType}, ID=${request.id}`);
                    continue;
                }

                for (let labID of request.outputLabs) {
                    let lab = this.loadLabs(labID);
                    if (!lab) {
                        console.log(`checkLabs: bad output lab (${labID}) in reqID=${request.id}`);
                        global.cache.queueLab.badRequest(request.id);
                        continue;
                    }

                    if (lab.mineralType != request.outputType) {
                        console.log(`checkLabs: bad output mineralType, roomName=${roomName}, output lab=${labID} with ${lab.mineralType} instead of ${request.outputType}, ID=${request.id}`);
                        continue;
                    }

                    //let res = lab.runReaction(lab1, lab2);
                    console.log(`checkLabs: runReaction(lab1, lab2) for reqID=${request.id}`);
                }
            } else if (request.stage == LAB_REQUEST_STAGE_PREPARE) {

            } else if (request.stage == LAB_REQUEST_STAGE_CREATED) {
                // search lab: ready or transfer or react
                // ready -> reserve
                // transfer -> search free
                                // yes -> request -> reserve
                                // no -> search free from chain -> 
                                        // yes -> request empty -> request fill -> reserve
                                        // no -> oops, return
                // react -> request -> reserve

                let lab1ID = this.searchLab(room, request.inputType1, -1 * request.amount);
                if (!lab1ID) {
                    if (room.getAmount(request.inputType1) >= request.amount) {
                        lab1ID = this.searchFreeLab(room, request.chainID);
                        if (!lab1ID) {
                            console.log(`checkLabs: can't find free lab for chainID=${request.chainID}`);
                            continue;
                        }
                        //global.cache.queueTransport.addRequest(null, lab1ID, request.inputType1, request.amount);
                    } else if (this.getInputTypes(request.inputType1)) {
                        let reqID = global.cache.queueLab.addRequest(roomName, request.inputType1, request.amount, LAB_REQUEST_TYPE_REACTION, request.chainID || request.id);
                    } else {
                        // Buy it
                    }
                }
                
                global.cache.queueLab.setRequestLabs(request.id, lab1ID, lab2ID, outputLabID);
                console.log(`checkLabs: setRequestLabs for reqID=${request.id}`);
            }
        }
    },
};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');
var utils = require('utils');
const profiler = require('screeps-profiler');

var minerals = {
    needList: {
        "sim": {
            "terminal": {
                "LO": 100,
            },
        },
        "W48N4": {
            "terminal": {
                "LO": 5000,
                "UL": 5000,
            },
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
        
        for (let type in this.needList[roomName]) {
            for (let rt in this.needList[roomName][type]) {
                let amount = (storage.store[rt] || 0) + (terminal.store[rt] || 0) + global.cache.queueLab.getProducing(roomName, type, rt);
                if (amount > this.needList[roomName][type][rt])
                    continue;
                
                global.cache.queueLab.addRequest(roomName, rt, _.min([this.needList[roomName][type][rt] - amount, LAB_REQUEST_AMOUNT]), type);
            }
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

    searchLabs: function (labInfo, inputType1, inputType2, outputType) {
        let lab1ID;
        let lab2ID;
        let outputLabID;

        for (let labID in labInfo) {
            let lab = labInfo[labID];
            if (lab.reacted)
                continue;
            if (
                   (lab.mineralType == outputType && (outputLabID === undefined || labInfo[outputLabID].mineralType === null) && lab.mineralCapacity - lab.mineralAmount)
                || (lab.mineralType === null && outputLabID === undefined)
            ) {
                outputLabID = labID;
                if (lab.mineralType)
                    break;
            }
        }

        if (!outputLabID)
            return null;

        for (let labID in labInfo) {
            if (labID == outputLabID)
                continue;
            let lab = labInfo[labID];
            if ( lab.mineralType == inputType1) {
                lab1ID = labID;
                break;
            } else if (lab.mineralType === null && lab1ID === undefined) {
                lab1ID = labID;
            }
        }

        if (!lab1ID)
            return null;

        for (let labID in labInfo) {
            if (labID == outputLabID || labID == lab1ID)
                continue;
            let lab = labInfo[labID];
            if ( lab.mineralType == inputType2) {
                lab2ID = labID;
                break;
            } else if (lab.mineralType === null && lab2ID === undefined) {
                lab2ID = labID;
            }
        }

        if (!lab2ID)
            return null;

        return [lab1ID, lab2ID, outputLabID];
    },

    addNeedList: function (roomName, type, rt, amount) {
        this.needList[request.roomName] = this.needList[request.roomName] || {};
        this.needList[request.roomName][type] = this.needList[request.roomName][type] || {};
        this.needList[request.roomName][type][rt] = (this.needList[request.roomName][type][rt] || 0) + amount;
    },

    checkAndRequestAmount: function (labInfo, labs, request, storage) {
        let freeAmount1 = labInfo[labs[0]].mineralAmount - labInfo[labs[0]].usedAmount;
        let freeAmount2 = labInfo[labs[1]].mineralAmount - labInfo[labs[1]].usedAmount;

        let futureAmount1 = labInfo[labs[0]].transportAmount - labInfo[labs[0]].wantedAmount;
        let futureAmount2 = labInfo[labs[1]].transportAmount - labInfo[labs[1]].wantedAmount;

        let transportableAmount1 = global.cache.queueTransport.getStoreWithReserved(storage, request.inputType1);
        let transportableAmount2 = global.cache.queueTransport.getStoreWithReserved(storage, request.inputType2);

        if (
               (freeAmount1 + futureAmount1 + transportableAmount1 >= request.amount)
            && (freeAmount2 + futureAmount2 + transportableAmount2 >= request.amount)
        ) {
            labInfo[labs[0]].mineralType = request.inputType1;
            labInfo[labs[0]].wantedAmount += request.amount;
            labInfo[labs[1]].mineralType = request.inputType2;
            labInfo[labs[1]].wantedAmount += request.amount;

            if (freeAmount1 && freeAmount2)
                return OK;
        } else {
            if (freeAmount1 + futureAmount1 + transportableAmount1 < request.amount) {
                if (this.getInputTypes(request.inputType1)) {
                    this.addNeedList(request.roomName, LAB_REQUEST_TYPE_REACTION, request.inputType1, request.amount - (freeAmount1 + futureAmount1 + transportableAmount1));
                } else {
                    // buy
                }
            }
            if (freeAmount1 + futureAmount1 + transportableAmount1 < request.amount) {
                if (this.getInputTypes(request.inputType2)) {
                    this.addNeedList(request.roomName, LAB_REQUEST_TYPE_REACTION, request.inputType2, request.amount - (freeAmount2 + futureAmount2 + transportableAmount2));
                } else {
                    // buy
                }
            }
        }


        return ERR_NOT_ENOUGH_RESOURCES;
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
        
        let labInfo = {};
        for (let lab of labs) {
            let mineralType = lab.mineralType;
            let transportAmount = 0;
            let transportInfo = global.cache.queueTransport.getTypeAndAmount(lab.id);
            if (transportInfo) {
                let arr = _.map(transportInfo, (v,k) => [k,v]);
                if (arr.length > 1)
                    console.log(`${roomName}: checkLabs got lab ${lab.id} with >1 resourceType transportInfo: ` + JSON.stringify(transportInfo));

                if (mineralType && mineralType != arr[0][0]) {
                    console.log(`${roomName}: checkLabs got lab ${lab.id} with mineralType=${mineralType} and transport req with mineralType=${arr[0][0]}`);
                } else if (arr[0][1] > 0) {
                    mineralType = arr[0][0];
                    transportAmount = arr[0][1];
                }
            }
            labInfo[lab.id] = {
                id: lab.id,
                mineralCapacity: lab.mineralCapacity,
                mineralAmount: lab.mineralAmount,
                cooldown: lab.cooldown,
                mineralType,
                transportAmount,
                usedAmount: 0,
                wantedAmount: 0,
                reacted: 0,
            };
        }

        // Get requests
        // sum needs
        // deal nneds

        let labNeeds = {};
        for (let reqID in Memory.labRequests) {
            let request = Memory.labRequests[reqID];
            let labs = this.searchLabs(labInfo, request.inputType1, request.inputType2, request.outputType);
            if (!labs)
                continue;
            let check = this.checkAndRequestAmount(labInfo, labs, request, storage);
            if (check == OK && !labInfo[labs[2]].cooldown) {
                let labsObj = this.loadLabs.apply(this, labs);
                let res = labsObj[2].runReaction(labsObj[0], labsObj[1]);
                console.log(`checkLabs: ${labs[2]}.runReaction(${labs[0]},${labs[1]}) for reqID=${request.id} with res=${res}`);
                if (res == OK) {
                    let amount = LAB_REACTION_AMOUNT;
                    labInfo[labs[0]].usedAmount += amount;
                    labInfo[labs[1]].usedAmount += amount;
                    labInfo[labs[2]].reacted = 1;
                    global.cache.queueLab.produceAmount(reqID, amount);
                }    
            }       
        }

        for (let labID in labInfo) {
            let lab = labInfo[labID];
            let needAmount = lab.wantedAmount - lab.mineralAmount - lab.transportAmount;
            let transportableAmount = global.cache.queueTransport.getStoreWithReserved(storage, lab.mineralType);
            if (needAmount > 0 && transportableAmount > 0)
                global.cache.queueTransport.addRequest(storage, lab, lab.mineralType, _.min([transportableAmount, needAmount]));
            else if (!lab.wantedAmount && lab.mineralAmount >= TRANSPORTER_MIN_CONTAINER_AMOUNT && global.cache.queueTransport.getStoreWithReserved(lab, lab.mineralType) > 0)
                global.cache.queueTransport.addRequest(lab, null, lab.mineralType, global.cache.queueTransport.getStoreWithReserved(lab, lab.mineralType) );
        }
    },
};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');
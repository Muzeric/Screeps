var utils = require('utils');
const profiler = require('screeps-profiler');

var minerals = {
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

    checkNeeds: function (room) {
        let roomName = room.name;
        let storage = room.storage;
        if (!storage)
            return null;
        if (_.filter(Memory.labRequests, r => r.roomName == roomName && r.inprogress).length)
            return null;
        
        for (let outputType of _.keys(this.library).sort((a, b) => a.length - b.length)) {
            let elem = this.library[outputType];
            let in1 = storage.store[elem.inputTypes[0]] || 0;
            let in2 = storage.store[elem.inputTypes[1]] || 0;
            let out = storage.store[outputType] || 0;
            let producing = global.cache.queueLab.getProducing(roomName, LAB_REQUEST_TYPE_TERMINAL, outputType);
            //console.log(`${roomName}: checNeeds for ${outputType} in1=${in1}, in2=${in2}, out=${out}, producing=${producing}`);
            if (in1 < BALANCE_LAB_MIN || in2 < BALANCE_LAB_MIN || out + producing >= BALANCE_MIN)
                continue;
            
            let amount = _.min([BALANCE_MIN - out - producing, in1, in2]);
            console.log(`${roomName}: checNeeds added request for ${amount} of ${outputType}`);
            global.cache.queueLab.addRequest(roomName, outputType, amount);
            break;
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

    checkLabs: function (labInfo, request) {
        let labs = request.labs;
        if (!labInfo[labs[0]] || !labInfo[labs[1]] || !labInfo[labs[2]]
            || labInfo[labs[0]].mineralType && labInfo[labs[0]].mineralType != request.inputType1
            || labInfo[labs[1]].mineralType && labInfo[labs[1]].mineralType != request.inputType2
            || labInfo[labs[2]].mineralType && labInfo[labs[2]].mineralType != request.outputType
        ) {
            return 1;
        }

        return OK;
    },

    checkAndRequestAmount: function (labInfo, request, storage) {
        let labs = request.labs;
        let freeAmount1 = labInfo[labs[0]].mineralAmount - labInfo[labs[0]].usedAmount;
        let freeAmount2 = labInfo[labs[1]].mineralAmount - labInfo[labs[1]].usedAmount;

        let futureAmount1 = labInfo[labs[0]].transportAmount - labInfo[labs[0]].wantedAmount;
        let futureAmount2 = labInfo[labs[1]].transportAmount - labInfo[labs[1]].wantedAmount;

        let transportableAmount1 = global.cache.queueTransport.getStoreWithReserved(storage, request.inputType1);
        let transportableAmount2 = global.cache.queueTransport.getStoreWithReserved(storage, request.inputType2);

        //console.log(`check: ${request.id}: freeAmount1=${freeAmount1}, freeAmount2=${freeAmount2}, futureAmount1=${futureAmount1}, futureAmount2=${futureAmount2}, request.amount=${request.amount}`);
        if (
               (freeAmount1 + futureAmount1 + transportableAmount1 >= request.amount) && (labInfo[labs[0]].wantedAmount + request.amount <= labInfo[labs[0]].mineralCapacity)
            && (freeAmount2 + futureAmount2 + transportableAmount2 >= request.amount) && (labInfo[labs[1]].wantedAmount + request.amount <= labInfo[labs[1]].mineralCapacity)
        ) {
            labInfo[labs[0]].mineralType = request.inputType1;
            labInfo[labs[0]].wantedAmount += request.amount;
            labInfo[labs[1]].mineralType = request.inputType2;
            labInfo[labs[1]].wantedAmount += request.amount;

            if (    freeAmount1 >= LAB_REACTION_AMOUNT && freeAmount1 + labInfo[labs[0]].transportAmount >= LAB_REACTION_AMOUNT 
                 && freeAmount2 >= LAB_REACTION_AMOUNT && freeAmount2 + labInfo[labs[1]].transportAmount >= LAB_REACTION_AMOUNT)
                return OK;
            else
                return ERR_NOT_ENOUGH_RESOURCES;
        } /*else {
            
            if (freeAmount1 + futureAmount1 + transportableAmount1 < request.amount) {
                if (this.getInputTypes(request.inputType1)) {
                    //this.addNeedList(request.roomName, LAB_REQUEST_TYPE_REACTION, request.inputType1, request.amount - (freeAmount1 + futureAmount1 + transportableAmount1));
                } else {
                    // buy
                }
            }
            if (freeAmount2 + futureAmount2 + transportableAmount2 < request.amount) {
                if (this.getInputTypes(request.inputType2)) {
                    //this.addNeedList(request.roomName, LAB_REQUEST_TYPE_REACTION, request.inputType2, request.amount - (freeAmount2 + futureAmount2 + transportableAmount2));
                } else {
                    // buy
                }
            }
        }*/


        return ERR_NOT_FOUND;
    },

    runLabs: function (roomName) {
        let room = Game.rooms[roomName];
        if (!room)
            return null;
        let storage = room.storage;
        if (!storage)
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
                //let arr = _.map(transportInfo, (v,k) => [k,v]);
                //if (arr.length > 1)
                    //console.log(`${roomName}: checkLabs got lab ${lab.id} with >1 resourceType transportInfo: ` + JSON.stringify(transportInfo));

                for (let mt in transportInfo) {
                    let am = transportInfo[mt];
                
                    if (mineralType && mineralType == mt || !mineralType & am > 0) {
                        mineralType = mt;
                        transportAmount += am;
                    } else if (mineralType && mineralType != mt && am > 0) {
                        console.log(`${roomName}: checkLabs got lab ${lab.id} with mineralType=${mineralType} and transport req with mineralType=${mt}`);
                    }
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
                need: 0,
                reacted: 0,
            };
        }

        let labGot = {};
        for (let request of _.sortBy(_.filter(Memory.labRequests, r => r.roomName == roomName), r => -1 * r.inprogress || r.createTime)) {
            if (!request.labs || this.checkLabs(labInfo, request))
                request.labs = this.searchLabs(labInfo, request.inputType1, request.inputType2, request.outputType);
            if (!request.labs) {
                global.cache.queueLab.progress(request.id, 0);
                continue;
            }
            let check = this.checkAndRequestAmount(labInfo, request, storage);
            if (check == OK || check == ERR_NOT_ENOUGH_RESOURCES) {
                labInfo[request.labs[2]].need = 1;
                global.cache.queueLab.progress(request.id, 1);
            }

            if (check == OK && !labInfo[request.labs[2]].cooldown) {
                let labsObj = this.loadLabs.apply(this, request.labs);
                let res = labsObj[2].runReaction(labsObj[0], labsObj[1]);
                if (res == OK) {
                    let amount = LAB_REACTION_AMOUNT;
                    labInfo[request.labs[0]].usedAmount += amount;
                    labInfo[request.labs[1]].usedAmount += amount;
                    labInfo[request.labs[2]].reacted = 1;
                    global.cache.queueLab.produceAmount(request.id, amount);
                } else {
                    console.log(`runLabs: ${request.labs[2]}.runReaction(${request.labs[0]},${request.labs[1]}) for reqID=${request.id} with res=${res}`);
                }
            }
        }

        for (let labID in labInfo) {
            let lab = labInfo[labID];
            let needAmount = lab.wantedAmount - lab.mineralAmount - lab.transportAmount;
            let transportableAmount = global.cache.queueTransport.getStoreWithReserved(storage, lab.mineralType);
            let stored = global.cache.queueTransport.getStoreWithReserved(lab, lab.mineralType);
            //console.log(`LAB S{labID}: needAmount=${needAmount}, wantedAmount=${lab.wantedAmount}, mineralAmount=${lab.mineralAmount}, transportAmount=${lab.transportAmount}, transportableAmount=${transportableAmount}, usedAmount=${lab.usedAmount}`);
            if (needAmount > 0 && transportableAmount > 0) {
                //console.log(`${labID}: wantedAmount=${lab.wantedAmount}, mineralAmount=${lab.mineralAmount}, transportAmount=${lab.transportAmount}, transportableAmount=${transportableAmount}, usedAmount=${lab.usedAmount}`);
                global.cache.queueTransport.addRequest(storage, lab, lab.mineralType, _.min([transportableAmount, needAmount]));
            } else if (!lab.wantedAmount && !lab.cooldown && (lab.need ? stored >= LAB_REQUEST_AMOUNT : stored > 0)) {
                //console.log(`id=${lab.id}, need=${lab.need}, amount=` + stored);
                global.cache.queueTransport.addRequest(lab, storage, lab.mineralType, stored );
            }
        }
    },
};

module.exports = minerals;
profiler.registerObject(minerals, 'Minerals');